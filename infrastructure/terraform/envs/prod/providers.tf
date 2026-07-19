# =============================================================================
# prod env — provider config (primary + in-zone DR pair via alias)
# =============================================================================

provider "aws" {
  region = var.primary_region

  default_tags {
    tags = {
      env            = "prod"
      owner          = var.owner_tag
      managed-by     = "terraform"
      repo           = "nexus/infrastructure"
      residency-zone = "us"
    }
  }
}

provider "aws" {
  alias  = "dr"
  region = var.dr_region

  default_tags {
    tags = {
      env            = "prod"
      owner          = var.owner_tag
      managed-by     = "terraform"
      repo           = "nexus/infrastructure"
      residency-zone = "us"
      role           = "in-zone-dr"
    }
  }
}

provider "tls" {}
provider "random" {}

data "aws_availability_zones" "primary" {
  state = "available"
}

data "aws_availability_zones" "dr" {
  provider = aws.dr
  state    = "available"
}
