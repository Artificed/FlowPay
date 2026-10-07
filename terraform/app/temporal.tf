resource "aws_cloudwatch_log_group" "temporal" {
  name              = "/ecs/${var.project}-temporal"
  retention_in_days = 14

  tags = {
    Name = "${var.project}-temporal"
  }
}
