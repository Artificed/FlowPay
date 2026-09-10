resource "aws_security_group" "alb" {
  name        = "${var.project}-alb"
  description = "Public ingress to the load balancer"
  vpc_id      = aws_vpc.main.id

  tags = {
    Name = "${var.project}-alb"
  }
}

resource "aws_vpc_security_group_ingress_rule" "alb_http" {
  security_group_id = aws_security_group.alb.id
  description       = "HTTP from anywhere"
  cidr_ipv4         = "0.0.0.0/0"
  from_port         = 80
  to_port           = 80
  ip_protocol       = "tcp"
}

resource "aws_vpc_security_group_ingress_rule" "alb_https" {
  security_group_id = aws_security_group.alb.id
  description       = "HTTPS from anywhere"
  cidr_ipv4         = "0.0.0.0/0"
  from_port         = 443
  to_port           = 443
  ip_protocol       = "tcp"
}

resource "aws_vpc_security_group_egress_rule" "alb_all" {
  security_group_id = aws_security_group.alb.id
  description       = "All outbound"
  cidr_ipv4         = "0.0.0.0/0"
  ip_protocol       = "-1"
}

resource "aws_security_group" "app" {
  name        = "${var.project}-app"
  description = "Backend tasks"
  vpc_id      = aws_vpc.main.id

  tags = {
    Name = "${var.project}-app"
  }
}

resource "aws_vpc_security_group_ingress_rule" "app_from_alb" {
  security_group_id            = aws_security_group.app.id
  description                  = "Backend port from the ALB"
  referenced_security_group_id = aws_security_group.alb.id
  from_port                    = var.backend_port
  to_port                      = var.backend_port
  ip_protocol                  = "tcp"
}

resource "aws_vpc_security_group_egress_rule" "app_all" {
  security_group_id = aws_security_group.app.id
  description       = "All outbound"
  cidr_ipv4         = "0.0.0.0/0"
  ip_protocol       = "-1"
}

resource "aws_security_group" "temporal" {
  name        = "${var.project}-temporal"
  description = "Temporal server"
  vpc_id      = aws_vpc.main.id

  tags = {
    Name = "${var.project}-temporal"
  }
}

resource "aws_vpc_security_group_ingress_rule" "temporal_from_app" {
  security_group_id            = aws_security_group.temporal.id
  description                  = "gRPC from the backend tasks"
  referenced_security_group_id = aws_security_group.app.id
  from_port                    = var.temporal_port
  to_port                      = var.temporal_port
  ip_protocol                  = "tcp"
}

resource "aws_vpc_security_group_egress_rule" "temporal_all" {
  security_group_id = aws_security_group.temporal.id
  description       = "All outbound"
  cidr_ipv4         = "0.0.0.0/0"
  ip_protocol       = "-1"
}

resource "aws_security_group" "rds" {
  name        = "${var.project}-rds"
  description = "Postgres"
  vpc_id      = aws_vpc.main.id

  tags = {
    Name = "${var.project}-rds"
  }
}

resource "aws_vpc_security_group_ingress_rule" "rds_from_app" {
  security_group_id            = aws_security_group.rds.id
  description                  = "Postgres from the backend tasks"
  referenced_security_group_id = aws_security_group.app.id
  from_port                    = 5432
  to_port                      = 5432
  ip_protocol                  = "tcp"
}

resource "aws_vpc_security_group_ingress_rule" "rds_from_temporal" {
  security_group_id            = aws_security_group.rds.id
  description                  = "Postgres from the Temporal server"
  referenced_security_group_id = aws_security_group.temporal.id
  from_port                    = 5432
  to_port                      = 5432
  ip_protocol                  = "tcp"
}

resource "aws_security_group" "vpc_endpoints" {
  name        = "${var.project}-vpc-endpoints"
  description = "Interface VPC endpoints"
  vpc_id      = aws_vpc.main.id

  tags = {
    Name = "${var.project}-vpc-endpoints"
  }
}

resource "aws_vpc_security_group_ingress_rule" "endpoints_from_app" {
  security_group_id            = aws_security_group.vpc_endpoints.id
  description                  = "HTTPS from the backend tasks"
  referenced_security_group_id = aws_security_group.app.id
  from_port                    = 443
  to_port                      = 443
  ip_protocol                  = "tcp"
}

resource "aws_vpc_security_group_ingress_rule" "endpoints_from_temporal" {
  security_group_id            = aws_security_group.vpc_endpoints.id
  description                  = "HTTPS from the Temporal server"
  referenced_security_group_id = aws_security_group.temporal.id
  from_port                    = 443
  to_port                      = 443
  ip_protocol                  = "tcp"
}
