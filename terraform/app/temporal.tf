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
