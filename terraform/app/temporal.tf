resource "aws_cloudwatch_log_group" "temporal" {
  name              = "/ecs/${var.project}-temporal"
  retention_in_days = 14

  tags = {
    Name = "${var.project}-temporal"
  }
}

resource "aws_iam_role" "temporal_execution" {
  name               = "${var.project}-temporal-execution"
  assume_role_policy = data.aws_iam_policy_document.ecs_tasks_assume.json

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
  dockerhub_mirror = "${data.aws_caller_identity.current.account_id}.dkr.ecr.${local.region}.amazonaws.com/dockerhub"
  temporal_version = "1.30.1"
  temporal_port    = 7233
  rds_ca_path      = "/certs/rds-ca.pem"

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
    name = "certs"
  }

  container_definitions = jsonencode([
    {
      name       = "schema-setup"
      image      = "${local.dockerhub_mirror}/temporalio/admin-tools:${local.temporal_version}"
      essential  = false
      entryPoint = ["/bin/sh", "-c"]
      command = [join("\n", [
        "printf '%s' \"$RDS_CA\" > ${local.rds_ca_path}",
        file("${path.module}/../../temporal/scripts/setup-postgres.sh"),
      ])]

      environment = [
        { name = "POSTGRES_SEEDS", value = aws_db_instance.main.address },
        { name = "POSTGRES_USER", value = aws_db_instance.main.username },
        { name = "DB_PORT", value = tostring(aws_db_instance.main.port) },
        { name = "SQL_TLS", value = "true" },
        { name = "SQL_TLS_CA_FILE", value = local.rds_ca_path },
        { name = "RDS_CA", value = file("${path.module}/../../flowpay-be/certs/rds-ap-southeast-3-bundle.pem") },
      ]

      secrets = [
        { name = "SQL_PASSWORD", valueFrom = "${aws_db_instance.main.master_user_secret[0].secret_arn}:password::" },
      ]

      mountPoints      = [{ sourceVolume = "certs", containerPath = "/certs" }]
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
      ]

      secrets = [
        { name = "POSTGRES_PWD", valueFrom = "${aws_db_instance.main.master_user_secret[0].secret_arn}:password::" },
      ]

      mountPoints = [{ sourceVolume = "certs", containerPath = "/certs", readOnly = true }]

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
