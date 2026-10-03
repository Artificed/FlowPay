resource "aws_cloudfront_origin_access_control" "avatars" {
  name                              = "${var.project}-avatars"
  origin_access_control_origin_type = "s3"
  signing_behavior                  = "always"
  signing_protocol                  = "sigv4"
}
