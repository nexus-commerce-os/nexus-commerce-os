#!/usr/bin/env bash
# setup-github-stage-a.sh — automate everything in Stage A that does NOT need your password.
#
# YOU do 2 things first (only you can — they need your GitHub login):
#   1) Create the org in a browser:  https://github.com/account/organizations/new  (Free plan)
#   2) Log in the CLI on your machine: gh auth login --scopes "repo,workflow,admin:org,read:org"
#
# THEN run this from the repo root:
#   ORG=<your-org> REPO=nexus-commerce-os bash scripts/setup-github-stage-a.sh
#
# It creates+pushes the repo, applies branch protection / ruleset / required checks / environments,
# and writes all evidence to  stage-a-evidence.txt  (paste that back for A1–A10 verification).
# Idempotent + safe: re-running does not duplicate or destroy anything.
set -euo pipefail
cd "$(dirname "$0")/.."

: "${ORG:?set ORG=<your-org>}"; : "${REPO:=nexus-commerce-os}"
EV="stage-a-evidence.txt"; : > "$EV"
log(){ echo -e "\n===== $1 =====" | tee -a "$EV"; }
run(){ echo "\$ $*" | tee -a "$EV"; eval "$*" 2>&1 | tee -a "$EV"; }

# --- Preconditions (fail closed) ---
command -v gh >/dev/null || { echo "❌ gh not installed. https://cli.github.com"; exit 1; }
gh auth status >/dev/null 2>&1 || { echo "❌ run: gh auth login --scopes \"repo,workflow,admin:org,read:org\""; exit 1; }
log "gh auth status (EV-A9 context)"; run "gh auth status"
gh api "orgs/$ORG" >/dev/null 2>&1 || { echo "❌ org '$ORG' not found — create it first at github.com/account/organizations/new"; exit 1; }

# --- A1: org exists ---
log "EV-A1-001 — organization"; run "gh api orgs/$ORG --jq '{login,id,plan:.plan.name}'"

# --- A2: create + push the private monorepo (idempotent) ---
if ! gh repo view "$ORG/$REPO" >/dev/null 2>&1; then
  log "Creating private repo $ORG/$REPO"
  git rev-parse --git-dir >/dev/null 2>&1 || { git init -b main; git add -A; git -c commit.gpgsign=true commit -m "chore: P0.1 infrastructure foundation scaffold" || git commit -m "chore: P0.1 scaffold"; }
  run "gh repo create $ORG/$REPO --private --source=. --remote=origin --push"
else
  log "Repo $ORG/$REPO already exists — skipping create"
fi
log "EV-A2-001 — repository"; run "gh repo view $ORG/$REPO --json name,visibility,isPrivate,defaultBranchRef"

# --- A3: branch protection on main ---
log "EV-A3-001 — branch protection (apply)"
run "gh api -X PUT repos/$ORG/$REPO/branches/main/protection \
  -H 'Accept: application/vnd.github+json' \
  -f 'required_status_checks[strict]=true' -f 'required_status_checks[contexts][]=ci-gate' \
  -F 'enforce_admins=true' \
  -F 'required_pull_request_reviews[required_approving_review_count]=1' \
  -F 'required_pull_request_reviews[require_code_owner_reviews]=true' \
  -F 'required_linear_history=true' -F 'allow_force_pushes=false' -F 'allow_deletions=false' \
  -F 'restrictions=' || echo 'NOTE: some fields need org/team ids; review output'"
run "gh api repos/$ORG/$REPO/branches/main/protection --jq '{checks:.required_status_checks.contexts, reviews:.required_pull_request_reviews, linear:.required_linear_history.enabled, admins:.enforce_admins.enabled}'"

# --- A6: require signed commits ---
log "EV-A6-001 — required signatures (apply)"
run "gh api -X POST repos/$ORG/$REPO/branches/main/protection/required_signatures -H 'Accept: application/vnd.github+json' || true"
run "gh api repos/$ORG/$REPO/branches/main/protection/required_signatures --jq '{signed_required:.enabled}'"

# --- A10: environments (staging auto, production gated) ---
log "EV-A10-001 — environments (apply)"
run "gh api -X PUT repos/$ORG/$REPO/environments/staging || true"
run "gh api -X PUT repos/$ORG/$REPO/environments/production -F 'wait_timer=10' || true"
run "gh api repos/$ORG/$REPO/environments --jq '.environments[].name'"

# --- A4: ruleset presence (baseline; refine in UI) ---
log "EV-A4-001 — rulesets"
run "gh api repos/$ORG/$REPO/rulesets --jq '.[] | {name,enforcement}' || echo 'no rulesets yet — add via UI/Ch1 if desired (branch protection above already enforces the core controls)'"

cat <<NOTE | tee -a "$EV"

===== NEGATIVE TESTS you must run by hand (needed for EQS 5 / behavioral PASS) =====
 A3: git push origin main         # expect: REJECTED (protected). Then open a PR instead.
 A6: git commit --no-gpg-sign ... && git push  # expect: REJECTED (unsigned)
     git commit -S ... && push (via PR)          # expect: ACCEPTED
 A5: edit a /docs file in a PR    # expect: @nexus/architecture auto-required as reviewer
 A7: try to merge the PR with 0 approvals   # expect: BLOCKED
 A8: try to merge while ci-gate is pending/red  # expect: BLOCKED
Capture each rejection/acceptance as a screenshot → those are the negative-test artifacts.

===== TEAMS (create so CODEOWNERS resolves) =====
 for t in platform infrastructure cloud-security devsecops sre frontend commerce ai data architecture; do
   gh api -X POST orgs/$ORG/teams -f name="\$t" >/dev/null 2>&1 || true; done
 gh api orgs/$ORG/teams --jq '.[].slug'
NOTE

log "DONE — paste $EV back for A1/A2/A3/A4/A6/A10 verification; run the negative tests above for A3/A5/A6/A7/A8."
echo "✅ Evidence written to $EV"
