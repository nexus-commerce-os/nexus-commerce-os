# =============================================================================
# staging env — provider config (multi-region via ALIASES)
# One env, three regions: primary (US) + the regulated ap-south-1 tier + its
# in-zone DR pair ap-south-2. This is what makes staging topology-identical to
# prod and exercises residency/DR BEFORE the P4 market opens ([09 §12], R-014).
# =============================================================================

provider "aws" {
  region = var.primary_region

  default_tags {
    tags = {
      env        = "staging"
      owner      = var.owner_tag
      managed-by = "terraform"
      repo       = "nexus/infrastructure"
    }
  }
}

provider "aws" {
  alias  = "regulated"
  region = var.regulated_region

  default_tags {
    tags = {
      env            = "staging"
      owner          = var.owner_tag
      managed-by     = "terraform"
      repo           = "nexus/infrastructure"
      residency-zone = "south-asia"
    }
  }
}

provider "aws" {
  alias  = "regulated_dr"
  region = var.regulated_dr_region

  default_tags {
    tags = {
      env            = "staging"
      owner          = var.owner_tag
      managed-by     = "terraform"
      repo           = "nexus/infrastructure"
      residency-zone = "south-asia"
      role           = "in-zone-dr"
    }
  }
}

provider "tls" {}
provider "random" {}

data "aws_availability_zones" "primary" {
  state = "available"
}

data "aws_availability_zones" "regulated" {
  provider = aws.regulated
  state    = "available"
}

data "aws_availability_zones" "regulated_dr" {
  provider = aws.regulated_dr
  state    = "available"
}
