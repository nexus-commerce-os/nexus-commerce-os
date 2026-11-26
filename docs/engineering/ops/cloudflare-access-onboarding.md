# Cloudflare Access — the exact steps only the founder can take

Everything the application needs is already written and tested
(`packages/shared/src/access-jwt.ts`, 21 tests). What is missing is an Access
application, and creating one requires enrolling the account in Zero Trust,
which is an account action.

**Nothing below involves a payment.** If any screen asks for a card or a plan
upgrade, stop and say so rather than continuing — the free plan is what this
design assumes, and the one place that could change is the enrolment step.

## 1. Enrol in Zero Trust

1. Open <https://dash.cloudflare.com> and choose the account
   **Samsuzzaman@gmail.com** (id `04f102b513f093dc3290a761a22f5669`).
2. In the left sidebar, open **Zero Trust**.
3. Choose a **team name**. It becomes part of a permanent domain,
   `https://<team>.cloudflareaccess.com`, so pick something you are happy to
   keep — `honesttotal` is the obvious choice.
4. On the plan screen choose **Free** (up to 50 users).

> **If a card is requested.** Cloudflare has historically asked for payment
> details at this step even for the free plan. That is the one decision only
> you can make. If you would rather not, say so: the alternative is to keep the
> password path, which works but is capped at **100,000 PBKDF2 iterations** by
> the Workers runtime against a current OWASP recommendation of 600,000. A
> pepper mitigates a database-only compromise; it does not close that gap.

**Tell me the team name afterwards.** Nothing else from this step is needed.

## 2. Create the Access application

Zero Trust → **Access** → **Applications** → **Add an application** →
**Self-hosted**.

| field | value |
|---|---|
| Application name | `HonestTotal admin` |
| Session duration | `8 hours` |
| Domain | `honesttotal.com`, path `admin` |

Then **Add policy**:

| field | value |
|---|---|
| Policy name | `Founder only` |
| Action | **Allow** |
| Include | **Emails** → your own address |

Add nothing else to Include. One allow policy with one email is the whole
intended access list today, and a group or a domain rule would silently widen
it later.

## 3. Send me two values

From the application's **Overview** tab:

- the **Application Audience (AUD) Tag** — a 64-character hex string;
- the **team domain**, `https://<team>.cloudflareaccess.com`.

**Neither is a secret**, so chat is a fine place for them: the AUD tag
identifies an application, and the team domain is in every certificate URL.
Do not send any API token, and do not send a `CF_Authorization` cookie value —
that one *is* a credential.

## 4. What happens then, without you

- the AUD tag and team domain go in `wrangler.toml` as plain `vars`;
- `/admin` and every `/api/admin/*` route start verifying
  `Cf-Access-Jwt-Assertion` before anything else runs;
- application roles (`owner` / `operator` / `viewer`) stay in the database.
  Access answers *who is this*; it does not decide what they may do, and
  revoking a role must not require an Access policy change.

## Why the application still verifies the token itself

Putting Access in front of a hostname protects **that hostname**. The origin is
still reachable by other routes — `*.workers.dev`, a preview deployment, a
Worker route Access does not cover — and on those the header is
attacker-controlled. So the Worker checks the signature against the team's
published keys, the `kid`, an RS256 allow-list, the issuer, the **audience**,
`exp` and `nbf`, every time.

The audience check is the one most often skipped and the most expensive to
skip: every application in a team is signed by the same keys, so a token minted
for a low-privilege application is a perfectly valid signature at the admin
console. There is a test named for exactly that.

## Until this is done

No `/admin` route exists, and a test enforces that. The dashboard is being
built against the verification module with local test identities; it will not
be exposed before Access is operational.
