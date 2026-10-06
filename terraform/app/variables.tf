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

variable "restore_from_snapshot" {
  description = "Build the database from its newest manual snapshot. Set to false for the first apply in an account with no snapshot yet."
  type        = bool
  default     = true
}

variable "alb_idle_timeout" {
  description = "Seconds an idle connection is held open. High for the SSE stream endpoint."
  type        = number
  default     = 4000
}

variable "backend_port" {
  description = "Port the backend container listens on."
  type        = number
  default     = 8080
}

variable "backend_image_tag" {
  description = "Tag of the flowpay-backend image to run, named after the git commit it was built from."
  type        = string
}

variable "cloudfront_price_class" {
  description = "Which edge locations to use. All is the full network."
  type        = string
  default     = "PriceClass_All"
}
