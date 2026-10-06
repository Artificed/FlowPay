resource "aws_cloudwatch_log_group" "backend" {
  name              = "/ecs/${var.project}-backend"
  retention_in_days = 14

  tags = {
    Name = "${var.project}-backend"
  }
}
