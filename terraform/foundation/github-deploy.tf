data "aws_iam_policy_document" "github_actions_deploy_assume" {
  statement {
    actions = ["sts:AssumeRoleWithWebIdentity"]

    principals {
      type        = "Federated"
      identifiers = [aws_iam_openid_connect_provider.github_actions.arn]
    }

    condition {
      test     = "StringEquals"
      variable = "token.actions.githubusercontent.com:aud"
      values   = ["sts.amazonaws.com"]
    }

    condition {
      test     = "StringEquals"
      variable = "token.actions.githubusercontent.com:sub"
      values   = ["repo:Artificed/FlowPay:environment:production"]
    }
  }
}

resource "aws_iam_role" "github_deploy" {
  name               = "${var.project}-github-deploy"
  assume_role_policy = data.aws_iam_policy_document.github_actions_deploy_assume.json

  tags = {
    Name = "${var.project}-github-deploy"
  }
}

locals {
  account_id = data.aws_caller_identity.current.account_id
}

data "aws_iam_policy_document" "app_role_boundary" {
  statement {
    actions   = ["ecr:GetAuthorizationToken"]
    resources = ["*"]
  }

  statement {
    actions = ["ecr:BatchGetImage", "ecr:GetDownloadUrlForLayer"]
    resources = [
      aws_ecr_repository.this["backend"].arn,
      "arn:aws:ecr:${var.region}:${local.account_id}:repository/dockerhub/*",
    ]
  }

  statement {
    actions   = ["ecr:BatchImportUpstreamImage", "ecr:CreateRepository"]
    resources = ["arn:aws:ecr:${var.region}:${local.account_id}:repository/dockerhub/*"]
  }

  statement {
    actions   = ["logs:CreateLogStream", "logs:PutLogEvents"]
    resources = ["arn:aws:logs:${var.region}:${local.account_id}:log-group:/ecs/${var.project}-*"]
  }

  statement {
    actions = ["secretsmanager:GetSecretValue"]
    resources = [
      "arn:aws:secretsmanager:${var.region}:${local.account_id}:secret:rds!db-*",
      "arn:aws:secretsmanager:${var.region}:${local.account_id}:secret:${var.project}-*",
    ]
  }

  statement {
    actions   = ["s3:PutObject", "s3:DeleteObject"]
    resources = ["${aws_s3_bucket.avatars.arn}/avatars/*"]
  }
}

resource "aws_iam_policy" "app_role_boundary" {
  name   = "${var.project}-app-role-boundary"
  policy = data.aws_iam_policy_document.app_role_boundary.json

  tags = {
    Name = "${var.project}-app-role-boundary"
  }
}
