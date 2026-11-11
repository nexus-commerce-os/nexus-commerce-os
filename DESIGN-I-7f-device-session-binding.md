# Design & Impact Report — I-7f Strong Device/Session Binding

**Status:** 🟡 DESIGN — awaiting CTO approval. **No production code has been written.**
**Requested by:** CTO ruling, 2026-07-31 · **Depends on:** I-7b (complete, `e7c38db`)

> Operational planning, not architecture documentation. Touches no ADR and nothing under `docs/`, so
> the [ADR-0023](docs/adr/ADR-0023-doc-freeze-and-approval-gate.md) freeze is untouched.

---

## 1. Current `Session.deviceBinding` usage

Verified against the code, not recalled:

| Where | Today |
|---|---|
| Domain | `Session.deviceBinding: string \| null`, set once at `Session.start`, never mutated afterwards |
| Schema | `identity.session.device_binding text NULL` — **no foreign key, no index, no CHECK** |
| `StartSession` | `deviceBinding?: string` on the command, stored verbatim as `?? null` |
| `login` (HTTP) | **client-supplied arbitrary string**, unvalidated |
| `completePasskeyAuthentication` | the real `deviceId` from the verified ceremony |
| `completeOidcLogin` | never sets a binding |
| `RefreshSession` | does not touch the binding; `rotate()` only replaces tokens, so a refreshed session keeps its original value |
| `Device` aggregate | `id, userId, label, platform, trustState, firstSeenAt, lastSeenAt, revokedAt`; index on `user_id` only |

**The core defect.** Three different kinds of value can occupy one column: a genuine `DeviceId`
(passkey path), an arbitrary attacker-chosen string (password path), and `NULL` (OIDC path). Nothing
distinguishes them at read time. A cascade built on this would let a caller bind a session to a
device id belonging to **someone else** simply by typing it into the login request — turning device
revocation into a cross-tenant session-revocation primitive. That is precisely why the cascade was
deferred.

## 2. Migration from opaque string to a real `DeviceId` relationship

**Recommendation: a new nullable, referentially-correct column, not an in-place reinterpretation.**

```
session.device_binding  text NULL      -- retained, deprecated, never read for authorization
session.device_id       uuid NULL REFERENCES identity.device (id) ON DELETE SET NULL
```

Rationale for a second column rather than converting the first:

- **The old values cannot be trusted.** Reinterpreting `device_binding` as a `DeviceId` would
  promote attacker-controlled strings into a security-bearing reference. The CTO ruling already
  forbids this ("do not silently reinterpret old values").
- **A `uuid` column with a real FK makes the invalid state unrepresentable** at the database level,
  which is the only place it can be guaranteed once multiple writers exist.
- `ON DELETE SET NULL` rather than `CASCADE`: deleting a device record must not delete a user's
  session history.

`Session.deviceBinding` becomes `Session.deviceId: DeviceId | null` in the domain. The opaque field
is dropped from the domain entirely — keeping both would preserve the ambiguity this increment
exists to remove. The column stays only so the migration is reversible (§13).

## 3. Backward compatibility for existing sessions

**Legacy sessions get `device_id = NULL` and are treated as unbound.** No back-fill, no inference.

Consequences, stated plainly:

- A legacy session is **never** revoked by a device revocation. It is unbound, and §8 revokes only
  what is explicitly bound.
- This is a deliberate, temporary weakening: for the lifetime of those sessions, revoking a device
  does not sign out sessions that *were* created from it under the old model.
- It is bounded by the session policy's absolute expiry — legacy sessions age out on their own.
- **Alternative rejected:** back-filling `device_id` where `device_binding` happens to parse as a
  uuid and match a device owned by the same user. It looks safe, but it silently blesses values an
  attacker may have chosen, and a partially-correct security join is worse than an absent one.

If you prefer the transitional window closed immediately, the alternative is a one-off revocation of
all sessions with a non-null `device_binding` at deploy time. That is a forced re-login for those
users and needs your explicit call; I would not do it silently.

## 4. Device ownership validation

Binding must be verified, never asserted by the caller. At `StartSession`:

1. If no `deviceId` is supplied, the session is unbound. Legal.
2. If one is supplied, load the device.
3. Reject if it does not exist, **or is owned by another user**, **or is already revoked**.
4. All three failures return the same `DeviceNotFoundError` — the existing pattern, so a caller
   cannot probe whether another user's device id exists.

This adds a `DeviceRepository` dependency to `StartSession`, which today has none.

## 5. Session-creation rules per authentication method

