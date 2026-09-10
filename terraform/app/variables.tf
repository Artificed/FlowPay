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

variable "db_instance_class" {
  description = "RDS instance class."
  type        = string
  default     = "db.t4g.micro"
}

variable "db_allocated_storage" {
  description = "Storage in GB. 20 is the minimum for gp3."
  type        = number
  default     = 20
}

variable "db_engine_version" {
  description = "PostgreSQL major version, matching the compose stack."
  type        = string
  default     = "17"
}

variable "db_multi_az" {
  description = "Run a standby in a second AZ. Off because the stack is destroyed between demos."
  type        = bool
  default     = false
}
