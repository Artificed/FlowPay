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
  account_id       = data.aws_caller_identity.current.account_id
  state_bucket_arn = "arn:aws:s3:::${var.project}-tfstate-${local.account_id}"

  app_role_arns = [
    "arn:aws:iam::${local.account_id}:role/${var.project}-backend-*",
    "arn:aws:iam::${local.account_id}:role/${var.project}-temporal-*",
  ]
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

data "aws_iam_policy_document" "github_deploy_network" {
  statement {
    sid = "ReadNetwork"
    actions = [
      "cloudfront:GetCachePolicy",
      "cloudfront:ListCachePolicies",
      "ec2:DescribeAccountAttributes",
      "ec2:DescribeAvailabilityZones",
      "ec2:DescribeInternetGateways",
      "ec2:DescribeNetworkInterfaces",
      "ec2:DescribePrefixLists",
      "ec2:DescribeRegions",
      "ec2:DescribeSecurityGroups",
      "ec2:DescribeSubnets",
      "ec2:DescribeVpcEndpoints",
      "ec2:DescribeVpcs",
      "ec2:GetSecurityGroupsForVpc",
      "elasticloadbalancing:DescribeCapacityReservation",
      "elasticloadbalancing:DescribeListenerAttributes",
      "elasticloadbalancing:DescribeListeners",
      "elasticloadbalancing:DescribeLoadBalancerAttributes",
      "elasticloadbalancing:DescribeLoadBalancers",
      "elasticloadbalancing:DescribeTags",
      "elasticloadbalancing:DescribeTargetGroupAttributes",
      "elasticloadbalancing:DescribeTargetGroups",
      "route53:ListHostedZonesByName",
      "servicediscovery:GetOperation",
      "servicediscovery:ListTagsForResource",
    ]
    resources = ["*"]
  }

  statement {
    sid     = "CreateInterfaceEndpoints"
    actions = ["ec2:CreateVpcEndpoint"]
    resources = concat(
      [
        aws_vpc.main.arn,
        aws_security_group.vpc_endpoints.arn,
        "arn:aws:ec2:${var.region}:${local.account_id}:vpc-endpoint/*",
      ],
      aws_subnet.private[*].arn,
    )
  }

  statement {
    sid       = "TagNewEndpoints"
    actions   = ["ec2:CreateTags"]
    resources = ["arn:aws:ec2:${var.region}:${local.account_id}:vpc-endpoint/*"]

    condition {
      test     = "StringEquals"
      variable = "ec2:CreateAction"
      values   = ["CreateVpcEndpoint"]
    }
  }

  statement {
    sid       = "DeleteAppEndpoints"
    actions   = ["ec2:DeleteVpcEndpoints"]
    resources = ["arn:aws:ec2:${var.region}:${local.account_id}:vpc-endpoint/*"]

    condition {
      test     = "StringEquals"
      variable = "aws:ResourceTag/Layer"
      values   = ["app"]
    }
  }

  statement {
    sid = "LoadBalancer"
    actions = [
      "elasticloadbalancing:AddTags",
      "elasticloadbalancing:CreateListener",
      "elasticloadbalancing:CreateLoadBalancer",
      "elasticloadbalancing:DeleteLoadBalancer",
      "elasticloadbalancing:ModifyLoadBalancerAttributes",
    ]
    resources = ["arn:aws:elasticloadbalancing:${var.region}:${local.account_id}:loadbalancer/app/${var.project}/*"]
  }

  statement {
    sid = "TargetGroup"
    actions = [
      "elasticloadbalancing:AddTags",
      "elasticloadbalancing:CreateTargetGroup",
      "elasticloadbalancing:DeleteTargetGroup",
      "elasticloadbalancing:ModifyTargetGroup",
      "elasticloadbalancing:ModifyTargetGroupAttributes",
    ]
    resources = ["arn:aws:elasticloadbalancing:${var.region}:${local.account_id}:targetgroup/${var.project}-*/*"]
  }

  statement {
    sid = "Listener"
    actions = [
      "elasticloadbalancing:AddTags",
      "elasticloadbalancing:DeleteListener",
      "elasticloadbalancing:ModifyListener",
    ]
    resources = ["arn:aws:elasticloadbalancing:${var.region}:${local.account_id}:listener/app/${var.project}/*"]
  }

  statement {
    sid = "ReadZones"
    actions = [
      "route53:GetHostedZone",
      "route53:ListResourceRecordSets",
      "route53:ListTagsForResource",
    ]
    resources = ["arn:aws:route53:::hostedzone/*"]
  }

  statement {
    sid       = "WaitForDnsChanges"
    actions   = ["route53:GetChange"]
    resources = ["arn:aws:route53:::change/*"]
  }

  statement {
    sid       = "AppRecords"
    actions   = ["route53:ChangeResourceRecordSets"]
    resources = ["arn:aws:route53:::hostedzone/*"]

    condition {
      test     = "ForAllValues:StringEquals"
      variable = "route53:ChangeResourceRecordSetsNormalizedRecordNames"
      values   = [var.domain, "api.${var.domain}", "${var.project}.local"]
    }
  }

  statement {
    sid       = "CloudMapZone"
    actions   = ["route53:CreateHostedZone", "route53:DeleteHostedZone"]
    resources = ["*"]
  }

  statement {
    sid       = "KeepPublicZone"
    effect    = "Deny"
    actions   = ["route53:DeleteHostedZone"]
    resources = [aws_route53_zone.main.arn]
  }

  statement {
    sid       = "CreateNamespace"
    actions   = ["servicediscovery:CreatePrivateDnsNamespace", "servicediscovery:TagResource"]
    resources = ["*"]
  }

  statement {
    sid = "Namespace"
    actions = [
      "servicediscovery:CreateService",
      "servicediscovery:DeleteNamespace",
      "servicediscovery:GetNamespace",
    ]
    resources = ["arn:aws:servicediscovery:${var.region}:${local.account_id}:namespace/*"]
  }

  statement {
    sid = "DiscoveryService"
    actions = [
      "servicediscovery:CreateService",
      "servicediscovery:DeleteService",
      "servicediscovery:DeregisterInstance",
      "servicediscovery:GetService",
      "servicediscovery:ListInstances",
    ]
    resources = ["arn:aws:servicediscovery:${var.region}:${local.account_id}:service/*"]
  }

  statement {
    sid       = "CreateDistribution"
    actions   = ["cloudfront:CreateDistribution", "cloudfront:CreateOriginAccessControl"]
    resources = ["*"]
  }

  statement {
    sid = "Distribution"
    actions = [
      "cloudfront:DeleteDistribution",
      "cloudfront:GetDistribution",
      "cloudfront:ListTagsForResource",
      "cloudfront:TagResource",
      "cloudfront:UpdateDistribution",
    ]
    resources = ["arn:aws:cloudfront::${local.account_id}:distribution/*"]
  }

  statement {
    sid = "OriginAccessControl"
    actions = [
      "cloudfront:DeleteOriginAccessControl",
      "cloudfront:GetOriginAccessControl",
      "cloudfront:UpdateOriginAccessControl",
    ]
    resources = ["arn:aws:cloudfront::${local.account_id}:origin-access-control/*"]
  }
}

