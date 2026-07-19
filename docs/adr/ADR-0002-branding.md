# ADR-0002 — Codename NEXUS; consumer brand deferred

**Status:** Accepted (Founder-ratified 2026-07-14) · **Date:** 2026-07-13 · **Deciders:** Founder, CEO, CPO, Strategy

## Context

We need a stable internal identifier for all documentation and code now, but the consumer-facing brand requires trademark clearance across launch geographies (US/EU/South-Asia), domain/handle availability, and linguistic checks — none of which should block architecture work.

## Decision

Use **`NEXUS`** as the internal codename across all documents, repos, and services. Defer the consumer brand to a dedicated branding + trademark-clearance workstream before public launch. Code MUST reference the codename via config, never hard-code a consumer brand string, so a later rename is a configuration change.

## Options considered

| Option | Verdict |
|--------|---------|
| Pick final consumer brand now | ❌ Risks trademark conflict; blocks work |
| No name, ad-hoc references | ❌ Inconsistency across docs/agents |
| **Stable codename, brand deferred** | ✅ Chosen |

## Consequences

- **+** Consistency now, flexibility later; clean rename path.
- **−** Marketing/brand assets wait (acceptable in Phase 0).

## Update — Founder decision (2026-07-14)

1. **Placeholder domains for P0.1 (chosen).** Do **not** buy a final brand domain now ("nexus.*" carries trademark risk and we are pre-PMF). The platform uses **`staging.<yourdomain>.com` · `ops.<yourdomain>.com` · `preview.<yourdomain>.com`** for ingress/TLS/external-DNS. Finalizing the brand later changes **only** DNS/Ingress/Certificates — **not** architecture (config, per [ADR-0007](ADR-0007-phased-global-rollout.md)).
2. **`NEXUS` is NOT locked as the final brand.** It remains the internal codename only.
3. **Brand Discovery Phase gate (MUST precede a Final-Brand ADR):** trademark search · domain availability · SEO conflict · social-handle availability · international pronunciation · legal review. A **Final-Brand ADR** is opened only after all six pass.

## Related
[Vision](../01-vision.md), [ADR-0007 phased rollout](ADR-0007-phased-global-rollout.md), [PROJECT_MEMORY](../../PROJECT_MEMORY.md).
