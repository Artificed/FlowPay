data "terraform_remote_state" "foundation" {
  backend = "s3"

  config = {
    bucket = var.state_bucket
    key    = "foundation/terraform.tfstate"
    region = "ap-southeast-3"
  }
}

locals {
  foundation = data.terraform_remote_state.foundation.outputs

  region                     = local.foundation.region
  vpc_id                     = local.foundation.vpc_id
  private_subnet_ids         = local.foundation.private_subnet_ids
  public_subnet_ids          = local.foundation.public_subnet_ids
  endpoint_sg_id             = local.foundation.vpc_endpoint_security_group_id
  private_route_table_id     = local.foundation.private_route_table_id
  rds_security_group_id      = local.foundation.rds_security_group_id
  alb_security_group_id      = local.foundation.alb_security_group_id
  app_security_group_id      = local.foundation.app_security_group_id
  temporal_security_group_id = local.foundation.temporal_security_group_id
  api_certificate_arn        = local.foundation.api_certificate_arn
  zone_id                    = local.foundation.zone_id
  site_certificate_arn       = local.foundation.site_certificate_arn

  avatars_bucket_name                 = local.foundation.avatars_bucket_name
  avatars_bucket_arn                  = local.foundation.avatars_bucket_arn
  avatars_bucket_regional_domain_name = local.foundation.avatars_bucket_regional_domain_name
}
