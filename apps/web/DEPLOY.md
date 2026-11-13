# Deploying the HonestTotal marketing site

The site is one landing page, two legal pages, an internal component gallery and
one API route. No database, no accounts, no payments. AWS is not involved and
`cd-prod.yml` does not apply — that pipeline promotes signed container images to
a Kubernetes cluster, which this is not.

---

## 1. Owner actions, in order

### 1.1 Choose an email service provider

The waitlist has **no database by design**. `src/lib/waitlist.ts` already ships an
ESP driver, so a durable list costs one environment variable and zero code. The
provider also owns unsubscribe handling and the launch send, which is most of
why an ESP is the right destination rather than a table.

Any provider with an HTTP endpoint that accepts a JSON POST works. The driver
sends:

```json
{ "email": "someone@example.com", "source": "web", "createdAt": "2026-11-13T09:00:00.000Z" }
```

with `authorization: Bearer <token>` when a token is configured. Candidates that
fit without an adapter change: Buttondown, Loops, Resend Audiences, ConvertKit,
Mailchimp (via a Zapier/Make webhook if its API shape differs).

> If the chosen provider needs a different body shape, that is a change to
> `HttpEspWaitlistStore` only — the route and the page do not move.

### 1.2 Set the environment variables

In Vercel → Project → Settings → Environment Variables, for **Production** and
**Preview**:

| name | value | required |
|---|---|---|
| `WAITLIST_ESP_URL` | the provider's endpoint | **yes** |
| `WAITLIST_ESP_TOKEN` | the provider's API token | only if the provider needs one |

**Without `WAITLIST_ESP_URL`, production refuses to store anything.** That is
deliberate: the alternative was an in-memory store that returns 200, thanks the
visitor, and loses the address at the next cold start, with nothing logged. The
build still succeeds; the sign-up returns a clean 502. See
[`src/lib/waitlist.ts`](src/lib/waitlist.ts).

### 1.3 Fill in the legal placeholders

[`src/app/legal/legal.tsx`](src/app/legal/legal.tsx) holds six facts only you
have. They render as visible `[PLACEHOLDERS]` until filled:

- `operator` — the legal entity that controls the data
- `address` — its registered address
- `contact` — the address that receives privacy requests
- `esp` — the provider chosen in 1.1
- `espCountry` — where that provider hosts the data
- `jurisdiction` — the governing law for the Terms

**This is enforced, not just documented.** `scripts/release-gate.mjs` runs as
`prebuild`, so it runs on every `next build` including Vercel's, and **fails the
build when `VERCEL_ENV=production`** while leaving PR CI, preview deploys and
local builds green with a notice listing what is outstanding. Check before
deploying:

```bash
cd apps/web && pnpm release-gate      # exits 1 while any placeholder remains
```

A production deployment cannot serve the site until this passes.

### 1.4 Create the Vercel project

| setting | value | why |
|---|---|---|
| Framework | Next.js | auto-detected |
| **Root Directory** | **`apps/web`** | it is a pnpm workspace; the install still happens at the repo root |
| Install Command | leave default | Vercel detects pnpm from `packageManager` in the root `package.json` |
| Build Command | leave default (`next build`) | |
| Node version | 20.x or 22.x | the repo requires `>=20` |
| Plan | **Pro** | Vercel restricts Hobby to non-commercial use. Confirm current pricing at vercel.com/pricing |

`@nexus/ui` ships raw TypeScript (`main: src/index.ts`) and is already listed in
`transpilePackages`, so no build step is needed for it.

**Verified locally against a production build** (`next build` + `next start`):

| | |
|---|---|
| build | compiles, 9/9 static pages |
| `/` | static, 7.6 kB, 94.9 kB First Load JS |
| `/privacy` `/terms` `/ui` `/robots.txt` | static |
| `/api/waitlist` | server-rendered on demand |
| React hydration under the CSP | **confirmed in a browser** — `form.__reactProps$.onSubmit` is a function |
| headers served | CSP, HSTS, nosniff, DENY, Referrer-Policy, Permissions-Policy; `x-powered-by` absent |
| waitlist end to end | submitted in the browser, arrived at a local ESP stub as `POST` + `Bearer` + `{email,source,createdAt}` |
| honeypot | a direct POST with the trap filled returns 200 and **does not reach the provider** |
| build without `WAITLIST_ESP_URL` | still succeeds; the sign-up returns 502 at request time |

