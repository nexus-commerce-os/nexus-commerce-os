# Identity API — Changelog

Changes to the canonical contract, [`identity.yaml`](identity.yaml). The specification is the source
of truth ([ADR-0020](../../../docs/adr/ADR-0020-performance-consistency-hardening.md) ruling,
2026-07-31); this file records what changed in it and why.

Versions are the `info.version` of the document. The API is pre-release: breaking changes are made
deliberately and recorded here rather than deferred behind a version negotiation that has no
consumers yet.

---

## 0.1.0 — 2026-07-31

### Breaking

**`deviceBinding` removed from `POST /auth/login`.** (I-7f, commit `9b74bae`)

A password login establishes no device identity, so it may not claim one. The field was an opaque
string stored verbatim and never validated, which meant a caller could bind their session to a
device id belonging to **another user** simply by naming it — and that user revoking their device
would then end the attacker's sessions, or vice versa. Device identity is now established
exclusively by the server.

- A request that still sends the field is answered **`400` with `code: "ContractViolation"`**, not
  silently accepted. Rejecting an obsolete security-sensitive field is preferable to ignoring it:
  ignoring it would leave a client believing a binding exists when none does.
- **Migration for clients:** stop sending `deviceBinding`. There is no replacement on this endpoint.
  A session is bound only where the server can verify the device — today that is passkey
  authentication, where the device comes from the verified WebAuthn ceremony.

**`session.deviceBinding` renamed to `session.deviceId`** in every response carrying a session
(`login`, `session/refresh`, `passkeys/authentication/complete`, `oidc/complete`).

- Type is now a uuid or `null`, referencing a real device record, rather than an arbitrary string.
- `null` means the session is unbound, which is the normal case for password and federated sign-in.

### Added

Ten operations completing the Identity HTTP surface (I-7b, commit `e7c38db`), taking the contract
from 10 to 20 operations and 28 schemas:

- Passkeys — `startPasskeyRegistration`, `completePasskeyRegistration`,
  `startPasskeyAuthentication`, `completePasskeyAuthentication`, `listPasskeys`, `revokePasskey`
- Federation — `startOidcLogin`, `completeOidcLogin`, `listFederatedIdentities`,
  `unlinkFederatedIdentity`

`completePasskeyAuthentication` and `completeOidcLogin` return the same credential model as password
login: a NEXUS session, a short-lived access token and a rotating refresh token. A WebAuthn assertion
and an OIDC state are never accepted as request credentials.

`SessionIssued` gained `accessToken` and `expiresAt` — the short-lived JWT presented on every
authenticated request. The refresh token is never accepted as a request credential.

### Notes

- `POST …/revoke` and `POST …/unlink` are commands, not resource deletions, and are intentionally
  POST in this version.
- `includeRevoked` is deliberately not exposed on the list endpoints; revoked history belongs to a
  future security-history view with its own access-control and retention design.