data "aws_iam_policy_document" "github_deploy_containers" {
  statement {
    sid = "Cluster"
    actions = [
      "ecs:CreateCluster",
      "ecs:DeleteCluster",
      "ecs:DescribeClusters",
      "ecs:TagResource",
    ]
    resources = ["arn:aws:ecs:${var.region}:${local.account_id}:cluster/${var.project}"]
  }

  statement {
    sid = "Services"
    actions = [
      "ecs:CreateService",
      "ecs:DeleteService",
      "ecs:DescribeServices",
      "ecs:TagResource",
      "ecs:UpdateService",
    ]
    resources = ["arn:aws:ecs:${var.region}:${local.account_id}:service/${var.project}/*"]
  }

  statement {
    sid       = "RegisterTaskDefinitions"
    actions   = ["ecs:RegisterTaskDefinition", "ecs:TagResource"]
    resources = ["arn:aws:ecs:${var.region}:${local.account_id}:task-definition/${var.project}-*"]
  }

  statement {
    sid       = "TaskDefinitions"
    actions   = ["ecs:DeregisterTaskDefinition", "ecs:DescribeTaskDefinition"]
    resources = ["*"]
  }

  statement {
    sid       = "PassAppRolesToTasks"
    actions   = ["iam:PassRole"]
    resources = local.app_role_arns

    condition {
      test     = "StringEquals"
      variable = "iam:PassedToService"
      values   = ["ecs-tasks.amazonaws.com"]
    }
  }

  statement {
    sid = "AppRolesWithinBoundary"
    actions = [
      "iam:CreateRole",
      "iam:DeleteRole",
      "iam:DeleteRolePolicy",
      "iam:PutRolePolicy",
      "iam:UpdateAssumeRolePolicy",
    ]
    resources = local.app_role_arns

    condition {
      test     = "StringEquals"
      variable = "iam:PermissionsBoundary"
      values   = [aws_iam_policy.app_role_boundary.arn]
    }
  }

  statement {
    sid = "ReadAndTagAppRoles"
    actions = [
      "iam:GetRole",
      "iam:GetRolePolicy",
      "iam:ListAttachedRolePolicies",
      "iam:ListInstanceProfilesForRole",
      "iam:ListRolePolicies",
      "iam:TagRole",
      "iam:UntagRole",
    ]
    resources = local.app_role_arns
  }

  statement {
    sid = "LogGroups"
    actions = [
      "logs:CreateLogGroup",
      "logs:DeleteLogGroup",
      "logs:ListTagsForResource",
      "logs:PutRetentionPolicy",
      "logs:TagLogGroup",
      "logs:TagResource",
    ]
    resources = ["arn:aws:logs:${var.region}:${local.account_id}:log-group:/ecs/${var.project}-*"]
  }

  statement {
    sid       = "ReadLogGroups"
    actions   = ["logs:DescribeLogGroups"]
    resources = ["*"]
  }

  statement {
    sid = "ReadBackendImages"
    actions = [
      "ecr:DescribeImages",
      "ecr:DescribeRepositories",
      "ecr:ListTagsForResource",
    ]
    resources = [aws_ecr_repository.this["backend"].arn]
  }
}

