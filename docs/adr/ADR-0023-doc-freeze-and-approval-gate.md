# ADR-0023 — Documentation Freeze & Implementation-Complete Approval Gate

**Status:** Accepted (Founder-directed) · **Date:** 2026-07-14 · **Deciders:** Founder, CTO, Security Lead, Platform Lead
**Applies from:** the start of live P0.1 execution, onward through all P0.x phases.

## Context
Phase-0 documentation (certified) plus the P0.1 engineering specs and a ~4,000-line operations manual are complete. Continuing to *write* documentation now creates **documentation drift** — the risk that the docs and the real system diverge. The remaining work is **execution**, and its integrity depends on objective evidence and clear accountability, not more prose.

## Decision

### 1. Documentation Freeze
`docs/**` (architecture, ADRs, engineering specs, ops manual) is **frozen**. A change is permitted **only** for one of four reasons, each stated in the commit:
1. **Evidence** — recording verification results (e.g. the [Verification Ledger](../engineering/ops/11-verification-ledger.md)).
2. **Bug fix** — correcting a defect found in a doc.
3. **ADR** — a new/updated architecture decision.
4. **Execution learning** — a fact learned from *real* execution that the docs must reflect.
No new speculative documents. The [doc-consistency lint](../04-system-architecture.md#10-fitness-functions-how-we-keep-it-healthy) continues to gate any permitted change.

### 2. Implementation-Complete Approval Gate
**No implementation phase (P0.1…P0.8) is complete until all four approve, and every approval MUST reference objective evidence:**
- **Engineering Lead** — build correctness + idempotency evidence.
- **Security Lead** — 0 High/Critical findings, signing/SBOM, IAM least-privilege evidence.
- **Platform Lead** — deploy/observability/rollback evidence.
- **Founder** — business + go/no-go.

An approval that does not cite an evidence artifact ([Evidence Policy](../engineering/ops/00-README.md#evidence-policy-binding)) is **void**. The gate is recorded in the phase's exit-gate chapter ([Ch8](../engineering/ops/08-exit-gate-validation.md)) and in `PROJECT_MEMORY.md`.

## Consequences
- **+** Docs and the running system stay convergent; accountability is explicit; every "done" is evidence-backed.
- **+** Focus shifts to execution; no more doc sprawl.
- **−** A little friction to change docs (must cite a reason) — intended.

## Rollback
Lift the freeze via a superseding ADR if a phase genuinely needs new design docs (e.g. entering P0.4 money-integrity build may warrant a detailed design ADR — that is an *ADR*, hence already permitted).

## Related
[Ch8 Exit-Gate](../engineering/ops/08-exit-gate-validation.md), [Ch11 Verification Ledger](../engineering/ops/11-verification-ledger.md), [Evidence Policy](../engineering/ops/00-README.md#evidence-policy-binding), [ADR-0002 branding](ADR-0002-branding.md) (domain/brand still deferred).
