variable "project" {
  description = "Name prefix for every resource."
  type        = string
  default     = "flowpay"
}

variable "state_bucket" {
  description = "S3 bucket holding the foundation layer's state."
  type        = string
  default     = "flowpay-tfstate-422661068405"
}

variable "use_nat_gateway" {
  description = "Route private subnet egress through a NAT gateway instead of relying on VPC endpoints."
  type        = bool
  default     = false
}
