# =============================================================================
# global stack — remote state backend ([10 §5] "S3 backend + DynamoDB lock,
# one state per env-account-region, encrypted with per-env KMS").
# This is the bootstrap that CREATES the shared state store.
# =============================================================================

# CMK for state encryption.
resource "aws_kms_key" "tfstate" {
  description             = "Encrypts the NEXUS Terraform remote state."
  enable_key_rotation     = true
  deletion_window_in_days = 30
  tags                    = merge(var.tags, { Name = "${var.org_slug}-tfstate" })
}

resource "aws_kms_alias" "tfstate" {
  name          = "alias/${var.org_slug}-tfstate"
  target_key_id = aws_kms_key.tfstate.key_id
}

# Versioned, encrypted, private state bucket.
resource "aws_s3_bucket" "tfstate" {
  bucket = "${var.org_slug}-tfstate-${data.aws_caller_identity.current.account_id}"

  tags = merge(var.tags, { Name = "${var.org_slug}-tfstate" })

  lifecycle {
    prevent_destroy = true
  }
}

resource "aws_s3_bucket_versioning" "tfstate" {
  bucket = aws_s3_bucket.tfstate.id
  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "tfstate" {
  bucket = aws_s3_bucket.tfstate.id
  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm     = "aws:kms"
      kms_master_key_id = aws_kms_key.tfstate.arn
    }
    bucket_key_enabled = true
  }
}

resource "aws_s3_bucket_public_access_block" "tfstate" {
  bucket                  = aws_s3_bucket.tfstate.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# TLS-only access to state.
data "aws_iam_policy_document" "tfstate_tls" {
  statement {
    sid       = "DenyInsecureTransport"
    effect    = "Deny"
    actions   = ["s3:*"]
    resources = [aws_s3_bucket.tfstate.arn, "${aws_s3_bucket.tfstate.arn}/*"]
    principals {
      type        = "*"
      identifiers = ["*"]
    }
    condition {
      test     = "Bool"
      variable = "aws:SecureTransport"
      values   = ["false"]
    }
  }
}

resource "aws_s3_bucket_policy" "tfstate" {
  bucket = aws_s3_bucket.tfstate.id
  policy = data.aws_iam_policy_document.tfstate_tls.json
}

# DynamoDB lock table (prevents concurrent state writes / corruption, [10 §5]).
resource "aws_dynamodb_table" "tflock" {
  name         = "${var.org_slug}-tflock"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "LockID"

  attribute {
    name = "LockID"
    type = "S"
  }

  server_side_encryption {
    enabled     = true
    kms_key_arn = aws_kms_key.tfstate.arn
  }

  point_in_time_recovery {
    enabled = true
  }

  tags = merge(var.tags, { Name = "${var.org_slug}-tflock" })

  lifecycle {
    prevent_destroy = true
  }
}
