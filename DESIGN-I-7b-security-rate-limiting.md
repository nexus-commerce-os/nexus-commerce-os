# Design Proposal — Abuse Protection for Identity HTTP (I-7b-security)

**Status:** 🟡 PROPOSAL — awaiting CTO approval. Nothing here is implemented.
**Requested by:** CTO ruling, 2026-07-31 · **Scope:** design only; implementation is a separate increment.
**Constraint honoured:** no new vendor or infrastructure dependency is assumed as approved. Where one
is required, it is called out as a decision for you, not taken.

> This file is a proposal, not architecture documentation. It touches no ADR and nothing under
> `docs/`, so the [ADR-0023](docs/adr/ADR-0023-doc-freeze-and-approval-gate.md) freeze is untouched.

---

## 1. What is being protected, and against what

| Operation | Abuse it enables | Cost of one attempt |
|---|---|---|
| `login` | Credential stuffing, password spraying | scrypt — deliberately expensive, so this is also a CPU-exhaustion vector |
| `password/reset-requests` | Mailbombing a victim; probing for accounts via timing | one outbound email |
| `email/verification-requests` | Mailbombing; authenticated, so cost is billed to a real session | one outbound email |
| `passkey authentication start` | Challenge-table flooding; ceremony churn | one persisted challenge row |
| `oidc authentication start` | Authorization-request-table flooding | one persisted state row |

Two of these five are **not** primarily authentication concerns — they are *spend* concerns. A reset
flood costs money and reputation with the mail provider, and a ceremony flood costs database rows.
That argues for limiting them even at low thresholds where a login limiter would be too aggressive.

## 2. Enforcement boundary

**Recommendation: enforce in the Identity HTTP layer, as a Nest guard that runs _before_
`SessionAuthGuard`.**

Rejected alternatives, with reasons:

- **Ingress / API gateway only.** Correct for volumetric floods, wrong as the only layer: the gateway
  cannot see *account* identity, so it cannot distinguish 100 logins against 100 accounts from 100
  against one — which is precisely the password-spraying signal. Keep it, but as a coarse outer ring.
- **Inside the use cases.** Would put a transport concern into the application layer and force every
  future caller to re-implement the policy. Also makes the domain aware of IP addresses, which it
  must not be.
- **Inside the domain.** Rate limiting is not an invariant of any aggregate.

The guard consumes a `RateLimiter` **port**, exactly as the notification and access-token work did, so
the storage decision below stays swappable and the controllers stay ignorant of it.

## 3. Identifier strategy

No single identifier is sufficient; the proposal is **two independent buckets, both of which must
pass**, because each covers the other's blind spot.

| Bucket | Key | Catches | Blind to |
|---|---|---|---|
| Network | hashed client IP (+ /64 for IPv6) | one host attacking many accounts | distributed botnets |
| Subject | hashed account identifier | many hosts attacking one account | spray across many accounts |

**The subject key must be hashed with a server-side secret** (reuse the `HmacTokenHasher` pattern, a
distinct pepper). The limiter store would otherwise hold a plaintext list of every address anyone has
ever tried to log in as — an enumeration corpus in its own right, sitting outside the database.

For authenticated operations (`email/verification-requests`) the subject key is the **user id from the
validated principal**, not a submitted field.

## 4. Account-enumeration safety — the hard constraint

This is where naive rate limiting silently destroys work already done.

`SendPasswordReset` deliberately answers 202 for every address and reports delivery failures
out-of-band. A subject-keyed limiter reintroduces the oracle it was built to deny: if
`nobody@example.com` can be submitted forever while `jane@example.com` starts 429-ing, the limiter has
just told the attacker which addresses are real.

**Rules, binding on the implementation:**

1. On the unauthenticated reset and login paths, **the limiter's own response must not vary by whether
   the subject exists.** Bucket on the *submitted* value, not on a lookup result — never consult the
   user repository to decide whether to count.
2. A subject-bucket rejection on `password/reset-requests` must still return **202**, the same as
   success. The request is dropped silently; only the network bucket may return 429.
3. `login` may return 429 — it already distinguishes nothing about existence, and a uniform 429 after
   N attempts leaks nothing, provided the threshold is not conditioned on account existence.
4. The limiter must not be consulted *after* a use case has revealed existence, only before.

Rule 2 is a genuine trade-off: a silent drop is worse UX for a legitimate user who retries. The
alternative is a working enumeration oracle, so the trade is not close.

## 5. Trusted proxy and IP handling

Taking `X-Forwarded-For` at face value makes the network bucket **worse than useless** — an attacker
sets a fresh value per request and gets an unlimited quota, while a spoofed header can pin the limit
onto someone else's address.

Proposal:

