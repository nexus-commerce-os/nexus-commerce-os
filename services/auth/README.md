# services/auth — Identity & Profile

**Status:** P0.2 · Identity domain core (I-1) + sessions (I-2) + email verification & password reset (I-3) + passkeys & devices (I-4) + OAuth/OIDC federation (I-5) implemented — 267 unit tests. All protocol crypto (WebAuthn, OIDC) sits behind ports; no HTTP/DB/NestJS wiring yet (I-6/I-7).
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

### Verification & reset rules (I-3)

One `VerificationToken` aggregate serves both flows via a `purpose` discriminator
(the lifecycle — issue → single-use consume → expire → supersede — is identical).
TTLs are **policy-driven** (`VerificationPolicy.ttlFor(purpose)`; defaults 24 h
verify / 1 h reset). Every token is bound to `(userId, purpose, email)` and the
binding is re-checked on redeem, so a link minted before a `changeEmail` cannot
verify an address nobody proved, and a reset link can never be spent as a
verification. Issuing supersedes all still-pending tokens for the pair — only the
newest link works.

`RequestPasswordReset` **never fails**: unknown, malformed and deactivated
addresses all return `ok` with a null token, so the response cannot be used to
enumerate accounts (docs/08 threat X7). Stored hashes use **HMAC-SHA256** with a
server-held pepper supplied by the composition root, so a database leak alone
does not permit offline verification of guesses.

Session revocation after a reset is **not** called directly — `ResetPassword`
publishes `PasswordChanged`, and the I-7 subscriber reacts. Identity use cases
therefore carry no dependency on the session module.

### Federation rules (I-5, doc 08 §3.2)

An account is resolved by the provider's **`sub`**, never by email — addresses
are re-assignable, so binding on them would let a recycled address inherit an
account. `(provider, subject)` is unique, so one provider account can never be
attached to two NEXUS accounts.

**Auto-linking is the takeover risk.** Attaching a provider identity to an
existing account found by email is allowed only when *both* sides have verified
the address (`OidcPolicy.allowsAutoLink`); otherwise the user must sign in first
and link explicitly. `state` is stored as a hash and is single-use; `nonce` is
matched against the pending request by the domain (not the verifier); the PKCE
verifier is passed to the exchange and never leaves the snapshot or an event.

Accounts bootstrapped from a provider have **no password factor**, which makes
the last-factor rule live: `canRemoveFactor` counts passwords, passkeys and
linked providers together, so unlinking the only way into an account is refused.

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

I-1 … I-5 deliver the **Identity domain only**. Every external protocol sits
behind a port with **no implementation in this module**: `WebAuthnVerifier`
(I-4) and `OidcTokenExchanger` / `OidcTokenVerifier` (I-5) are implemented by
adapters in **I-7**, so passkey and federated sign-in are not end-to-end
functional yet. Test doubles for them live only under `__tests__`.

Still **not** present: Postgres `identity`-schema adapter + migrations (I-6);
NestJS module, HTTP endpoints, notification adapter and event wiring such as
`PasswordChanged` → revoke-all-sessions (I-7). No RBAC/ABAC and no step-up or
MFA policy evaluation — including the docs/08 §3.2 rule that a federated-only
account must be elevated before money-moving capabilities (separate contexts).
No JWT/access-token signing (gateway).