> **A CSP note worth reading before tightening it.** `script-src` allows
> `'unsafe-inline'` deliberately. With `script-src 'self'` the page renders but
> **does not hydrate** — Next streams its RSC payload through inline `<script>`
> tags — so the waitlist form silently does nothing while the page looks
> perfect. A per-request nonce was implemented and also failed: a nonce cannot
> exist in statically prerendered HTML, and `'strict-dynamic'` then blocked the
> bundles too. Both were measured in a browser, not reasoned about. The full
> reasoning and the conditions for revisiting it are in `next.config.mjs`.

### 1.5 Turn on rate limiting

Do this **before** connecting the domain — `/api/waitlist` is an unauthenticated
write endpoint and the honeypot only stops naive bots.

**Vercel Firewall (no code, recommended):** Project → Firewall → Rate Limiting.

| field | value |
|---|---|
| Path | `/api/waitlist` |
| Method | `POST` |
| Limit | 5 requests per 10 minutes |
| Key | IP address |
| Action | Deny (429) |

Five sign-ups per IP per ten minutes is far above any real person and far below
anything worth scripting. Add a second, looser rule at the origin level — say
60 requests/minute per IP across `/:path*` — so a flood cannot exhaust the
function budget even on paths that are static.

**If the firewall is unavailable on the plan,** the code-level fallback is a
fixed-window counter in Upstash Redis keyed on the client IP, applied at the top
of the route handler. That adds a dependency, a second provider and a failure
mode the route has to decide about (fail open, or fail closed and refuse
sign-ups when Redis is down). The firewall avoids all three, which is why it is
the recommendation rather than the fallback.

### 1.6 Deploy to preview and smoke-test

Push the branch; Vercel builds a preview URL. Then, against the **preview**:

```
[ ] the landing page renders, and says HonestTotal — not NEXUS
[ ] every sample figure has "Illustrative example — not a verified live offer" beside it
[ ] /privacy and /terms render, with no [PLACEHOLDERS] visible
[ ] the signup consent line and both policy links are present under the form
[ ] a real address submits and ARRIVES IN THE ESP — check the provider's list
[ ] a malformed address is refused client-side with no network request
[ ] /ui returns X-Robots-Tag: noindex (curl -I)
[ ] /robots.txt disallows /ui and /api/
[ ] response headers include CSP, HSTS, nosniff, X-Frame-Options (curl -I)
[ ] the browser console is free of CSP violations
[ ] the rate-limit rule fires on the 6th POST from one IP
```

The fifth line is the one that matters. A 200 from the form proves the route ran;
only the provider's list proves the address was kept.

### 1.7 Connect the domain

Vercel → Project → Settings → Domains → add `honesttotal.com` and
`www.honesttotal.com`, then follow Vercel's instructions at the registrar/DNS
host. Verify afterwards:

```
[ ] https://honesttotal.com serves the site with a valid certificate
[ ] http:// redirects to https://
[ ] one of apex/www redirects to the other (pick one as canonical)
[ ] the full 1.6 smoke list passes against the public URL
[ ] submit one real address and confirm it reaches the ESP
```

---

## 2. Rollback

Vercel keeps every deployment. Project → Deployments → the previous one →
**Promote to Production**. It is immediate and needs no rebuild, because the
artifact already exists.

That is the entire rollback story for this release, and it is adequate: the site
is stateless and the only durable thing — the waitlist — lives in the ESP, so
rolling the site back cannot lose a sign-up. The `Rollback PROVEN` job in
`ci.yml` and the `rollback_proof_id` that `cd-prod.yml` demands belong to the
container pipeline and are not in this path.

---

## 3. What is deliberately NOT live

Catalog ingestion, CJ feed retrieval, affiliate links, merchant offers and
payments are all disabled and stay disabled until separately verified. Nothing
in this app imports `services/catalog`, and the landing page publishes no
merchant link and no real price.

---

## 4. Recurring work this creates

- **Base-image drift.** Not this app's concern, but the container gate uses
  `ignore-unfixed` against a floating base tag, so it goes red on its own when
  Debian publishes a fixed advisory. Worth a Renovate rule on the Dockerfile base.
- **Legal pages.** Revisit when analytics, cookies or any third-party script is
  added — the privacy notice currently promises there are none, and that promise
  is testable.
- **ESP retention.** The notice commits to deleting the list 24 months after
  launch, or sooner on request. Someone has to actually do that.