- Express `trust proxy` set to an explicit **hop count** matching the deployed topology (ALB → ingress
  → pod), configured, never `true`.
- Take the *rightmost untrusted* address, not the leftmost.
- Refuse to boot if the limiter is enabled and the hop count is unset — a silent default here is a
  silent bypass.
- Hash the address before it is stored or logged (docs/08 treats client IP as personal data).

## 6. Storage

State must be shared: with per-pod memory, the effective limit is `N × pods`, and it resets on every
deploy — an attacker just retries during a rollout.

**This is the decision that needs your approval, because every option is a dependency:**

| Option | For | Against |
|---|---|---|
| **A. Redis / ElastiCache** (recommended) | Purpose-built; atomic `INCR`+`EXPIRE`; sliding windows are cheap; standard | New infrastructure dependency and a new failure domain |
| **B. Postgres table** | No new dependency; we already run it | Puts write load on the money-adjacent primary; row churn and vacuum pressure; couples abuse traffic to the database an attacker is trying to exhaust |
| **C. Gateway-only** | Zero application dependency | Cannot do subject buckets at all — gives up password-spray detection |

I recommend **A**, and note that B's coupling is the real objection: a limiter whose job is to absorb
a flood should not put that flood through the primary datastore.

## 7. Fail-open vs fail-closed

**Recommendation: fail-open for the store, fail-closed for configuration.**

If Redis is unreachable, rejecting all logins converts a cache outage into a total authentication
outage — the limiter becomes the most effective denial-of-service in the system. So a store error
**allows** the request, increments a metric, and fires an alert.

But a *misconfigured* limiter (missing hop count, unset thresholds) must **refuse to boot**. The
distinction: an outage is transient and observable; a misconfiguration is silent and permanent, and a
limiter everyone believes is on is worse than one everyone knows is off.

Failing open is a deliberate acceptance of risk during an outage, and must be paired with an alert
that is actually routed, not merely emitted.

## 8. `Retry-After` semantics

- 429 responses carry `Retry-After` in **seconds** (delta form; absolute dates invite clock-skew bugs).
- The value is the true remaining window, **rounded up**, never a fixed constant.
- Problem detail keeps the approved RFC 9457 shape with `code: "RateLimited"`; the header carries the
  timing, so no new body field is introduced.
- **Silent-drop paths (reset requests) send no `Retry-After`** — it would restore the very signal §4
  removes.
- No `X-RateLimit-*` headers on unauthenticated endpoints: publishing remaining quota per key hands an
  attacker a free calibration tool.

## 9. Test strategy

Against a fake clock and an in-memory limiter double — the port makes both possible without Redis:

1. **Threshold** — N allowed, N+1 rejected, allowed again after the window.
2. **Bucket independence** — one IP exhausting its quota does not limit a different IP; one subject
   does not limit another.
3. **Enumeration parity** — the strongest test: drive the reset endpoint past the threshold for a real
   address and an unknown one, and assert the two response sequences are **byte-identical**, including
   status, body and headers. This is the test that would have caught the mistake §4 describes.
4. **Spoofing** — a forged `X-Forwarded-For` does not create a fresh bucket beyond the configured hops.
5. **Fail-open** — a store that throws allows the request and increments the failure metric.
6. **Fail-closed config** — missing hop count or thresholds fails `loadIdentityConfig`, asserted like
   every other config rule.
7. **`Retry-After`** — present and monotonically decreasing on 429; **absent** on silent-drop paths.
8. **Guard ordering** — the limiter runs before `SessionAuthGuard`, so an unauthenticated flood cannot
   force session lookups.

## 10. What this proposal deliberately does not do

- No implementation, no dependency added, no config keys introduced.
- No limits on the authenticated management endpoints (`logout`, `logout-all`, `password/change`) —
  they already require a valid session, and the session lifecycle bounds them.
- No CAPTCHA, no proof-of-work, no device fingerprinting. Each is a product decision with privacy and
  accessibility consequences well outside this increment.
- No account lockout. Lockout is itself a denial-of-service primitive against a known address; if it
  is wanted, it needs its own ruling.

## 11. Decisions required from the CTO

1. **Storage** — approve option A (Redis/ElastiCache), or direct B or C. Blocks implementation.
2. **Fail-open on store failure** — confirm the risk acceptance in §7.
3. **Silent-drop on reset requests** (§4 rule 2) — confirm the UX trade in favour of enumeration safety.
4. **Thresholds** — proposed starting points, to be tuned against real traffic:
   `login` 10/5 min per IP and 5/15 min per subject; `password/reset-requests` 5/hour per subject and
   20/hour per IP; `email/verification-requests` 3/hour per user; ceremony starts 20/5 min per IP.
