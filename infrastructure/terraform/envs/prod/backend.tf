# =============================================================================
# prod env — remote state backend. Separate prod state, prod-account KMS.
# NEVER shared with non-prod ([10 §5]).
# =============================================================================
terraform {
  backend "s3" {
    # bucket         = "nexus-tfstate-<PROD_ACCOUNT_ID>"
    # dynamodb_table = "nexus-tflock"
    # kms_key_id     = "alias/nexus-tfstate"
    key     = "prod/terraform.tfstate"
    region  = "us-east-1"
    encrypt = true
  }
}
