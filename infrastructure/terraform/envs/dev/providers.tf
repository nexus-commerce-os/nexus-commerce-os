# =============================================================================
# dev env — provider config
# Providers are configured HERE (never in modules) and injected. default_tags
# stamps every resource for FinOps ([09 §9]). AZs are DISCOVERED, not hardcoded.
# =============================================================================

provider "aws" {
  region = var.aws_region

  default_tags {
    tags = {
      env        = "dev"
      owner      = var.owner_tag
      managed-by = "terraform"
      repo       = "nexus/infrastructure"
    }
  }
}

# tls + random need no configuration; declared so the env is self-contained.
provider "tls" {}
provider "random" {}

data "aws_availability_zones" "available" {
  state = "available"
}
