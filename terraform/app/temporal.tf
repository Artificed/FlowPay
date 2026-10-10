resource "aws_cloudwatch_log_group" "temporal" {
  name              = "/ecs/${var.project}-temporal"
  retention_in_days = 14

  tags = {
    Name = "${var.project}-temporal"
  }
}

resource "aws_iam_role" "temporal_execution" {
  name                 = "${var.project}-temporal-execution"
  permissions_boundary = local.app_role_boundary_arn
  assume_role_policy   = data.aws_iam_policy_document.ecs_tasks_assume.json

  tags = {
    Name = "${var.project}-temporal-execution"
  }
}

data "aws_iam_policy_document" "temporal_execution" {
  statement {
    actions   = ["ecr:GetAuthorizationToken"]
    resources = ["*"]
  }

  statement {
    actions = [
      "ecr:BatchGetImage",
      "ecr:GetDownloadUrlForLayer",
      "ecr:BatchImportUpstreamImage",
      "ecr:CreateRepository",
    ]
    resources = ["arn:aws:ecr:${local.region}:${data.aws_caller_identity.current.account_id}:repository/dockerhub/temporalio/*"]
  }

  statement {
    actions   = ["logs:CreateLogStream", "logs:PutLogEvents"]
    resources = ["${aws_cloudwatch_log_group.temporal.arn}:*"]
  }

  statement {
    actions   = ["secretsmanager:GetSecretValue"]
    resources = [aws_db_instance.main.master_user_secret[0].secret_arn]
  }
}

resource "aws_iam_role_policy" "temporal_execution" {
  name   = "start-task"
  role   = aws_iam_role.temporal_execution.id
  policy = data.aws_iam_policy_document.temporal_execution.json
}

resource "aws_service_discovery_private_dns_namespace" "main" {
  name = "${var.project}.local"
  vpc  = local.vpc_id

  tags = {
    Name = "${var.project}.local"
  }
}

resource "aws_service_discovery_service" "temporal" {
  name          = "temporal"
  force_destroy = true

  dns_config {
    namespace_id = aws_service_discovery_private_dns_namespace.main.id

    dns_records {
      type = "A"
      ttl  = 10
    }
  }

  tags = {
    Name = "${var.project}-temporal"
  }
}

locals {
  dockerhub_mirror    = "${data.aws_caller_identity.current.account_id}.dkr.ecr.${local.region}.amazonaws.com/dockerhub"
  temporal_version    = "1.30.1"
  temporal_port       = 7233
  rds_ca_path         = "/config/rds-ca.pem"
  dynamic_config_path = "/config/dynamicconfig.yaml"

  temporal_log_configuration = {
    logDriver = "awslogs"
    options = {
      awslogs-group         = aws_cloudwatch_log_group.temporal.name
      awslogs-region        = local.region
      awslogs-stream-prefix = "ecs"
    }
  }
}