| Path | Binding | Rationale |
|---|---|---|
| **Password** | Optional; **the client-supplied opaque string is removed from the API** | It is unverifiable. Accepting it is what created the defect. A password login may bind only by presenting a `deviceId` the user already owns, validated per §4 |
| **Passkey** | **Mandatory when the ceremony yields a device**, which it does whenever the credential is device-attached | The device is derived from a verified WebAuthn ceremony — the one trustworthy source we have |
| **OIDC** | Unbound | The provider tells us nothing about the device, and inventing one would fabricate a security-relevant fact |
| **Refresh rotation** | **Inherit, never re-supply** | The binding is a property of the session, fixed at creation. Letting refresh change it would let a stolen refresh token migrate a session onto an attacker's device and dodge revocation |

**This is a breaking change to `login`**: `deviceBinding` leaves the `LoginRequest` schema. It is
newly added in I-7b, has no external consumers, and keeping it would leave the vulnerability in
place. Contract impact in §11.

## 6. Repository and query changes

`SessionRepository` today offers `findById`, `findByTokenHash`, `listByUser`, `save`. I-7f adds:

```ts
listActiveByDevice(deviceId: DeviceId): Promise<Session[]>;
```

- Postgres adapter: `WHERE device_id = $1 AND status = 'active'`.
- **New index required:** `CREATE INDEX session_device_idx ON identity.session (device_id) WHERE device_id IS NOT NULL;`
  Partial, because most rows will be `NULL` for the foreseeable future.
- The in-memory adapter gains the same method, so application tests keep working without Postgres.

Returning aggregates rather than ids keeps revocation inside the domain — the handler calls
`session.revoke(...)` rather than issuing an `UPDATE`.

## 7. `DeviceRevoked` subscriber behaviour

Event-driven separation is preserved exactly as `PasswordChanged → RevokeAllUserSessions` already
does. `RevokeDevice` must not touch a Session aggregate.

```
RevokeDevice → publishes identity.device.revoked
             → subscriber (composition root)
             → RevokeSessionsForDevice (new application use case)
```

`registerIdentitySubscribers` gains one subscription. The handler is an application use case, not a
lambda, so it is unit-testable independently of the bus.

The existing bus reports handler errors rather than swallowing them; a failed cascade must therefore
be **observable**, and revoking the device still succeeds. That is the correct trade — the device is
already unusable for new authentications, and a retry mechanism belongs with the outbox work in
I-7g/FU-3, not here.

## 8. Exact revocation semantics

Revoking a device revokes **every active session whose `device_id` equals that device**, and nothing
else. Specifically it must **not** revoke:

- sessions with `device_id IS NULL` (unbound, including all legacy sessions)
- sessions bound to a different device
- every session of the user, unless separately requested via the existing `logout-all`

New revocation reason `device_revoked` added to `SessionRevocationReason`. Verified: the session
table constrains only `status` (`session_status_chk`) — **there is no CHECK on `revocation_reason`**,
so no constraint migration is needed for the new value. It is *not* added to `BulkRevocationReason`,
which is the set a caller may request directly; this reason is only ever set by the subscriber.

Access tokens already derived from a now-revoked session stop working on their next request, because
`AuthorizeRequest` re-reads the aggregate every time (I-7b). No token blacklist is required.

## 9. Concurrency and idempotency

- **Idempotent by construction.** `RevokeDevice` already returns `ok` when the device is already
  revoked, and `Session.revoke()` on an already-revoked session must be a no-op rather than an error.
  Replaying `DeviceRevoked` therefore changes nothing.
- **Concurrent device revocation and session refresh** is the real race: a refresh may rotate a token
  on a session the cascade is revoking. The Postgres adapters already use conditional updates with
  `assertClaimed` / `ConcurrentModificationError`; the cascade uses the same mechanism, so the loser
  gets a 409 and retries — and on retry sees a revoked session and stops.
- **Per-session isolation.** The cascade revokes each session in its own transaction. One
  concurrent-modification loss must not abandon the remaining sessions; failures are collected and
  reported, not thrown on the first.
- **Ordering.** The device is revoked and committed *before* the event is published, so the cascade
  can never run against a device that is not yet revoked.

## 10. Database migration impact

New file `migrations/0002_device_session_binding.sql` — the runner applies pending versions in order,
so no runner change is needed.

```sql
ALTER TABLE identity.session ADD COLUMN device_id uuid NULL
  REFERENCES identity.device (id) ON DELETE SET NULL;
CREATE INDEX session_device_idx ON identity.session (device_id) WHERE device_id IS NOT NULL;
COMMENT ON COLUMN identity.session.device_binding IS
  'Deprecated (I-7f): opaque, unvalidated. Never read for authorization. Retained for rollback.';
```

- **Additive only** — no data rewrite, no table rewrite. `ADD COLUMN … NULL` with no default does not
  rewrite the table on any supported Postgres version, so it is safe on a live table.
