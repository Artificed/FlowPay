data "aws_iam_policy_document" "ecs_tasks_assume" {
  statement {
    actions = ["sts:AssumeRole"]

    principals {
      type        = "Service"
      identifiers = ["ecs-tasks.amazonaws.com"]
    }

    condition {
      test     = "ArnLike"
      variable = "aws:SourceArn"
      values   = ["arn:aws:ecs:${local.region}:${data.aws_caller_identity.current.account_id}:*"]
    }
  }
}

resource "aws_ecs_cluster" "main" {
  name = var.project

  tags = {
    Name = var.project
  }
}
