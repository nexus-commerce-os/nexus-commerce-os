# =============================================================================
# storage module (S3) — main
# Realizes [09 §5] object store + [09 §6] CRR-for-non-personal-only:
#   - Versioned, SSE-KMS, public-access-blocked, TLS-only buckets.
#   - Cross-region replication is OPT-IN and HARD-BLOCKED for personal-data
#     buckets (residency, ADR-0016 R-013) via a precondition.
# =============================================================================

# Guard: replication may never target a personal-data bucket.
resource "terraform_data" "residency_guard" {
  for_each = var.replication

  lifecycle {
    precondition {
      condition     = try(var.buckets[each.key].contains_personal_data, true) == false
      error_message = "Cross-region replication is FORBIDDEN for personal-data bucket \"${each.key}\" (residency, ADR-0016 R-013). Remove it from var.replication."
    }
  }
}

resource "random_id" "suffix" {
  for_each    = var.buckets
  byte_length = 4
}

resource "aws_s3_bucket" "this" {
  for_each = var.buckets

  bucket = "${var.name_prefix}-${each.key}-${random_id.suffix[each.key].hex}"

  tags = merge(var.tags, {
    Name     = "${var.name_prefix}-${each.key}"
    Purpose  = each.key
    Personal = tostring(each.value.contains_personal_data)
  })

  # Data store: block accidental deletion of a non-empty bucket.
  lifecycle {
    prevent_destroy = true
  }
}

resource "aws_s3_bucket_public_access_block" "this" {
  for_each = aws_s3_bucket.this

  bucket                  = each.value.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_versioning" "this" {
  for_each = var.buckets

  bucket = aws_s3_bucket.this[each.key].id
  versioning_configuration {
    status = each.value.versioning ? "Enabled" : "Suspended"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "this" {
  for_each = aws_s3_bucket.this

  bucket = each.value.id
  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm     = "aws:kms"
      kms_master_key_id = var.kms_key_arn
    }
    bucket_key_enabled = true
  }
}

# TLS-only bucket policy (deny non-HTTPS) — in-transit protection (NFR-SEC-01).
data "aws_iam_policy_document" "tls_only" {
  for_each = aws_s3_bucket.this

  statement {
    sid       = "DenyInsecureTransport"
    effect    = "Deny"
    actions   = ["s3:*"]
    resources = [each.value.arn, "${each.value.arn}/*"]
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

resource "aws_s3_bucket_policy" "tls_only" {
  for_each = aws_s3_bucket.this

  bucket = each.value.id
  policy = data.aws_iam_policy_document.tls_only[each.key].json
}

# Lifecycle rules (tiering + expiry) — cost control ([09 §9]).
resource "aws_s3_bucket_lifecycle_configuration" "this" {
  for_each = { for k, v in var.buckets : k => v if length(v.lifecycle_rules) > 0 }

  bucket = aws_s3_bucket.this[each.key].id

  dynamic "rule" {
    for_each = each.value.lifecycle_rules
    content {
      id     = rule.value.id
      status = "Enabled"

      filter {
        prefix = rule.value.prefix
      }

      dynamic "transition" {
        for_each = rule.value.transition_days == null ? [] : [1]
        content {
          days          = rule.value.transition_days
          storage_class = rule.value.transition_storage_class
        }
      }

      dynamic "expiration" {
        for_each = rule.value.expiration_days == null ? [] : [1]
        content {
          days = rule.value.expiration_days
        }
      }

      noncurrent_version_expiration {
        noncurrent_days = rule.value.noncurrent_expiration_days
      }
    }
  }
}

# Cross-region replication — non-personal buckets only (guarded above).
resource "aws_s3_bucket_replication_configuration" "this" {
  for_each = var.replication

  bucket = aws_s3_bucket.this[each.key].id
  role   = var.replication_role_arn

  rule {
    id     = "crr-${each.key}"
    status = "Enabled"

    filter {}

    delete_marker_replication {
      status = "Enabled"
    }

    destination {
      bucket        = each.value.destination_bucket_arn
      storage_class = "STANDARD"
      encryption_configuration {
        replica_kms_key_id = each.value.destination_kms_key_arn
      }
    }

    source_selection_criteria {
      sse_kms_encrypted_objects {
        status = "Enabled"
      }
    }
  }

  # Replication requires versioning enabled on the source.
  depends_on = [aws_s3_bucket_versioning.this, terraform_data.residency_guard]
}
