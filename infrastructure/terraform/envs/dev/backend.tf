# =============================================================================
# dev env — remote state backend
# One state per env-account-region ([10 §5]). Fill bucket/table/kms from the
# `global` stack outputs (tfstate_bucket / tflock_table / tfstate_kms_key_arn),
# then `terraform init`. Values are placeholders — no account id is committed.
# =============================================================================
terraform {
  backend "s3" {
    # bucket         = "nexus-tfstate-<ACCOUNT_ID>"   # from global.tfstate_bucket
    # dynamodb_table = "nexus-tflock"                 # from global.tflock_table
    # kms_key_id     = "alias/nexus-tfstate"          # from global.tfstate_kms_key_arn
    key     = "dev/us-east-1/terraform.tfstate"
    region  = "us-east-1"
    encrypt = true
  }
}
