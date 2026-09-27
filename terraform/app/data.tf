data "aws_caller_identity" "current" {}

data "aws_cloudfront_cache_policy" "optimized" {
  name = "Managed-CachingOptimized"
}

data "aws_route53_zone" "main" {
  zone_id = local.zone_id
}