resource "aws_ecs_task_definition" "temporal" {
  family                   = "${var.project}-temporal"
  requires_compatibilities = ["FARGATE"]
  network_mode             = "awsvpc"
  cpu                      = 512
  memory                   = 1024
  execution_role_arn       = aws_iam_role.temporal_execution.arn

  runtime_platform {
    operating_system_family = "LINUX"
    cpu_architecture        = "ARM64"
  }

  volume {
    name = "config"
  }

  container_definitions = jsonencode([
    {
      name       = "write-config"
      image      = "${local.dockerhub_mirror}/temporalio/admin-tools:${local.temporal_version}"
      essential  = false
      user       = "root"
      entryPoint = ["/bin/sh", "-c"]
      command = [join(" && ", [
        "printf '%s' \"$RDS_CA\" > ${local.rds_ca_path}",
        "printf '%s' \"$DYNAMIC_CONFIG\" > ${local.dynamic_config_path}",
      ])]

      environment = [
        { name = "RDS_CA", value = file("${path.module}/../../flowpay-be/certs/rds-ap-southeast-3-bundle.pem") },
        { name = "DYNAMIC_CONFIG", value = file("${path.module}/../../temporal/dynamicconfig/production-sql.yaml") },
      ]

      mountPoints      = [{ sourceVolume = "config", containerPath = "/config" }]
      logConfiguration = local.temporal_log_configuration
    },
    {
      name       = "schema-setup"
      image      = "${local.dockerhub_mirror}/temporalio/admin-tools:${local.temporal_version}"
      essential  = false
      dependsOn  = [{ containerName = "write-config", condition = "SUCCESS" }]
      entryPoint = ["/bin/sh", "-c"]
      command    = [file("${path.module}/../../temporal/scripts/setup-postgres.sh")]

      environment = [
        { name = "POSTGRES_SEEDS", value = aws_db_instance.main.address },
        { name = "POSTGRES_USER", value = aws_db_instance.main.username },
        { name = "DB_PORT", value = tostring(aws_db_instance.main.port) },
        { name = "SQL_TLS", value = "true" },
        { name = "SQL_TLS_CA_FILE", value = local.rds_ca_path },
      ]

      secrets = [
        { name = "SQL_PASSWORD", valueFrom = "${aws_db_instance.main.master_user_secret[0].secret_arn}:password::" },
      ]

      mountPoints      = [{ sourceVolume = "config", containerPath = "/config", readOnly = true }]
      logConfiguration = local.temporal_log_configuration
    },
    {
      name      = "temporal"
      image     = "${local.dockerhub_mirror}/temporalio/server:${local.temporal_version}"
      essential = true
      dependsOn = [{ containerName = "schema-setup", condition = "SUCCESS" }]

      portMappings = [{ containerPort = local.temporal_port }]

      environment = [
        { name = "DB", value = "postgres12" },
        { name = "DB_PORT", value = tostring(aws_db_instance.main.port) },
        { name = "POSTGRES_SEEDS", value = aws_db_instance.main.address },
        { name = "POSTGRES_USER", value = aws_db_instance.main.username },
        { name = "BIND_ON_IP", value = "0.0.0.0" },
        { name = "SQL_TLS_ENABLED", value = "true" },
        { name = "SQL_CA", value = local.rds_ca_path },
        { name = "SQL_HOST_VERIFICATION", value = "true" },
        { name = "DYNAMIC_CONFIG_FILE_PATH", value = local.dynamic_config_path },
      ]

      secrets = [
        { name = "POSTGRES_PWD", valueFrom = "${aws_db_instance.main.master_user_secret[0].secret_arn}:password::" },
      ]

      mountPoints = [{ sourceVolume = "config", containerPath = "/config", readOnly = true }]

      healthCheck = {
        command     = ["CMD-SHELL", "nc -z localhost ${local.temporal_port} || exit 1"]
        interval    = 10
        timeout     = 5
        retries     = 6
        startPeriod = 30
      }

      logConfiguration = local.temporal_log_configuration
    },
    {
      name       = "create-namespace"
      image      = "${local.dockerhub_mirror}/temporalio/admin-tools:${local.temporal_version}"
      essential  = false
      dependsOn  = [{ containerName = "temporal", condition = "HEALTHY" }]
      entryPoint = ["/bin/sh", "-c"]
      command    = [file("${path.module}/../../temporal/scripts/create-namespace.sh")]

      environment = [
        { name = "TEMPORAL_ADDRESS", value = "localhost:${local.temporal_port}" },
        { name = "DEFAULT_NAMESPACE", value = "default" },
      ]

      logConfiguration = local.temporal_log_configuration
    },
  ])

  tags = {
    Name = "${var.project}-temporal"
  }
}

resource "aws_ecs_service" "temporal" {
  name            = "${var.project}-temporal"
  cluster         = aws_ecs_cluster.main.id
  task_definition = aws_ecs_task_definition.temporal.arn
  desired_count   = 1
  launch_type     = "FARGATE"

  deployment_minimum_healthy_percent = 0
  deployment_maximum_percent         = 100

  network_configuration {
    subnets          = local.private_subnet_ids
    security_groups  = [local.temporal_security_group_id]
    assign_public_ip = false
  }

  service_registries {
    registry_arn = aws_service_discovery_service.temporal.arn
  }

  deployment_circuit_breaker {
    enable   = true
    rollback = true
  }

  tags = {
    Name = "${var.project}-temporal"
  }

  depends_on = [aws_vpc_endpoint.interface]
}
