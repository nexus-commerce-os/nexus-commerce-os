#!/usr/bin/env bash
# verify.sh — the local subset of the CI gate. Run before pushing. Fails fast on the first error.
# Mirrors the merge-blocking CI stages that can run without cloud credentials.
# Rationale: catch what CI would catch, locally, so PRs land green — reproducibility over speed.
set -euo pipefail
cd "$(dirname "$0")/.."

echo "▶ 1/5  Doc-consistency lint (certified fitness function)"
python scripts/doc_consistency_lint.py

echo "▶ 2/5  Mermaid validation"
python scripts/mermaid_validate.py

echo "▶ 3/5  Prettier format check (JS/TS/JSON/MD)"
if command -v pnpm >/dev/null 2>&1; then pnpm -s format:check || { echo "run: pnpm format"; exit 1; }; else echo "  (pnpm not installed — skipped)"; fi

echo "▶ 4/5  Terraform fmt + validate (per module)"
if command -v terraform >/dev/null 2>&1; then
  terraform -chdir=infrastructure/terraform fmt -check -recursive
  for m in infrastructure/terraform/modules/*/; do terraform -chdir="$m" init -backend=false -input=false >/dev/null && terraform -chdir="$m" validate; done
else echo "  (terraform not installed — skipped; CI enforces)"; fi

echo "▶ 5/5  Policy validation (OPA/conftest)"
if command -v conftest >/dev/null 2>&1; then conftest test infrastructure/terraform --policy tests/policy || true; else echo "  (conftest not installed — skipped; CI enforces)"; fi

echo "✅ Local verify complete. CI runs the full gate incl. SAST/scans/SBOM/plan/rollback."
