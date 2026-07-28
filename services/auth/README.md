# services/auth — Identity & Profile

**Status:** Scaffold — not implemented
**Owner:** `@nexus-commerce-os/platform` `@nexus-commerce-os/cloud-security` (per [`.github/CODEOWNERS`](../../.github/CODEOWNERS) `/services/auth/`)
**Runtime / language:** TypeScript (NestJS) — core product API ([SDD §6 — Backend core](../../docs/02-software-design-document.md#6-technology-stack--decisions-with-alternatives))
**Certified-architecture component:** **Identity & Profile** module ([04 §4](../../docs/04-system-architecture.md#4-component-responsibilities)) — accounts, passkeys/MFA, consent, agent spend policy
**Governing ADRs:** [ADR-0010](../../docs/adr/ADR-0010-platform-principles.md) (platform principles: health/metrics/rollback), [ADR-0020](../../docs/adr/ADR-0020-performance-consistency-hardening.md) (own DB schema + DB role; boundary DB-enforced) · governed by [08 §3 Security](../../docs/08-security-architecture.md) (OIDC + MFA, passkeys — NFR-SEC-02) and [ADR-0007](../../docs/adr/ADR-0007-phased-global-rollout.md) (per-region residency)
**Implemented by phase:** [P0.2 — Core Platform](../../docs/13-implementation-roadmap.md) (OIDC/passkeys/MFA, RBAC + ABAC, User Service, Settings, Audit Logs)

## Purpose

Owns authentication, authorization (RBAC + ABAC), user profile, consent, and the per-user agent spend policy. Every auth/privileged action emits a tamper-evident audit event. It is a core module in the modular monolith: it owns its data (separate schema/role) and is reached only via typed interfaces + domain events — never cross-module DB access.

## Dependencies

- `packages/shared`, `packages/config` (canonical types)
- Data: PostgreSQL (own schema), Redis (money/auth cluster — isolated from catalog cache, [ADR-0017](../../docs/adr/ADR-0017-blast-radius-isolation.md))

## Scope guard

Scaffold only — **no OIDC, no passkeys/MFA, no RBAC/ABAC, no endpoints, no token issuance.** `src/` documents intent for P0.2.
