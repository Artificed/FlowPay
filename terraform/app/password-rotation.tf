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
