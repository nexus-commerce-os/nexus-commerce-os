#!/usr/bin/env bash
# bootstrap.sh — one-time developer environment setup. Idempotent: safe to re-run.
# Rationale: "works on my machine" is banned; every dev + CI runner bootstraps identically.
set -euo pipefail
cd "$(dirname "$0")/.."

need() { command -v "$1" >/dev/null 2>&1 || { echo "MISSING: $1 (>= $2). Install it, then re-run."; MISS=1; }; }
MISS=0
echo "▶ Checking required toolchains…"
need node 20 ; need pnpm 9 ; need terraform 1.7 ; need docker 24 ; need kubectl 1.29 ; need helm 3.14 ; need python 3.8
# optional-but-recommended security/supply-chain tooling (CI has them regardless)
for t in cosign syft grype trivy conftest tflint checkov gitleaks; do
  command -v "$t" >/dev/null 2>&1 || echo "  (optional) $t not found — CI provides it"
done
[ "$MISS" = "1" ] && { echo "❌ Install missing required tools and re-run."; exit 1; }

echo "▶ Installing git hooks (pre-commit → verify subset)…"
mkdir -p .git/hooks 2>/dev/null || true
cat > .git/hooks/pre-commit <<'HOOK'
#!/usr/bin/env bash
python scripts/doc_consistency_lint.py && python scripts/mermaid_validate.py
HOOK
chmod +x .git/hooks/pre-commit 2>/dev/null || true

echo "▶ Installing workspace deps…"
command -v pnpm >/dev/null 2>&1 && pnpm install --frozen-lockfile || echo "  (pnpm install skipped)"

echo "✅ Bootstrap complete. Next: scripts/verify.sh"
