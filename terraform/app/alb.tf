resource "aws_lb" "main" {
  name               = var.project
  load_balancer_type = "application"
  subnets            = local.public_subnet_ids
  security_groups    = [local.alb_security_group_id]
  idle_timeout       = var.alb_idle_timeout

  tags = {
    Name = var.project
  }
}

resource "aws_lb_target_group" "backend" {
  name        = "${var.project}-backend"
  port        = var.backend_port
  protocol    = "HTTP"
  vpc_id      = local.vpc_id
  target_type = "ip"

  health_check {
    path                = "/api/health"
    matcher             = "200"
    interval            = 30
    timeout             = 5
    healthy_threshold   = 2
    unhealthy_threshold = 3
  }

  deregistration_delay = 30

  tags = {
    Name = "${var.project}-backend"
  }
}

resource "aws_lb_listener" "https" {
  load_balancer_arn = aws_lb.main.arn
  port              = 443
  protocol          = "HTTPS"
  certificate_arn   = local.api_certificate_arn
  ssl_policy        = "ELBSecurityPolicy-TLS13-1-2-2021-06"

  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.backend.arn
  }
}
