resource "aws_db_subnet_group" "main" {
  name       = var.project
  subnet_ids = local.private_subnet_ids

  tags = {
    Name = var.project
  }
}

data "aws_db_snapshot" "latest" {
  count = var.restore_from_snapshot ? 1 : 0

  db_instance_identifier = var.project
  snapshot_type          = "manual"
  most_recent            = true
}

resource "aws_db_instance" "main" {
  identifier     = var.project
  engine         = "postgres"
  engine_version = var.db_engine_version
  instance_class = var.db_instance_class

  allocated_storage     = var.db_allocated_storage
  max_allocated_storage = 0
  storage_type          = "gp3"
  storage_encrypted     = true

  db_name  = "flowpay"
  username = "flowpay"

  manage_master_user_password = true

  db_subnet_group_name   = aws_db_subnet_group.main.name
  vpc_security_group_ids = [local.rds_security_group_id]
  publicly_accessible    = false
  multi_az               = var.db_multi_az

  backup_retention_period   = 1
  skip_final_snapshot       = false
  final_snapshot_identifier = "${var.project}-final-${formatdate("YYYYMMDDhhmmss", timestamp())}"
  snapshot_identifier       = var.restore_from_snapshot ? data.aws_db_snapshot.latest[0].id : null

  auto_minor_version_upgrade = true
  deletion_protection        = false

  tags = {
    Name = var.project
  }

  lifecycle {
    ignore_changes = [final_snapshot_identifier, snapshot_identifier]
  }
}
