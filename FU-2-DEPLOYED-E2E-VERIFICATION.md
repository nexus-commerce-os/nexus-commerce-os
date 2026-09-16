# FU-2 — Deployed End-to-End Verification Package

**Status:** 🟡 PREPARED, NOT EXECUTED. **Operator-run, blocked on infrastructure.**
**Prepared:** 2026-07-31 · **Blocked on:** AWS environment activation (P0.1 exit gate).

> Requests no credentials and contains no secrets. Sensitive values are recorded as *properties*
> ("chain valid", "TLS 1.3"), never as values.
>
> Operational planning, not architecture documentation — repo root, so the
> [ADR-0023](docs/adr/ADR-0023-doc-freeze-and-approval-gate.md) freeze is intact. Infrastructure
> procedure itself is **not duplicated here**: the environment is stood up using the existing
> [Operations Manual](docs/engineering/ops/00-README.md) (Ch1 GitHub → Ch8 Exit-Gate Validation), and
> results are recorded in its [Verification Ledger](docs/engineering/ops/11-verification-ledger.md).
> This file covers only what those chapters do not: proving the Identity service works end to end
> once deployed.

---

## 1. Why this cannot be done in CI

Every automated suite runs against in-process or containerised dependencies. What remains unproven is
everything that only exists in a deployed environment: TLS termination at the ingress, the real
Postgres and Redis endpoints, the real secret store, the `/v1` prefix behind a load balancer, DNS,
and the link in a delivered message resolving back to a reachable application.

FU-2 is therefore **not a test to be written**. It is an execution, and it cannot begin until the
AWS environment exists.

## 2. Prerequisites

| # | Prerequisite | Source |
|---|---|---|
| 1 | AWS account activated | Founder |
| 2 | P0.1 exit gate PASS | [Ops Ch8](docs/engineering/ops/08-exit-gate-validation.md), ledger all-PASS |
| 3 | Identity service deployed to staging | Ops Ch5 / Ch7 |
| 4 | Postgres reachable, migrations `0001` and `0002` applied | `MigrationRunner` on boot |
| 5 | Redis reachable | `REDIS_URL` configured |
| 6 | Mail provider configured and FU-1 provider verification passed | [FU-1 package](FU-1-STAGING-SMTP-VERIFICATION.md) |
| 7 | A mailbox the operator controls | — |

If any prerequisite is unmet, stop and record it. **Do not substitute a local stand-in** — doing so
reproduces the CI evidence we already have and proves nothing new.

## 3. The chain to verify

```
HTTP (through the real ingress)
  → AuthController
  → use case
  → Postgres  (token persisted as a hash)
  → notification port
  → real SMTP provider
  → the operator's mailbox
  → link opened in a browser
  → token consumed
  → session/credential state changed as expected
```

Every hop must be observed. A step that was assumed rather than seen is `NOT VERIFIED`.

## 4. Procedure

Run against **staging**. Record the service commit before starting.

### 4.1 Boot and readiness

| # | Step | Expected |
|---|---|---|
| 1 | Deploy and check `/healthz` | 200, without touching the database |
| 2 | Check `/readyz` | 200 once Postgres answers |
| 3 | Stop Postgres, re-check `/readyz` | fails; `/healthz` still 200. Restore |
| 4 | Blank one required env var and redeploy | pod **refuses to start**, naming the variable. Restore |

Step 3 matters: if liveness consulted the database, a database blip would restart healthy pods and
turn a partial outage into a total one.

### 4.2 Registration and session

| # | Step | Expected |
|---|---|---|
| 5 | `POST /v1/auth/register` | 201; body is exactly `id`, `email`, `emailVerified` |
| 6 | `POST /v1/auth/login` | 200; `session`, `accessToken`, `expiresAt`, `refreshToken`; `session.deviceId` is `null` |
| 7 | Call an authenticated route with the access token | 200 |
| 8 | Call it with the **refresh** token instead | 401 |
| 9 | `POST /v1/auth/session/refresh` | 200; a different refresh token |
| 10 | Replay the consumed refresh token | rejected; session revoked (reuse detection) |

### 4.3 Email verification — the full FU-2 chain

| # | Step | Expected |
|---|---|---|
| 11 | `POST /v1/auth/email/verification-requests` | 202 |
| 12 | Inspect the message in the real mailbox | delivered; link intact |
| 13 | Confirm the DB stores only a hash | no raw token in `identity.verification_token` |
| 14 | Open the link | consumed; address verified |
| 15 | Re-open the same link | rejected |

### 4.4 Password reset and enumeration safety

| # | Step | Expected |
|---|---|---|
| 16 | `POST /v1/auth/password/reset-requests` for a **real** address | 202, empty body, **no** `Retry-After` |
| 17 | Same for an address that does not exist | **byte-identical** response |
| 18 | Complete the reset from the emailed link | 204 |
| 19 | Log in with the new password | 200 |
| 20 | Confirm earlier sessions were revoked | old access token now 401 |

