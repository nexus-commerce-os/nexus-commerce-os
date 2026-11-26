# Administrative authentication — what it is, and what it is not

**26 November 2026.** This records a decision that was challenged and changed,
including the part that is still unresolved.

## The challenge was correct

The first implementation used PBKDF2-HMAC-SHA256 at 100,000 iterations and
justified that number by saying it is the maximum Cloudflare Workers allows.

That is true and it is not a security argument. **OWASP's current
recommendation for PBKDF2-HMAC-SHA256 is 600,000 iterations** (Password Storage
Cheat Sheet, read 26 Nov 2026). 100,000 is one sixth of it. So:

> **PBKDF2 on Cloudflare Workers cannot meet current password-storage
> guidance.** A platform ceiling explains why the number is low. It does not
> make the number adequate.

OWASP's preference order is Argon2id, then scrypt, then bcrypt, with PBKDF2
reserved for FIPS-140 contexts. Neither Argon2id nor scrypt is in WebCrypto;
both would mean shipping WASM into the request path.

## What was done instead

A **pepper**, which OWASP describes for exactly this purpose:

```
stored = PBKDF2( HMAC-SHA256(password, PEPPER), salt, 100_000 )
```

The pepper is a secret held **outside the database** — a Worker secret, never
in D1, never in a backup, never in this repository.

The reasoning is about threat models, not about adding a step. Iteration count
exists to slow an **offline** attack on a stolen hash. A pepper removes that
attack: a stolen database contains nothing crackable, because the key it needs
was never in the database. OWASP puts it plainly — a pepper "prevents an
attacker from being able to crack any of the hashes if they only have access to
the database."

Enforced, and tested:

| | |
|---|---|
| absent or <32-character pepper | **throws** — not a degraded mode, a different threat model |
| correct password under the **wrong** pepper | **fails** — proves the pepper is actually applied |
| un-peppered `pbkdf2$...` row | **refused**, never verified |
| stored scheme id | `pbkdf2-hmac$...`, so a peppered hash can never be confused with a plain one |

That last one matters more than it looks: a verifier that accepted both schemes
would let a single legacy row silently reinstate the offline attack.

## What a pepper does NOT do

Stated here so it is not oversold:

- **It does not help if the attacker also has the Worker's secrets.** Database
  compromise and platform compromise are different events; this defends the
  first, not the second.
- **It cannot be rotated without every user setting a new password.** The
  pepper is mixed into the stored value, so changing it invalidates every hash.
  Plan a rotation as a forced reset, not as a config change.
- **It does not raise the iteration count.** An attacker who has both the
  database and the pepper faces 100,000 iterations, which is below guidance.
  That is the residual risk, and it is why the next section exists.

## The real answer, and why it is not chosen yet

The durable fix is to **stop storing passwords at all** — managed identity or
passkeys. Cloudflare Access is the obvious candidate: it would sit in front of
`/admin` and the Worker would verify a signed `Cf-Access-Jwt-Assertion` header
rather than a password.

It is **not** adopted, for one reason: **whether Access is included on the free
plan could not be verified from Cloudflare's own documentation.** The Zero
Trust pages state that free and paid plans exist and that "access to certain
features depends on a customer's plan type", without saying which plan includes
Access or what the free user limit is. One-Time PIN and social login appear in
the policy documentation without a plan attached.

An authentication decision made on an assumption about pricing is a bad
decision even when the assumption turns out to be right. **This needs one check
in the Cloudflare dashboard**, and it is the single highest-value thing the
founder could confirm for this milestone. What is verified and ready:

- Access sends `Cf-Access-Jwt-Assertion`; the origin **must** validate it, or
  anything that bypasses Access reaches the origin unauthenticated;
- public keys at `https://<team>.cloudflareaccess.com/cdn-cgi/access/certs`,
  rotated every 6 weeks with a 7-day overlap, matched by `kid`;
- claims to check: `iss` = team domain, `aud` = the application's AUD tag,
  `exp`, `nbf`; algorithm RS256;
- Workers can use `ctx.access` and skip manual JWT parsing entirely;
- an Access application can cover a **path**, e.g. `example.com/admin`.

## Operational rules

- **No default administrator password exists, and none may be committed.**
  Enrolment creates the first owner from a one-time token, and the password is
  set by the person, never shipped.
- `ADMIN_PASSWORD_PEPPER` is set with `wrangler secret put`. It is not in
  `wrangler.toml`, not in `.dev.vars` committed to the repo, and not in D1.
- Password minimum is 12 characters, enforced at the hashing boundary rather
  than in a form, because a form is not a control.

## Still to build before any admin route is exposed

- login rate limiting and lockout,
- session rotation on privilege change,
- CSRF defence for state-changing requests (SameSite=Strict is necessary, not
  sufficient),
- secure first-owner enrolment,
- account recovery that does not become a second way in.

A test asserts the Worker routes nothing under `/admin` until these land.
