resource "aws_iam_openid_connect_provider" "github_actions" {
  url            = "https://token.actions.githubusercontent.com"
  client_id_list = ["sts.amazonaws.com"]

  tags = {
    Name = "github-actions"
  }
}

data "aws_iam_policy_document" "github_actions_assume" {
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
      values   = ["repo:Artificed/FlowPay:ref:refs/heads/main"]
    }
  }
}

resource "aws_iam_role" "github_ecr_push" {
  name               = "${var.project}-github-ecr-push"
  assume_role_policy = data.aws_iam_policy_document.github_actions_assume.json

  tags = {
    Name = "${var.project}-github-ecr-push"
  }
}

data "aws_iam_policy_document" "github_ecr_push" {
  statement {
    actions   = ["ecr:GetAuthorizationToken"]
    resources = ["*"]
  }

  statement {
    actions = [
      "ecr:BatchCheckLayerAvailability",
      "ecr:InitiateLayerUpload",
      "ecr:UploadLayerPart",
      "ecr:CompleteLayerUpload",
      "ecr:PutImage",
      "ecr:BatchGetImage",
      "ecr:DescribeImages",
    ]
    resources = [aws_ecr_repository.this["backend"].arn]
  }
}

resource "aws_iam_role_policy" "github_ecr_push" {
  name   = "ecr-push"
  role   = aws_iam_role.github_ecr_push.id
  policy = data.aws_iam_policy_document.github_ecr_push.json
}

resource "aws_iam_role" "github_frontend_upload" {
  name               = "${var.project}-github-frontend-upload"
  assume_role_policy = data.aws_iam_policy_document.github_actions_assume.json

  tags = {
    Name = "${var.project}-github-frontend-upload"
  }
}

locals {
  frontend_bucket_arn = "arn:aws:s3:::${var.project}-frontend-${data.aws_caller_identity.current.account_id}"
}

data "aws_iam_policy_document" "github_frontend_upload" {
  statement {
    actions   = ["s3:ListBucket"]
    resources = [local.frontend_bucket_arn]
  }

  statement {
    actions   = ["s3:PutObject"]
    resources = ["${local.frontend_bucket_arn}/*"]
  }
}

resource "aws_iam_role_policy" "github_frontend_upload" {
  name   = "frontend-upload"
  role   = aws_iam_role.github_frontend_upload.id
  policy = data.aws_iam_policy_document.github_frontend_upload.json
}
