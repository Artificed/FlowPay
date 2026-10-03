resource "aws_cloudfront_origin_access_control" "avatars" {
  name                              = "${var.project}-avatars"
  origin_access_control_origin_type = "s3"
  signing_behavior                  = "always"
  signing_protocol                  = "sigv4"
}

data "aws_iam_policy_document" "avatars" {
  statement {
    actions   = ["s3:GetObject"]
    resources = ["${local.avatars_bucket_arn}/*"]

    principals {
      type        = "Service"
      identifiers = ["cloudfront.amazonaws.com"]
    }

    condition {
      test     = "StringEquals"
      variable = "AWS:SourceArn"
      values   = [aws_cloudfront_distribution.frontend.arn]
    }
  }
}

resource "aws_s3_bucket_policy" "avatars" {
  bucket = local.avatars_bucket_name
  policy = data.aws_iam_policy_document.avatars.json
}
