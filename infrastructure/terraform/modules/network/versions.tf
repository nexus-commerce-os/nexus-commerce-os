# Pins mirror /infrastructure/terraform/versions.tf (canonical). See that file
# for the pinning policy. Modules restate pins so each validates in isolation.
terraform {
  required_version = ">= 1.7.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.60"
    }
  }
}