data "aws_kms_alias" "secretsmanager" {
  name = "alias/aws/secretsmanager"
}

data "aws_iam_policy_document" "github_deploy_data" {
  statement {
    sid       = "StateBucket"
    actions   = ["s3:ListBucket"]
    resources = [local.state_bucket_arn]
  }

  statement {
    sid     = "AppState"
    actions = ["s3:GetObject", "s3:PutObject"]
    resources = [
      "${local.state_bucket_arn}/app/terraform.tfstate",
      "${local.state_bucket_arn}/app/terraform.tfstate.tflock",
    ]
  }

  statement {
    sid       = "AppStateLock"
    actions   = ["s3:DeleteObject"]
    resources = ["${local.state_bucket_arn}/app/terraform.tfstate.tflock"]
  }

  statement {
    sid       = "FoundationOutputs"
    actions   = ["s3:GetObject"]
    resources = ["${local.state_bucket_arn}/foundation/terraform.tfstate"]
  }

  statement {
    sid = "FrontendBucket"
    actions = [
      "s3:CreateBucket",
      "s3:DeleteBucket",
      "s3:DeleteBucketPolicy",
      "s3:GetAccelerateConfiguration",
      "s3:GetBucketAcl",
      "s3:GetBucketCORS",
      "s3:GetBucketLogging",
      "s3:GetBucketObjectLockConfiguration",
      "s3:GetBucketPolicy",
      "s3:GetBucketPublicAccessBlock",
      "s3:GetBucketRequestPayment",
      "s3:GetBucketVersioning",
      "s3:GetBucketWebsite",
      "s3:GetEncryptionConfiguration",
      "s3:GetLifecycleConfiguration",
      "s3:GetReplicationConfiguration",
      "s3:ListBucket",
      "s3:ListBucketVersions",
      "s3:ListTagsForResource",
      "s3:PutBucketPolicy",
      "s3:PutBucketPublicAccessBlock",
      "s3:PutEncryptionConfiguration",
      "s3:TagResource",
    ]
    resources = [local.frontend_bucket_arn]
  }

  statement {
    sid       = "EmptyFrontendBucket"
    actions   = ["s3:DeleteObject", "s3:DeleteObjectVersion"]
    resources = ["${local.frontend_bucket_arn}/*"]
  }

  statement {
    sid = "AvatarsBucketPolicy"
    actions = [
      "s3:DeleteBucketPolicy",
      "s3:GetBucketPolicy",
      "s3:PutBucketPolicy",
    ]
    resources = [aws_s3_bucket.avatars.arn]
  }

  statement {
    sid = "Database"
    actions = [
      "rds:AddTagsToResource",
      "rds:CreateDBSnapshot",
      "rds:CreateDBSubnetGroup",
      "rds:DeleteDBInstance",
      "rds:DeleteDBSubnetGroup",
      "rds:ListTagsForResource",
      "rds:ModifyDBInstance",
      "rds:ModifyDBSubnetGroup",
      "rds:RestoreDBInstanceFromDBSnapshot",
    ]
    resources = [
      "arn:aws:rds:${var.region}:${local.account_id}:db:${var.project}",
      "arn:aws:rds:${var.region}:${local.account_id}:snapshot:${var.project}-final*",
      "arn:aws:rds:${var.region}:${local.account_id}:subgrp:${var.project}",
    ]
  }

  statement {
    sid = "ReadDatabases"
    actions = [
      "rds:DescribeDBInstances",
      "rds:DescribeDBSnapshots",
      "rds:DescribeDBSubnetGroups",
    ]
    resources = ["*"]
  }

  statement {
    sid       = "DatabasePasswordSecret"
    actions   = ["secretsmanager:CreateSecret", "secretsmanager:TagResource"]
    resources = ["arn:aws:secretsmanager:${var.region}:${local.account_id}:secret:rds!db-*"]
  }

  statement {
    sid       = "DatabasePasswordKey"
    actions   = ["kms:DescribeKey"]
    resources = [data.aws_kms_alias.secretsmanager.target_key_arn]
  }

  statement {
    sid = "JwtSecret"
    actions = [
      "secretsmanager:CreateSecret",
      "secretsmanager:DeleteSecret",
      "secretsmanager:DescribeSecret",
      "secretsmanager:GetResourcePolicy",
      "secretsmanager:ListSecretVersionIds",
      "secretsmanager:PutSecretValue",
      "secretsmanager:TagResource",
    ]
    resources = ["arn:aws:secretsmanager:${var.region}:${local.account_id}:secret:${var.project}-jwt-secret-*"]
  }
}

locals {
  github_deploy_policies = {
    network    = data.aws_iam_policy_document.github_deploy_network.json
    containers = data.aws_iam_policy_document.github_deploy_containers.json
    data       = data.aws_iam_policy_document.github_deploy_data.json
  }
}

resource "aws_iam_policy" "github_deploy" {
  for_each = local.github_deploy_policies

  name   = "${var.project}-github-deploy-${each.key}"
  policy = each.value

  tags = {
    Name = "${var.project}-github-deploy-${each.key}"
  }
}

resource "aws_iam_role_policy_attachment" "github_deploy" {
  for_each = aws_iam_policy.github_deploy

  role       = aws_iam_role.github_deploy.name
  policy_arn = each.value.arn
}
