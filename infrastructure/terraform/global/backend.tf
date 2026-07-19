# =============================================================================
# global stack — backend
# CHICKEN-AND-EGG: this stack CREATES the S3 state bucket + DynamoDB lock table
# that every OTHER stack uses. So on the very first run it must apply with a
# LOCAL backend, then be re-initialized to migrate its own state into the bucket
# it just created.
#
# Bootstrap sequence (documented in README):
#   1. Leave the backend block below COMMENTED, run:
#        terraform init && terraform apply     # creates bucket + lock table (local state)
#   2. UNCOMMENT the backend block, fill the bucket/table it just made, run:
#        terraform init -migrate-state          # moves local state into S3
#
# After bootstrap, every env stack points at this same bucket with its own key.
# =============================================================================

# terraform {
#   backend "s3" {
#     bucket         = "nexus-tfstate-<ORG_ID>"   # created by this stack
#     key            = "global/terraform.tfstate"
#     region         = "us-east-1"                 # state-home region (var.state_region)
#     dynamodb_table = "nexus-tflock"              # created by this stack
#     encrypt        = true
#     kms_key_id     = "alias/nexus-tfstate"       # created by this stack
#   }
# }
