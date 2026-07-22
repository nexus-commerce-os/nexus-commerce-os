# =============================================================================
# NEXUS — Terraform provider & version pinning strategy (CANONICAL REFERENCE)
# -----------------------------------------------------------------------------
# This file is the SINGLE SOURCE OF TRUTH for the provider versions every module
# and environment in this repository MUST pin to. It is intentionally a bare
# `terraform` block with NO resources and NO backend, so it is inert on its own
# and never planned/applied directly.
#
# WHY a canonical file instead of a shared module:
#   - Terraform does not inherit `required_providers` from a parent directory.
#     Each module / env root is validated in isolation ([09 §1] anti-lock-in:
#     "every module independently terraform-validate-able"), so each one MUST
#     restate its own pins. This file is what they copy, verbatim, so the whole
#     estate stays on ONE version matrix and upgrades are a single reviewed diff.
#
# PINNING POLICY (maps to ADR-0003 "all infra via Terraform, no console/lock-in"
# and ADR-0019 R-012 "portability is tested, not asserted"):
#   - terraform  >= 1.7.0   — required_version floor; 1.7 for the `tfvars`
#                             validation + `moved`/`removed` block maturity.
#   - hashicorp/aws  ~> 5.60 — pessimistic pin: takes 5.60.x .. <6.0.0 only, so
#                             a major-version jump (breaking) is always a
#                             deliberate, reviewed bump — never silent.
#   - hashicorp/tls  ~> 4.0  — only where an OIDC thumbprint is derived
#                             (global GitHub-OIDC, compute IRSA).
#   - hashicorp/random ~> 3.6 — suffix/entropy helpers (bucket names, etc.).
#
# UPGRADE DISCIPLINE:
#   - Bump here first, then propagate to every module/env `versions.tf` in the
#     SAME PR. CI drift-checks that no module diverges from these pins.
#   - `.terraform.lock.hcl` MUST be generated and committed per env root at
#     bootstrap (`terraform providers lock -platform=linux_amd64 -platform=darwin_arm64`)
#     to freeze exact versions + checksums (supply-chain integrity, deployment
#     principle #4). NOTE: lock files are generated at first `init` against a
#     network mirror; they are NOT authored by hand and are absent until then.
#
# NOTE: no `provider "aws"` block lives here. Provider *configuration* (region,
# assume-role, default_tags) is an ENV concern and lives in each
# envs/<env>/providers.tf — modules never configure providers (they receive
# them), which is what lets one env drive multiple regions via provider aliases
# (ap-south-1 residency tier, [09 §12] / ADR-0016 R-014).
# =============================================================================

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
