# Pins mirror /infrastructure/terraform/versions.tf (canonical).
# region-stack is a COMPOSITION module (wires the 8 primitives); it declares the
# union of providers its children need so a single provider (per region alias)
# passes straight through.
terraform {
  required_version = ">= 1.7.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.60"
    }
    tls = {
      source  = "hashicorp/tls"
      version = "~> 4.0"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.6"
    }
  }
}
