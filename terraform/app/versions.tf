terraform {
  required_version = ">= 1.10"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 6.0"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.7"
    }
  }

  backend "s3" {
    bucket       = "flowpay-tfstate-422661068405"
    key          = "app/terraform.tfstate"
    region       = "ap-southeast-3"
    encrypt      = true
    use_lockfile = true
  }
}

provider "aws" {
  region = local.region

  default_tags {
    tags = {
      Project   = var.project
      Layer     = "app"
      ManagedBy = "terraform"
    }
  }
}
