<!-- Thanks for contributing to NEXUS Commerce OS. Fill this out; it is the merge checklist. -->

## What & why

<!-- What does this change do, and why? Keep it about intent, not just mechanics. -->

## Linked ADR / doc

<!-- Which ADR or /docs section governs this change? If it changes an architectural
     decision, link the new/superseding ADR (docs are frozen — see ADR-0023). -->

- ADR / doc:

## Type of change

- [ ] `feat` — new capability
- [ ] `fix` — bug fix
- [ ] `docs` — documentation / ADR
- [ ] `chore` / `refactor` / `test` / `ci` / `build`
- [ ] `security` — security-relevant change

## Checklist

- [ ] Commits are **signed** and follow **Conventional Commits**.
- [ ] `ci-gate` is green (lint, typecheck, build, tests, SAST, secret-scan, deps, SBOM, signing).
- [ ] `python scripts/doc_consistency_lint.py` passes.
- [ ] Tests added/updated for changed behavior.
- [ ] **Security impact considered** (secrets, IAM least-privilege, public exposure, injection).
- [ ] No architectural doc changed without an ADR.
- [ ] Rollback/blast-radius understood for infra changes.

## Security impact

<!-- None / describe. Never include secrets. For a vulnerability, use SECURITY.md instead. -->
