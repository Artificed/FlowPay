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

  region                 = local.foundation.region
  vpc_id                 = local.foundation.vpc_id
  private_subnet_ids     = local.foundation.private_subnet_ids
  public_subnet_ids      = local.foundation.public_subnet_ids
  endpoint_sg_id         = local.foundation.vpc_endpoint_security_group_id
  private_route_table_id = local.foundation.private_route_table_id
}