- `CREATE INDEX` should be `CONCURRENTLY` in production; note that this cannot run inside a
  transaction, which the migration runner would need to accommodate. **Flagging as a decision:**
  either add non-concurrent (fine while the table is small, which it is) or teach the runner about
  non-transactional migrations. I recommend non-concurrent now, given zero production rows.
- `device_binding` is **not** dropped in this migration. Dropping it is a separate, later change once
  rollback is no longer wanted.

## 11. Files expected to change

**Domain**
- `entities/session.ts` — `deviceBinding: string \| null` → `deviceId: DeviceId \| null`; snapshot, `start`, `reconstitute`
- `value-objects/session-revocation-reason.ts` — add `device_revoked`
- `ports/session-repository.ts` — add `listActiveByDevice`

**Application**
- `start-session.ts` — `deviceId?: string`, new `DeviceRepository` dependency, ownership validation
- `revoke-sessions-for-device.ts` — **new**
- `complete-passkey-authentication.ts` — unchanged; already returns `deviceId`
- `revoke-all-user-sessions.ts` — unchanged

**Infrastructure**
- `postgres/postgres-session-repository.ts` — read/write `device_id`, implement `listActiveByDevice`
- `in-memory-session-repository.ts` — same method
- `migrations/0002_device_session_binding.sql` — **new**

**Composition / HTTP**
- `identity-container.ts` — wire `RevokeSessionsForDevice`, subscribe to `identity.device.revoked`
- `nest/auth.controller.ts` — remove `deviceBinding` from login; pass ceremony `deviceId` through
- `openapi/identity.yaml` — remove `deviceBinding` from `LoginRequest`; rename the `Session` response
  field to `deviceId` with `format: uuid`. **A contract change, so the drift guards and response
  conformance tests must be updated in the same commit.**

**Not changed:** `RevokeDevice` (it must not learn about sessions), `AuthorizeRequest`, the
access-token layer.

## 12. Security tests required

1. Same-user device ownership — binding succeeds.
2. **Cross-user device rejected** — user A cannot bind to user B's device; answers `DeviceNotFound`,
   identical to a device that does not exist.
3. Revoked device cannot be bound at session start.
4. Device revocation cascades to bound sessions — they stop working on the next request, proven via
   HTTP with a still-unexpired access token.
5. Unrelated sessions stay active — different device, and same user different device.
6. **Unbound and legacy (`device_id IS NULL`) sessions are unaffected.**
7. Repeated revocation is idempotent; replaying `DeviceRevoked` changes nothing.
8. Concurrent device revocation and refresh rotation — no lost update, no orphaned active session.
9. Refresh rotation cannot change the binding.
10. Login no longer accepts a client-supplied binding — a request carrying one is a contract violation.
11. Externally safe not-found behaviour throughout.
12. Cascade failure is reported, and does not roll back the device revocation.

## 13. Rollback strategy

- **Code:** revert the commit. The new column is nullable and unread by the previous version, so the
  old build runs unchanged against the new schema.
- **Schema:** no down-migration is required for correctness. `device_id` may be left in place
  indefinitely; dropping it is optional cleanup.
- **Data:** none is destroyed — `device_binding` is retained precisely so a revert loses nothing.
- **The one-way door:** sessions revoked by a cascade stay revoked. That is a forced re-login, not
  data loss, and is acceptable.

## 14. Conflicts with frozen ADRs

None found. Checked:

- **ADR-0010 (platform principles)** — adapters stay behind ports; the new repository method is
  declared on the port, and the Postgres and in-memory adapters both implement it. Consistent.
- **ADR-0020 (contract source)** — the OpenAPI document changes *first*; the drift guards will fail
  the build until controllers match. Consistent, and enforced.
- **ADR-0023 (documentation freeze)** — no `docs/` file and no ADR is touched. The `0002` migration
  and this report are code and operational planning.
- **ADR-0016 (region residency lifecycle)** — device and session already live in the same regional
  store; adding a same-schema FK introduces no cross-region reference.

The removal of `deviceBinding` from `LoginRequest` is a public-contract change. Doc 07 is frozen and
describes the API at a level that does not enumerate this field, so no frozen document contradicts
it — but it is a breaking change and I am flagging it rather than treating it as routine.

## 15. Decisions required before implementation

1. **Legacy sessions** — accept the transitional gap in §3 (recommended), or force-revoke all
   sessions carrying a legacy `device_binding` at deploy?
2. **Breaking `login` change** — approve removing the unverifiable client-supplied `deviceBinding`?
3. **Index creation** — non-concurrent now (recommended, table is empty), or teach the runner
   non-transactional migrations?
4. **Cascade failure** — confirm that a failed session cascade must not roll back the device
   revocation, and is surfaced through the existing handler-error reporter until durable retry
   arrives with the outbox work.
