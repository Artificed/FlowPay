output "region" {
  description = "Region the foundation is built in."
  value       = var.region
}

output "vpc_id" {
  description = "VPC holding every FlowPay resource."
  value       = aws_vpc.main.id
}

output "vpc_cidr" {
  description = "CIDR block of the VPC."
  value       = aws_vpc.main.cidr_block
}

output "public_subnet_ids" {
  description = "Public subnet IDs, one per AZ."
  value       = aws_subnet.public[*].id
}

output "alb_security_group_id" {
  description = "Security group for the load balancer."
  value       = aws_security_group.alb.id
}

output "app_security_group_id" {
  description = "Security group for the backend tasks."
  value       = aws_security_group.app.id
}

output "temporal_security_group_id" {
  description = "Security group for the Temporal server."
  value       = aws_security_group.temporal.id
}

output "rds_security_group_id" {
  description = "Security group for the Postgres instance."
  value       = aws_security_group.rds.id
}

output "ecr_repository_urls" {
  description = "ECR repository URLs keyed by service."
  value       = { for k, v in aws_ecr_repository.this : k => v.repository_url }
}

output "private_subnet_ids" {
  description = "Private subnet IDs, one per AZ."
  value       = aws_subnet.private[*].id
}

output "private_route_table_id" {
  description = "Private route table, for the app layer to add a NAT route to when use_nat_gateway is set."
  value       = aws_route_table.private.id
}

output "vpc_endpoint_security_group_id" {
  description = "Security group for the interface endpoints built in the app layer."
  value       = aws_security_group.vpc_endpoints.id
}

output "zone_id" {
  description = "Route 53 hosted zone for the domain."
  value       = aws_route53_zone.main.zone_id
}

output "nameservers" {
  description = "Nameservers to set at the domain registrar."
  value       = aws_route53_zone.main.name_servers
}

output "api_certificate_arn" {
  description = "Issued ACM certificate for the API, in the foundation region."
  value       = aws_acm_certificate_validation.api.certificate_arn
}

output "site_certificate_arn" {
  description = "Issued ACM certificate for the site, in us-east-1 for CloudFront."
  value       = aws_acm_certificate_validation.site.certificate_arn
}

output "avatars_bucket_name" {
  description = "S3 bucket holding user avatars."
  value       = aws_s3_bucket.avatars.id
}

output "avatars_bucket_arn" {
  description = "ARN of the avatars bucket, for its bucket policy and the backend task role."
  value       = aws_s3_bucket.avatars.arn
}

output "avatars_bucket_regional_domain_name" {
  description = "Regional domain name of the avatars bucket, for the CloudFront origin."
  value       = aws_s3_bucket.avatars.bucket_regional_domain_name
}
