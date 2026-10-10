locals {
  site_url = "https://${data.aws_route53_zone.main.name}"
}

data "aws_ecr_repository" "backend" {
  name = "${var.project}-backend"
}

ephemeral "random_password" "jwt_secret" {
  length = 64
}

resource "aws_secretsmanager_secret" "jwt" {
  name                    = "${var.project}-jwt-secret"
  recovery_window_in_days = 0

  tags = {
    Name = "${var.project}-jwt-secret"
  }
}

resource "aws_secretsmanager_secret_version" "jwt" {
  secret_id                = aws_secretsmanager_secret.jwt.id
  secret_string_wo         = ephemeral.random_password.jwt_secret.result
  secret_string_wo_version = 1
}

resource "aws_cloudwatch_log_group" "backend" {
  name              = "/ecs/${var.project}-backend"
  retention_in_days = 14

  tags = {
    Name = "${var.project}-backend"
  }
}

resource "aws_iam_role" "backend_execution" {
  name                 = "${var.project}-backend-execution"
  permissions_boundary = local.app_role_boundary_arn
  assume_role_policy   = data.aws_iam_policy_document.ecs_tasks_assume.json

  tags = {
    Name = "${var.project}-backend-execution"
  }
}

data "aws_iam_policy_document" "backend_execution" {
  statement {
    actions   = ["ecr:GetAuthorizationToken"]
    resources = ["*"]
  }

  statement {
    actions   = ["ecr:BatchGetImage", "ecr:GetDownloadUrlForLayer"]
    resources = [data.aws_ecr_repository.backend.arn]
  }

  statement {
    actions   = ["logs:CreateLogStream", "logs:PutLogEvents"]
    resources = ["${aws_cloudwatch_log_group.backend.arn}:*"]
  }

  statement {
    actions = ["secretsmanager:GetSecretValue"]
    resources = [
      aws_db_instance.main.master_user_secret[0].secret_arn,
      aws_secretsmanager_secret.jwt.arn,
    ]
  }
}

resource "aws_iam_role_policy" "backend_execution" {
  name   = "start-task"
  role   = aws_iam_role.backend_execution.id
  policy = data.aws_iam_policy_document.backend_execution.json
}

resource "aws_iam_role" "backend_task" {
  name                 = "${var.project}-backend-task"
  permissions_boundary = local.app_role_boundary_arn
  assume_role_policy   = data.aws_iam_policy_document.ecs_tasks_assume.json

  tags = {
    Name = "${var.project}-backend-task"
  }
}

data "aws_iam_policy_document" "backend_task" {
  statement {
    actions   = ["s3:PutObject", "s3:DeleteObject"]
    resources = ["${local.avatars_bucket_arn}/avatars/*"]
  }
}

resource "aws_iam_role_policy" "backend_task" {
  name   = "avatars"
  role   = aws_iam_role.backend_task.id
  policy = data.aws_iam_policy_document.backend_task.json
}

resource "aws_ecs_task_definition" "backend" {
  family                   = "${var.project}-backend"
  requires_compatibilities = ["FARGATE"]
  network_mode             = "awsvpc"
  cpu                      = 256
  memory                   = 512
  execution_role_arn       = aws_iam_role.backend_execution.arn
  task_role_arn            = aws_iam_role.backend_task.arn

  runtime_platform {
    operating_system_family = "LINUX"
    cpu_architecture        = "ARM64"
  }

  container_definitions = jsonencode([{
    name      = "backend"
    image     = "${data.aws_ecr_repository.backend.repository_url}:${var.backend_image_tag}"
    essential = true

    portMappings = [{
      containerPort = var.backend_port
    }]

    environment = [
      { name = "GIN_MODE", value = "release" },
      { name = "PORT", value = tostring(var.backend_port) },
      { name = "DB_HOST", value = aws_db_instance.main.address },
      { name = "DB_PORT", value = tostring(aws_db_instance.main.port) },
      { name = "DB_NAME", value = aws_db_instance.main.db_name },
      { name = "DB_USER", value = aws_db_instance.main.username },
      { name = "DB_SSLMODE", value = "verify-full" },
      { name = "DB_SSLROOTCERT", value = "/app/certs/rds-ap-southeast-3-bundle.pem" },
      { name = "TEMPORAL_ADDRESS", value = "${aws_service_discovery_service.temporal.name}.${aws_service_discovery_private_dns_namespace.main.name}:${local.temporal_port}" },
      { name = "CORS_ORIGINS", value = local.site_url },
      { name = "STORAGE_ENDPOINT", value = "s3.${local.region}.amazonaws.com" },
      { name = "STORAGE_REGION", value = local.region },
      { name = "STORAGE_USE_SSL", value = "true" },
      { name = "STORAGE_BUCKET", value = local.avatars_bucket_name },
      { name = "STORAGE_PUBLIC_URL", value = local.site_url },
      { name = "STORAGE_ENSURE_BUCKET", value = "false" },
    ]

    secrets = [
      { name = "DB_PASSWORD", valueFrom = "${aws_db_instance.main.master_user_secret[0].secret_arn}:password::" },
      { name = "JWT_SECRET", valueFrom = aws_secretsmanager_secret.jwt.arn },
    ]

    logConfiguration = {
      logDriver = "awslogs"
      options = {
        awslogs-group         = aws_cloudwatch_log_group.backend.name
        awslogs-region        = local.region
        awslogs-stream-prefix = "ecs"
      }
    }
  }])

  tags = {
    Name = "${var.project}-backend"
  }
}

resource "aws_ecs_service" "backend" {
  name            = "${var.project}-backend"
  cluster         = aws_ecs_cluster.main.id
  task_definition = aws_ecs_task_definition.backend.arn
  desired_count   = 1
  launch_type     = "FARGATE"

  network_configuration {
    subnets          = local.private_subnet_ids
    security_groups  = [local.app_security_group_id]
    assign_public_ip = false
  }

  load_balancer {
    target_group_arn = aws_lb_target_group.backend.arn
    container_name   = "backend"
    container_port   = var.backend_port
  }

  health_check_grace_period_seconds = 360

  deployment_circuit_breaker {
    enable   = true
    rollback = true
  }

  tags = {
    Name = "${var.project}-backend"
  }

  depends_on = [aws_lb_listener.https, aws_vpc_endpoint.interface]
}