Step 17 is the one to run carefully. Any difference — status, body, headers, or a noticeably
different response time — is an enumeration oracle and a **failure**.

### 4.5 Abuse protection against real Redis and a real ingress

| # | Step | Expected |
|---|---|---|
| 21 | Exceed the login threshold from one client | 429 with a sane `Retry-After` |
| 22 | Repeat from a second client | unaffected |
| 23 | Exceed the reset threshold | still 202, still no `Retry-After` |
| 24 | Send a forged `X-Forwarded-For` | no fresh quota — the configured hop count holds behind the real ingress |
| 25 | Scale to 2+ replicas and exceed the threshold across them | the limit is shared, not per-pod |
| 26 | Stop Redis and retry | requests **succeed** (fail open) and degradation is logged. Restore |

Steps 24 and 25 are the two that only a real deployment can prove: hop counting depends on the actual
ingress topology, and shared counting is the entire reason Redis is there.

### 4.6 Device binding and revocation

| # | Step | Expected |
|---|---|---|
| 27 | Register a passkey and sign in with it | 200; `session.deviceId` is a uuid |
| 28 | Attempt a login supplying `deviceId` | 400 `ContractViolation` |
| 29 | Revoke the device | bound session's access token now 401 |
| 30 | Confirm an unbound session survives | still 200 |

## 5. Operator checklist

Tick only what was observed. Anything unobserved is `NOT VERIFIED`.

- [ ] Prerequisites 1–7 all met
- [ ] `/healthz` independent of the database (4.1 step 3)
- [ ] Pod refuses to start on missing configuration
- [ ] Register / login / authenticated call
- [ ] Refresh token rejected as a request credential
- [ ] Refresh rotation and reuse detection
- [ ] Verification mail delivered, link consumed, replay rejected
- [ ] Only a hash stored for the verification token
- [ ] Reset mail delivered, reset completed, old sessions revoked
- [ ] **Known and unknown reset addresses byte-identical**
- [ ] Rate limit returns 429 with `Retry-After`
- [ ] Reset throttling stays silent (202, no `Retry-After`)
- [ ] Forged `X-Forwarded-For` grants no fresh quota
- [ ] Limit shared across ≥2 replicas
- [ ] Redis outage fails open, and is logged
- [ ] Passkey session carries a real `deviceId`
- [ ] Client-nominated `deviceId` rejected
- [ ] Device revocation revokes bound sessions only
- [ ] Evidence captured, secrets redacted

## 6. Evidence template

```
FU-2 DEPLOYED END-TO-END VERIFICATION
Date (UTC):
Operator:
Environment:              staging
Service commit:
Replica count:
Ingress:                  [ALB | other]
Trusted proxy hops configured:

PREREQUISITES
  AWS activated:          [yes | no]
  P0.1 exit gate:         [PASS | FAIL]  Ledger ref:
  Migrations applied:     [0001, 0002]
  Redis reachable:        [yes | no]
  FU-1 provider verified: [yes | no]  Provider:

HEALTH
  /healthz independent of DB:     [pass | fail]
  /readyz reflects DB:            [pass | fail]
  Refuses to boot unconfigured:   [pass | fail]

SESSION LIFECYCLE
  Register / login / authenticated call:  [pass | fail]
  Refresh token refused as credential:    [pass | fail]
  Rotation + reuse detection:             [pass | fail]

MAIL CHAIN
  Verification delivered:   [pass | fail]  Delivered at (UTC):
  Link consumed:            [pass | fail]
  Replay rejected:          [pass | fail]
  Token stored hashed only: [pass | fail]
  Reset delivered:          [pass | fail]  Delivered at (UTC):
  Reset completed:          [pass | fail]
  Sessions revoked after reset: [pass | fail]

ENUMERATION SAFETY
  Known vs unknown responses identical:   [pass | fail]
  Status / body / headers compared:       [list]
  Response-time difference observed:      [none | describe]

ABUSE PROTECTION
  429 + Retry-After:                [pass | fail]
  Second client unaffected:         [pass | fail]
  Reset throttling silent:          [pass | fail]
  Forged XFF grants no quota:       [pass | fail]
  Limit shared across replicas:     [pass | fail]  Replicas:
  Redis outage fails open + logged: [pass | fail]

DEVICE BINDING
  Passkey session has deviceId:     [pass | fail]
  Client-nominated deviceId refused:[pass | fail]
  Revocation scoped to bound only:  [pass | fail]

ATTACHMENTS
  Raw message source (redacted):
  Screenshots:
  Log excerpts (redacted):

RESULT
  FU-2:                     [VERIFIED | NOT VERIFIED]
  Anomalies:
```

## 7. Completion criteria

FU-2 is **COMPLETE** only when the §5 checklist is fully ticked from observation, the §6 evidence is
attached, and every anomaly is either resolved or recorded as an accepted risk with a CTO ruling.

Partial completion is recorded as partial. A step that could not be run — because a prerequisite was
missing — is `NOT VERIFIED`, never inferred from a passing CI suite.
