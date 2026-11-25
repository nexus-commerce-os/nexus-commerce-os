# Releasing honesttotal.com

The website is not the services. It ships from `release/product-catalog` as a
Cloudflare Worker, by a path that has nothing to do with `cd-prod.yml`, AWS or
the image pipeline. This is that path, written down because until recently it
existed only as a command somebody remembered.

Everything here was measured on 20 November 2026 unless it says otherwise.

---

## 1. What is actually deployed, and from where

| | |
|---|---|
| branch | `release/product-catalog` — **not `main`** |
| Worker | `honesttotal`, custom domains for apex and `www` |
| assets | `apps/web/out`, from `next build` with `output: 'export'` |
| state | Workers KV namespace bound as `WAITLIST` |
| server routes | exactly one: `POST /api/waitlist` |

`main` has no `wrangler.toml`. Merging anything into `main` changes nothing on
the public site. This surprises people, so it is the first line of this file.

## 2. Before a release

- [ ] **Every legal fact filled.** `pnpm --filter @nexus/web release-gate`
      prints what is outstanding and exits non-zero if anything is. It runs
      automatically on `deploy:cf` and on a bare `wrangler deploy`.
- [ ] **Contact address proven to receive mail.** Cloudflare Email Routing
      showing a rule as Active proves the routing exists, not that a message
      arrives. Send one to each published address and confirm it lands.
      Confirmed for `support@` and `privacy@` on 22 November 2026; re-check if
      the destination or the rules change. **Test from a different mailbox** —
      a message sent from the destination account to an address that forwards
      back to it may never appear, and Cloudflare's own docs warn that "Some
      providers discard messages that appear to come from the same account
      they are being delivered to." `hello@` remains an active route and is no
      longer published anywhere.
- [ ] **CI green on the branch being deployed**, not on a rebase of it.
- [ ] **Two repository secrets exist**: `CLOUDFLARE_API_TOKEN` scoped to *Edit
      Cloudflare Workers* and nothing wider, and `CLOUDFLARE_ACCOUNT_ID`.
- [ ] **Record what is live now.** `npx wrangler deployments list` in
      `apps/web`. That version id is the rollback and nothing else records it.

## 3. Deploying

Preferred, because it leaves a record:

> Actions → **deploy-web** → Run workflow → type `DEPLOY`.

It runs the gate, lints, typechecks, builds, deploys, then checks that `/`,
`/privacy`, `/terms` and `/faq` answer 200 and that `GET /api/waitlist` still
answers 405. A deploy that reports success over a broken site is the failure
worth catching.

From a machine, if the workflow is unavailable:

```
pnpm --filter @nexus/web deploy:cf
```

Never `npx wrangler deploy` on its own. It works, and the `[build]` hook in
`wrangler.toml` makes the gate run, but nothing records what was deployed or by
whom.

## 4. After deploying

- [ ] `/`, `/privacy`, `/terms`, `/faq`, `/cookies`, `/disclosure` → 200
- [ ] `GET /api/waitlist` → 405, `Content-Type: application/json`
- [ ] A real `POST` round trip, then the same address again → `duplicate`
- [ ] Security headers present on a page **and** on `/api/waitlist` — they come
      from two different mechanisms and either can regress alone
- [ ] No `Set-Cookie` on any path. The privacy notice states this as a fact a
      reader can check, so it is a release criterion and not a nicety.

## 5. Rolling back

```
cd apps/web
npx wrangler deployments list     # find the previous version id
npx wrangler rollback <version-id>
```

Then re-run the checks in §4 against the rolled-back site. Rollback restores
the Worker and its assets. It does **not** restore KV contents, because
deployments do not touch KV — a signup recorded under the bad version is still
there afterwards, which is the behaviour you want.

**Never touch during a release:** apex MX, SPF, the Email Routing DKIM records,
or the apex/`www` custom domain bindings. None of them is part of a deploy, and
all of them are easy to break while nearby.

## 6. Things that are true today and would quietly stop being true

- **Bot Fight Mode is off.** Turning it on makes Cloudflare set `__cf_bm`,
  which makes the cookie notice false the same hour. If it is ever enabled, the
  cookie notice and the privacy notice must change first.
- **One rate-limiting rule exists**, on `POST /api/waitlist` only: 5 requests
  per 10 seconds per IP, block for 10 seconds. The free plan allows exactly one
  rule, so a second protection elsewhere means choosing between them.
- **KV on the free plan allows 1,000 writes a day** and every signup is a
  write. The in-Worker throttle is per-isolate and is a speed bump; the
  Cloudflare rule is the real edge control.
- **`_headers` does not apply to responses the Worker generates.** Anything
  added to `/api/*` needs its headers set in `worker/index.ts`.

## 6b. Running the test suites locally

`pnpm -s test` runs every workspace. Two of them need things this repo does not
start for you, and a failure there is not a failure of the website.

| suite | needs | without it |
|---|---|---|
| `@nexus/auth` | Postgres and Redis reachable on the ports in its test config | `rate-limit.guard` tests time out after 5s; the two `postgres-*` suites report `0 test` |
| everything else | nothing | passes offline |

So a clean local run of the WEB surface is:

```
pnpm --filter @nexus/web build     # release-gate, gate-catalog, verify-* all run here
pnpm --filter @nexus/web lint
pnpm --filter @nexus/web typecheck
```

CI runs all of it, including `@nexus/auth`, with the services available. If a
suite fails locally and passes in CI, check this table before looking for a
bug.

**If eslint dies with `Cannot set properties of undefined (setting 'defaultMeta')`**
it is not a lint error. `@eslint/eslintrc` depends on `ajv@^6`; if an
interrupted or `--ignore-scripts` install leaves that link missing, Node walks
up and finds the hoisted `ajv@8`, whose API differs. Repair it with:

```
pnpm install --force
```

Nothing in the repository needs changing; the lockfile already pins both.

## 7. What has been proven, and how

Header behaviour is no longer an assumption. On 22 November 2026 the real
build was deployed to a throwaway Worker on `workers.dev` — different name, no
`routes` block, its own KV namespace — measured, and then the Worker and its
namespace were deleted. Production was checked before and after and never
changed.

| | |
|---|---|
| static page | all six `_headers` rules applied by Cloudflare, plus COOP and CORP |
| `/api/waitlist` | `x-content-type-options`, `x-frame-options`, `referrer-policy`, HSTS, `cache-control: no-store` |
| the API's CSP | **`default-src 'none'`** — the Worker's own, not the page's |
| `Set-Cookie` | none, on any path |
| API behaviour | 405 wrong method · 400 malformed · 422 invalid · 200 added · 200 duplicate · 429 with `retry-after` |

That third row is the one worth keeping. The page CSP never reached the API
response, which is Cloudflare's documented behaviour — `_headers` rules "are
not applied to responses generated by your Worker code" — confirmed against a
real response rather than trusted. Setting the headers in `json()` was
necessary, not belt-and-braces.

`staging-verify.yml` reproduces this run end to end and needs the two secrets
in §2. Re-run it after any change to `_headers`, to `worker/index.ts`, or to
the Cloudflare account's security settings, because every one of those can
move a header without touching a test.

Still genuinely unproven: nothing on the static site. The remaining unknowns
are operational — whether a Cloudflare feature is later enabled that sets a
cookie (§6), and whether the deploy workflow's own credentials work, which
only its first run can show.
