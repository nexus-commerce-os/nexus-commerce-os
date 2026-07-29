# services/auth — Identity & Profile

**Status:** P0.2 · Identity domain core (I-1) + session lifecycle (I-2) implemented — User/Profile/credential aggregate, Session aggregate with rotating refresh-token family + reuse detection, use cases, in-memory/scrypt/sha256 adapters, 89 unit tests. No HTTP/DB/NestJS wiring yet (I-6/I-7).
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
    domain/        entities (User, Profile, PasswordCredential, Session,
                   RefreshToken), value objects (Email, UserId, PasswordHash,
                   PasswordPolicy, SessionId, TokenHash, SessionPolicy), events,
                   typed errors, ports (UserRepository, SessionRepository,
                   PasswordHasher, TokenGenerator, TokenHasher, EventPublisher)
    application/   use cases: RegisterUser, AuthenticateUser, ChangePassword,
                   StartSession, RefreshSession, RevokeSession,
                   RevokeAllUserSessions
    infrastructure/ real adapters: scrypt password hasher, sha256 token hasher,
                   CSPRNG token generator, in-memory user/session repos +
                   event bus, system clock, uuid id-generator
```

### Session rules (doc 08 §3.4)

Refresh tokens **rotate on every use**; the presented token is consumed and a new
one issued. Presenting an already-consumed token is treated as theft: the entire
token family is revoked (`reuse_detected`) and `SessionReuseDetected` is emitted.
A sliding **idle** window is enforced inside a hard **absolute** ceiling, and the
raw secret is never stored — only its SHA-256 digest (high-entropy secrets need a
fast digest, not the password KDF).

The domain and use cases import no framework and no concrete adapter (dependency
inversion); adapters implement the ports. Persistence swaps in-memory→Postgres at
I-6 with no domain change.

## Scope guard

I-1/I-2 deliver the **Identity domain core + session lifecycle only**. Still
**not** present (later increments): email verification + password reset (I-3),
passkeys/MFA + device registration (I-4 — a session stores only an opaque device
reference), OIDC/OAuth federation (I-5), Postgres `identity`-schema adapter +
migrations (I-6), NestJS module + HTTP endpoints and event wiring such as
`PasswordChanged` → revoke-all-sessions (I-7). No RBAC/ABAC and no step-up
policy evaluation (separate contexts). No JWT/access-token signing (gateway).
