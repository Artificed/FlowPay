variable "region" {
  description = "AWS region."
  type        = string
  default     = "ap-southeast-3"
}

variable "project" {
  description = "Name prefix for every resource."
  type        = string
  default     = "flowpay"
}

variable "vpc_cidr" {
  description = "CIDR block for the VPC."
  type        = string
  default     = "10.0.0.0/16"
}

variable "azs" {
  description = "Availability zones to spread the public subnets across."
  type        = list(string)
  default     = ["ap-southeast-3a", "ap-southeast-3b"]
}

variable "backend_port" {
  description = "Port the backend container listens on."
  type        = number
  default     = 8080
}

variable "temporal_port" {
  description = "Port the Temporal frontend service listens on."
  type        = number
  default     = 7233
}

variable "domain" {
  description = "Domain the site and API are served under."
  type        = string
  default     = "flowpay.my.id"
}
