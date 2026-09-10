resource "aws_ecr_repository" "this" {
  for_each = toset(["backend", "frontend"])

  name                 = "${var.project}-${each.key}"
  image_tag_mutability = "IMMUTABLE"
  force_delete         = false

  image_scanning_configuration {
    scan_on_push = true
  }

  tags = {
    Name = "${var.project}-${each.key}"
  }
}

resource "aws_ecr_lifecycle_policy" "this" {
  for_each = aws_ecr_repository.this

  repository = each.value.name

  policy = jsonencode({
    rules = [{
      rulePriority = 1
      description  = "Keep the 10 most recent images"
      selection = {
        tagStatus   = "any"
        countType   = "imageCountMoreThan"
        countNumber = 10
      }
      action = {
        type = "expire"
      }
    }]
  })
}

resource "aws_secretsmanager_secret" "dockerhub" {
  name                    = "ecr-pullthroughcache/${var.project}-dockerhub"
  description             = "Docker Hub credentials for the ECR pull-through cache"
  recovery_window_in_days = 0

  tags = {
    Name = "${var.project}-dockerhub"
  }
}

resource "aws_secretsmanager_secret_version" "dockerhub" {
  secret_id = aws_secretsmanager_secret.dockerhub.id

  secret_string = jsonencode({
    username    = "placeholder"
    accessToken = "placeholder"
  })

  lifecycle {
    ignore_changes = [secret_string]
  }
}

resource "aws_ecr_pull_through_cache_rule" "dockerhub" {
  ecr_repository_prefix = "dockerhub"
  upstream_registry_url = "registry-1.docker.io"
  credential_arn        = aws_secretsmanager_secret.dockerhub.arn
}
