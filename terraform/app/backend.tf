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
  name               = "${var.project}-backend-execution"
  assume_role_policy = data.aws_iam_policy_document.ecs_tasks_assume.json

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
  name               = "${var.project}-backend-task"
  assume_role_policy = data.aws_iam_policy_document.ecs_tasks_assume.json

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
