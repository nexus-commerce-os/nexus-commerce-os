# services/auth — Identity & Profile

**Status:** P0.2 · Identity domain core (I-1) implemented — User/Profile/credential aggregate, use cases, in-memory + scrypt adapters, 43 unit tests. No HTTP/DB/NestJS wiring yet (I-6/I-7).
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

## Structure (hexagonal, framework-agnostic domain)

```
src/
  kernel/          Result, branded Id, DomainEvent, Clock + IdGenerator ports
  identity/
    domain/        entities (User, Profile, PasswordCredential), value objects
                   (Email, UserId, PasswordHash, PasswordPolicy), events, typed
                   errors, ports (UserRepository, PasswordHasher, EventPublisher)
    application/   use cases: RegisterUser, AuthenticateUser, ChangePassword
    infrastructure/ real adapters: scrypt hasher, in-memory repo + event bus,
                   system clock, uuid id-generator
```

The domain and use cases import no framework and no concrete adapter (dependency
inversion); adapters implement the ports. Persistence swaps in-memory→Postgres at
I-6 with no domain change.

## Scope guard

I-1 delivers the **Identity domain core only**. Still **not** present (later
increments): OIDC/OAuth, passkeys/MFA, email verification, password reset, device
registration, session lifecycle (I-2…I-5); Postgres `identity`-schema adapter +
migrations (I-6); NestJS module + HTTP endpoints (I-7). No RBAC/ABAC (separate
context). No token issuance.
