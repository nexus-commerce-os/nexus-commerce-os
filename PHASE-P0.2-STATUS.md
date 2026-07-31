# P0.2 — Core Platform · Implementation Status Board

**Phase:** P0.2 (of [Implementation Roadmap](docs/13-implementation-roadmap.md)) · **Updated:** 2026-07-31
**Scope guard:** Identity bounded context only. Zero commerce / AI / affiliate / checkout / payment code.
**Architecture:** unchanged since I-1 — the domain has not been modified by any adapter increment.

> **Why this file exists.** The CTO ruling of 2026-07-31 requires that "Implementation complete"
> and "Production verified" stop being the same claim. An increment can be architecturally and
> functionally finished while the evidence that it works against real infrastructure does not yet
> exist. This board records that distinction per increment, and tracks the open evidence gaps so
> they cannot be quietly lost between phases.
>
> Consistent with the [Evidence Policy](docs/engineering/ops/00-README.md): no artifact ⇒
> `NOT VERIFIED`, never inferred. This file lives at the repo root, not in `docs/`, so the
> [ADR-0023](docs/adr/ADR-0023-doc-freeze-and-approval-gate.md) documentation freeze is untouched.

---

## 1. Increment ledger

| # | Increment | Architecture | Implementation | Production verification |
|---|-----------|--------------|----------------|-------------------------|
| I-1 | User / Profile / password domain core | COMPLETE | COMPLETE | PENDING |
| I-2 | Session + rotating refresh token, reuse detection | COMPLETE | COMPLETE | PENDING |
| I-3 | Email verification + password reset (token issuance) | COMPLETE | COMPLETE | PENDING |
| I-4 | Passkeys + device registration, clone detection | COMPLETE | COMPLETE | PENDING |
| I-5 | OAuth / OIDC federation, auto-link takeover guard | COMPLETE | COMPLETE | PENDING |
| I-6a/b | Postgres schema + 9 adapters | COMPLETE | COMPLETE | PENDING |
| I-7a | NestJS composition root, health probes, error mapping | COMPLETE | COMPLETE | PENDING |
| I-7c | Real WebAuthn verifier | COMPLETE | COMPLETE | PENDING |
| I-7d | Real OIDC verifier + token exchanger | COMPLETE | COMPLETE | PENDING |
| **I-7e** | **Outbound email notification adapter** | **COMPLETE** | **COMPLETE** | **PENDING** — see §3 |
| I-7b | REST endpoints | — | NOT STARTED | — |

"Production verification PENDING" is the honest default for every row: no increment has yet run
against deployed infrastructure, because the P0.1 exit gate (live AWS) is itself unverified.

## 2. I-7e — accepted as an infrastructure increment (CTO, 2026-07-31)

**Verdict: CONDITIONALLY ACCEPTED.** Architecture COMPLETE · Implementation COMPLETE ·
Production Verification PENDING.

Confirmed at review: domain unchanged · Ports → Adapters preserved · no vendor leakage · no
secret on domain events · anti-enumeration preserved · failure does not corrupt state · SMTP
confined behind infrastructure · CI green.

**Evidence on record** (commit `e2ac278`, CI run `30596992219`, `ci-gate` SUCCESS):

| Gate | Result |
|------|--------|
| Unit tests (CI, `NEXUS_PG_TESTS=1`) | **404 passed / 0 skipped**, 40 files — the Postgres-container suites genuinely ran |
| Typecheck | 9/9 packages, 0 errors |
| Lint | 0 errors (1 pre-existing warning, predates I-7e) |
| Build | 5/5 |
| Prettier | clean |
| CI | 13 stages green; 4 deploy stages skipped, gated on the un-activated AWS account |

## 3. Tracked evidence gaps — required before production release

These are **not** in I-7e scope and are **not** to be implemented now. They are recorded so that
"implementation complete" can never be mistaken for "production verified".

### FU-1 · Real SMTP integration verification — `NOT VERIFIED`

No message has ever been sent through a real SMTP server. Every test uses a transport double, so
`createSmtpTransport` — the nodemailer wiring itself — carries **no test coverage**; its
correctness rests on review, not evidence.

Evidence required:

- STARTTLS negotiation succeeds against a real server
- `requireTLS` genuinely fails closed when a server offers no STARTTLS (negative test)
- Links render and resolve correctly in delivered mail
- UTF-8 subjects and bodies survive transport intact
- Behaviour confirmed across major providers (Gmail, SES, Mailgun, Postmark)

### FU-2 · End-to-end verification — `NOT VERIFIED`

Blocked on I-7b: nothing calls the orchestrators in production yet. They are reachable only via
`container.useCases` and are covered by tests, not by a live path.

Chain to verify once I-7b exists:
HTTP → use case → notification port → SMTP → user receives the message → link consumed successfully.

### FU-3 · Operational readiness — future work

Deliberately outside I-7e. A failed send is currently not re-attempted; recovery is a
user-initiated resend.

- Retry policy and exponential backoff
- Outbox pattern for durable hand-off
- Dead-letter handling
- Delivery metrics
- Provider health monitoring
- Resend rate limiting (belongs with the HTTP layer)

## 4. P0.2 exit gate — NOT MET

The roadmap gate is "**Login → Dashboard full flow**: passkey/MFA login, RBAC-scoped dashboard,
feature-flag toggle live, every auth/privileged action in the tamper-evident audit log."

P0.2 comprises six pillars. One is deeply built:

| Pillar | State |
|--------|-------|
| Identity (authentication, passkeys, OIDC, sessions, recovery) | Implementation COMPLETE |
| RBAC (+ABAC) | NOT STARTED |
| Organization | NOT STARTED |
| Settings | NOT STARTED |
| Feature flags | NOT STARTED |
| Audit logs | NOT STARTED |

## 5. Next priority

**I-7b (REST endpoints)** — and only after two architectural rulings are resolved:

1. **Session ownership vs. the managed IdP.** [07 §387](docs/07-api-architecture.md) states one
   managed IdP issues access tokens; the I-2 sessions may instead be the BFF session store. Which
   is authoritative determines what the endpoints issue.
2. **ADR-0020 canonical contract source.** OpenAPI / protobuf / GraphQL are required to be
   generated from one source that does not yet exist.

**Explicitly not authorized until then:** RBAC, Organization, Audit, Feature Flags, Commerce, AI,
or any other bounded context.
