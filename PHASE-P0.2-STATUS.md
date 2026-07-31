# P0.2 — Core Platform · Implementation Status Board

**Phase:** P0.2 (of [Implementation Roadmap](docs/13-implementation-roadmap.md)) · **Updated:** 2026-07-31
**Scope guard:** Identity bounded context only. Zero commerce / AI / affiliate / checkout / payment code.
**Architecture:** unchanged since I-1 — the domain has not been modified by any adapter increment.

> **Why this file exists.** The CTO ruling of 2026-07-31 requires that "implementation complete" and
> "production verified" stop being the same claim. An increment can be architecturally and
> functionally finished, with every automated gate green, while the evidence that it works against
> real infrastructure does not yet exist. This board records that distinction per increment, and
> tracks the open evidence gaps so they cannot be quietly lost between phases.
>
> Consistent with the [Evidence Policy](docs/engineering/ops/00-README.md): no artifact ⇒
> `NOT VERIFIED`, never inferred. This file lives at the repo root, not in `docs/`, so the
> [ADR-0023](docs/adr/ADR-0023-doc-freeze-and-approval-gate.md) documentation freeze is untouched.

---

## 1. Increment ledger

| # | Increment | Architecture | Implementation | Automated verification | Production verification |
|---|-----------|--------------|----------------|------------------------|-------------------------|
| I-1 | User / Profile / password domain core | COMPLETE | COMPLETE | COMPLETE | PENDING |
| I-2 | Session + rotating refresh token, reuse detection | COMPLETE | COMPLETE | COMPLETE | PENDING |
| I-3 | Email verification + password reset (token issuance) | COMPLETE | COMPLETE | COMPLETE | PENDING |
| I-4 | Passkeys + device registration, clone detection | COMPLETE | COMPLETE | COMPLETE | PENDING |
| I-5 | OAuth / OIDC federation, auto-link takeover guard | COMPLETE | COMPLETE | COMPLETE | PENDING |
| I-6a/b | Postgres schema + 9 adapters | COMPLETE | COMPLETE | COMPLETE | PENDING |
| I-7a | NestJS composition root, health probes, error mapping | COMPLETE | COMPLETE | COMPLETE | PENDING |
| I-7c | Real WebAuthn verifier | COMPLETE | COMPLETE | COMPLETE | PENDING |
| I-7d | Real OIDC verifier + token exchanger | COMPLETE | COMPLETE | COMPLETE | PENDING |
| I-7e | Outbound email notification adapter | COMPLETE | COMPLETE | COMPLETE | **PENDING — FU-1** |
| **I-7b** | **Identity HTTP layer (20 operations)** | **COMPLETE** | **COMPLETE** | **COMPLETE** | **PENDING — FU-2** |
| I-7f | Strong Device/Session binding | — | NOT STARTED | — | — |
| I-7g | Distributed abuse protection / rate limiting | DESIGN COMPLETE | NOT STARTED | — | — |

"Production verification PENDING" is the honest default for every row: no increment has yet run
against deployed infrastructure, because the P0.1 exit gate (live AWS) is itself unverified.

## 2. I-7b — COMPLETE AND ACCEPTED (CTO, 2026-07-31)

Architecture COMPLETE · Implementation COMPLETE · Automated Verification COMPLETE ·
Production Verification PENDING.

**Evidence on record** — commit `e7c38db`, CI run `30604190202`, `ci-gate` SUCCESS:

| Item | Result |
|------|--------|
| Tests (CI, `NEXUS_PG_TESTS=1`) | **466 passed · 0 failed · 0 skipped** |
| Canonical OpenAPI | **20 operations · 28 schemas · 3.1.0** |
| OpenAPI validation | **PASS**, 0 issues — its own CI gate |
| Authentication-convergence tests | **PASS** (13) |
| Contract-drift guards | **PASS** (7) |
| Typecheck · Lint · Build · Prettier | 9/9 · 0 errors · 5/5 · clean |

**Accepted security properties.** Password, passkey and OIDC all converge on the same
`StartSession`, the same NEXUS-owned Session aggregate, and the same `SessionIssued` contract.
Passkey device binding comes from the verified ceremony rather than an arbitrary client value;
WebAuthn challenges and OIDC state values are rejected as bearer credentials; ceremony and OIDC
replay are refused; passkey list responses expose no internal authenticator state; provider tokens
never become NEXUS application credentials.

**Route-shape ruling.** `POST …/revoke` and `POST …/unlink` are approved and must not be changed to
`DELETE` in this API version — they are explicit application commands, and converting them would add
path-parameter parsing and validator surface for no security or functional gain. This does not
establish that every future revocation operation must use POST.

**Revoked-history ruling.** `includeRevoked` is deliberately not exposed. The use-case capability
remains for a future security-history view, which must first define access control, redaction,
pagination, retention, query validation, and whether it belongs to Identity self-service or a future
Audit/Admin boundary.

**Device revocation is excluded from I-7b** and moved to I-7f.

## 3. Tracked work outside the completed increments

### FU-1 · Real SMTP integration verification — `NOT VERIFIED`

No message has ever been sent through a real SMTP server. Every test uses a transport double, so
`createSmtpTransport` carries no test coverage; its correctness rests on review, not evidence.
Required: STARTTLS negotiation, `requireTLS` failing closed against a server offering no STARTTLS,
link rendering, UTF-8 subjects and bodies, and behaviour across Gmail, SES, Mailgun and Postmark.

### FU-2 · Live end-to-end deployed verification — `NOT VERIFIED`

Nothing has run against deployed infrastructure. The chain to verify:
HTTP → use case → notification port → SMTP → user receives the message → link consumed successfully.

### I-7f · Strong Device/Session Binding — `NOT STARTED`

Design required before implementation; see [DESIGN-I-7f-device-session-binding.md](DESIGN-I-7f-device-session-binding.md).
`Session.deviceBinding` is currently an opaque, nullable, unvalidated string with no referential link
to the Device aggregate, which is why device revocation was deferred rather than cascaded.

### I-7g · Distributed Abuse Protection — `DESIGN COMPLETE · IMPLEMENTATION NOT STARTED`

See [DESIGN-I-7b-security-rate-limiting.md](DESIGN-I-7b-security-rate-limiting.md). Approved
defaults: Redis-backed distributed limiter; fail open for ordinary authentication traffic with
alerting and metrics; layered anonymous signals rather than account identifiers alone; forwarded
client IPs honoured only from explicitly configured trusted proxies; endpoint-specific thresholds
kept in configuration, never hardcoded in controllers. Password-reset requests must remain
externally indistinguishable — always 202, no `Retry-After`, byte-identical sequences for known and
unknown accounts.

## 4. P0.2 exit gate — NOT MET

The roadmap gate is "**Login → Dashboard full flow**: passkey/MFA login, RBAC-scoped dashboard,
feature-flag toggle live, every auth/privileged action in the tamper-evident audit log."

P0.2 comprises six pillars. One is complete:

| Pillar | State |
|--------|-------|
| Identity (authentication, passkeys, OIDC, sessions, recovery, HTTP surface) | COMPLETE (automated verification) |
| RBAC (+ABAC) | NOT STARTED |
| Organization | NOT STARTED |
| Settings | NOT STARTED |
| Feature flags | NOT STARTED |
| Audit logs | NOT STARTED |

## 5. Next priority

**I-7f — Strong Device/Session Binding**, design first. No production code until the design is
approved.

**Explicitly not authorized:** I-7g implementation, RBAC, Organization, Audit, Feature Flags,
Commerce, Merchant connectors, Money Integrity, AI, or unrelated refactoring.
