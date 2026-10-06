resource "aws_cloudwatch_log_group" "backend" {
  name              = "/ecs/${var.project}-backend"
  retention_in_days = 14

  tags = {
    Name = "${var.project}-backend"
  }
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
