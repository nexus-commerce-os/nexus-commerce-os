# =============================================================================
# staging env — remote state backend (one state for the whole env; regions are
# provider-aliased within it). Fill bucket/table/kms from the `global` outputs.
# =============================================================================
terraform {
  backend "s3" {
    # bucket         = "nexus-tfstate-<ACCOUNT_ID>"
    # dynamodb_table = "nexus-tflock"
    # kms_key_id     = "alias/nexus-tfstate"
    key     = "staging/terraform.tfstate"
    region  = "us-east-1"
    encrypt = true
  }
}
