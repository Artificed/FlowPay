resource "aws_cloudwatch_event_rule" "password_rotated" {
  name = "${var.project}-password-rotated"

  event_pattern = jsonencode({
    source        = ["aws.secretsmanager"]
    "detail-type" = ["Secret Label Updated"]
    resources     = [aws_db_instance.main.master_user_secret[0].secret_arn]
    detail        = { labelUpdated = ["AWSCURRENT"] }
  })

  tags = {
    Name = "${var.project}-password-rotated"
  }
}

locals {
  restart_services = {
    StartAt = "RestartBackend"
    States = {
      RestartBackend = {
        Type     = "Task"
        Resource = "arn:aws:states:::aws-sdk:ecs:updateService"
        Parameters = {
          Cluster            = aws_ecs_cluster.main.name
          Service            = aws_ecs_service.backend.name
          ForceNewDeployment = true
        }
        Next = "RestartTemporal"
      }
      RestartTemporal = {
        Type     = "Task"
        Resource = "arn:aws:states:::aws-sdk:ecs:updateService"
        Parameters = {
          Cluster            = aws_ecs_cluster.main.name
          Service            = aws_ecs_service.temporal.name
          ForceNewDeployment = true
        }
        End = true
      }
    }
  }
}

data "aws_iam_policy_document" "restart_services_assume" {
  statement {
    actions = ["sts:AssumeRole"]

    principals {
      type        = "Service"
      identifiers = ["states.amazonaws.com"]
    }

    condition {
      test     = "ArnLike"
      variable = "aws:SourceArn"
      values   = ["arn:aws:states:${local.region}:${data.aws_caller_identity.current.account_id}:stateMachine:${var.project}-restart-services"]
    }
  }
}

resource "aws_iam_role" "restart_services" {
  name                 = "${var.project}-restart-services"
  permissions_boundary = local.app_role_boundary_arn
  assume_role_policy   = data.aws_iam_policy_document.restart_services_assume.json

  tags = {
    Name = "${var.project}-restart-services"
  }
}

data "aws_iam_policy_document" "restart_services" {
  statement {
    actions   = ["ecs:UpdateService"]
    resources = [aws_ecs_service.backend.id, aws_ecs_service.temporal.id]
  }
}

resource "aws_iam_role_policy" "restart_services" {
  name   = "restart-services"
  role   = aws_iam_role.restart_services.id
  policy = data.aws_iam_policy_document.restart_services.json
}

resource "aws_sfn_state_machine" "restart_services" {
  name       = "${var.project}-restart-services"
  role_arn   = aws_iam_role.restart_services.arn
  definition = jsonencode(local.restart_services)

  tags = {
    Name = "${var.project}-restart-services"
  }
}

data "aws_iam_policy_document" "restart_trigger_assume" {
  statement {
    actions = ["sts:AssumeRole"]

    principals {
      type        = "Service"
      identifiers = ["events.amazonaws.com"]
    }

    condition {
      test     = "ArnEquals"
      variable = "aws:SourceArn"
      values   = [aws_cloudwatch_event_rule.password_rotated.arn]
    }
  }
}

resource "aws_iam_role" "restart_trigger" {
  name                 = "${var.project}-restart-trigger"
  permissions_boundary = local.app_role_boundary_arn
  assume_role_policy   = data.aws_iam_policy_document.restart_trigger_assume.json

  tags = {
    Name = "${var.project}-restart-trigger"
  }
}

data "aws_iam_policy_document" "restart_trigger" {
  statement {
    actions   = ["states:StartExecution"]
    resources = [aws_sfn_state_machine.restart_services.arn]
  }
}

resource "aws_iam_role_policy" "restart_trigger" {
  name   = "start-restart"
  role   = aws_iam_role.restart_trigger.id
  policy = data.aws_iam_policy_document.restart_trigger.json
}

resource "aws_cloudwatch_event_target" "restart_services" {
  rule     = aws_cloudwatch_event_rule.password_rotated.name
  arn      = aws_sfn_state_machine.restart_services.arn
  role_arn = aws_iam_role.restart_trigger.arn
}
