-- =============================================================================
-- identity · 0001 · initial schema
--
-- Owns every table of the Identity bounded context and NOTHING else: this
-- context lives in its own Postgres schema under its own DB role (docs/06 §4,
-- ADR-0020), which turns the architectural boundary into a database permission.
-- CI greps these files for cross-schema DDL (docs/06 §4) — keep every statement
-- inside `identity`.
--
-- Role grants are infrastructure's job (Terraform), not this migration's.
-- =============================================================================

CREATE SCHEMA IF NOT EXISTS identity;

-- Applied-migration ledger. The runner writes here; nothing else does.
CREATE TABLE IF NOT EXISTS identity.schema_migration (
  version     text        PRIMARY KEY,
  applied_at  timestamptz NOT NULL DEFAULT now()
);

-- ── user + profile (docs/06 §3.1) ───────────────────────────────────────────
-- `password_hash` is NULLABLE: federated-only accounts have no password factor,
-- and the last-factor rule counts passwords, passkeys and providers together.
CREATE TABLE identity.user_account (
  id                   uuid        PRIMARY KEY,
  email                text        NOT NULL,
  email_verified       boolean     NOT NULL DEFAULT false,
  status               text        NOT NULL,
  residency_region     text        NOT NULL,
  password_hash        text        NULL,
  password_updated_at  timestamptz NULL,
  created_at           timestamptz NOT NULL,
  updated_at           timestamptz NOT NULL,
  CONSTRAINT user_account_status_chk CHECK (status IN ('active', 'deactivated')),
  CONSTRAINT user_account_password_pair_chk
    CHECK ((password_hash IS NULL) = (password_updated_at IS NULL))
);

-- Addresses are compared case-insensitively by the domain (Email normalises to
-- lower case); the index enforces that same rule in the database.
CREATE UNIQUE INDEX user_account_email_uk ON identity.user_account (lower(email));

CREATE TABLE identity.profile (
  user_id       uuid PRIMARY KEY REFERENCES identity.user_account (id) ON DELETE CASCADE,
  display_name  text NOT NULL,
  locale        text NOT NULL
);

-- ── sessions + rotating refresh-token family (docs/08 §3.4) ─────────────────
CREATE TABLE identity.session (
  id                  uuid        PRIMARY KEY,
  user_id             uuid        NOT NULL REFERENCES identity.user_account (id) ON DELETE CASCADE,
  device_binding      text        NULL,
  status              text        NOT NULL,
  revocation_reason   text        NULL,
  created_at          timestamptz NOT NULL,
  last_used_at        timestamptz NOT NULL,
  idle_expires_at     timestamptz NOT NULL,
  absolute_expires_at timestamptz NOT NULL,
  CONSTRAINT session_status_chk CHECK (status IN ('active', 'revoked'))
);

CREATE INDEX session_user_idx ON identity.session (user_id);

CREATE TABLE identity.refresh_token (
  session_id  uuid        NOT NULL REFERENCES identity.session (id) ON DELETE CASCADE,
  token_hash  text        NOT NULL,
  status      text        NOT NULL,
  issued_at   timestamptz NOT NULL,
  PRIMARY KEY (session_id, token_hash),
  CONSTRAINT refresh_token_status_chk CHECK (status IN ('active', 'consumed', 'revoked'))
);

-- Resolving a stolen, already-rotated token to its family is what makes reuse
-- detection possible, so the hash must be globally unique.
CREATE UNIQUE INDEX refresh_token_hash_uk ON identity.refresh_token (token_hash);

-- ── email verification + password reset (I-3) ───────────────────────────────
CREATE TABLE identity.verification_token (
  id           uuid        PRIMARY KEY,
  user_id      uuid        NOT NULL REFERENCES identity.user_account (id) ON DELETE CASCADE,
  purpose      text        NOT NULL,
  email        text        NOT NULL,
  token_hash   text        NOT NULL,
  status       text        NOT NULL,
  created_at   timestamptz NOT NULL,
  expires_at   timestamptz NOT NULL,
  consumed_at  timestamptz NULL,
  CONSTRAINT verification_token_purpose_chk
    CHECK (purpose IN ('email_verification', 'password_reset')),
  CONSTRAINT verification_token_status_chk
    CHECK (status IN ('pending', 'consumed', 'invalidated'))
);

CREATE UNIQUE INDEX verification_token_hash_uk ON identity.verification_token (token_hash);
CREATE INDEX verification_token_pending_idx
  ON identity.verification_token (user_id, purpose)
  WHERE status = 'pending';

-- ── WebAuthn (I-4) ──────────────────────────────────────────────────────────
CREATE TABLE identity.webauthn_challenge (
  id              uuid        PRIMARY KEY,
  user_id         uuid        NULL REFERENCES identity.user_account (id) ON DELETE CASCADE,
  ceremony        text        NOT NULL,
  challenge_hash  text        NOT NULL,
  status          text        NOT NULL,
  created_at      timestamptz NOT NULL,
  expires_at      timestamptz NOT NULL,
  consumed_at     timestamptz NULL,
  CONSTRAINT webauthn_challenge_ceremony_chk
    CHECK (ceremony IN ('registration', 'authentication')),
  CONSTRAINT webauthn_challenge_status_chk
    CHECK (status IN ('pending', 'consumed', 'invalidated'))
);

CREATE UNIQUE INDEX webauthn_challenge_hash_uk ON identity.webauthn_challenge (challenge_hash);
CREATE INDEX webauthn_challenge_pending_idx
  ON identity.webauthn_challenge (user_id, ceremony)
  WHERE status = 'pending';

CREATE TABLE identity.device (
  id            uuid        PRIMARY KEY,
  user_id       uuid        NOT NULL REFERENCES identity.user_account (id) ON DELETE CASCADE,
  label         text        NOT NULL,
  platform      text        NOT NULL,
  trust_state   text        NOT NULL,
  first_seen_at timestamptz NOT NULL,
  last_seen_at  timestamptz NOT NULL,
  revoked_at    timestamptz NULL,
  CONSTRAINT device_trust_state_chk CHECK (trust_state IN ('UNKNOWN', 'TRUSTED', 'REVOKED'))
);

CREATE INDEX device_user_idx ON identity.device (user_id);

CREATE TABLE identity.passkey_credential (
  id               uuid        PRIMARY KEY,
  user_id          uuid        NOT NULL REFERENCES identity.user_account (id) ON DELETE CASCADE,
  credential_id    text        NOT NULL,
  public_key       text        NOT NULL,
  sign_count       bigint      NOT NULL,
  transports       text[]      NOT NULL DEFAULT '{}',
  aaguid           text        NOT NULL,
  backup_eligible  boolean     NOT NULL,
  backup_state     boolean     NOT NULL,
  label            text        NOT NULL,
  device_id        uuid        NULL REFERENCES identity.device (id) ON DELETE SET NULL,
  created_at       timestamptz NOT NULL,
  last_used_at     timestamptz NULL,
  revoked_at       timestamptz NULL,
  CONSTRAINT passkey_credential_sign_count_chk CHECK (sign_count >= 0)
);

-- The authenticator picks this id and it must resolve to exactly one credential.
CREATE UNIQUE INDEX passkey_credential_credential_id_uk
  ON identity.passkey_credential (credential_id);
CREATE INDEX passkey_credential_user_idx ON identity.passkey_credential (user_id);

-- ── OAuth / OIDC federation (I-5) ───────────────────────────────────────────
CREATE TABLE identity.oauth_authorization_request (
  id            uuid        PRIMARY KEY,
  provider      text        NOT NULL,
  state_hash    text        NOT NULL,
  nonce         text        NOT NULL,
  code_verifier text        NOT NULL,
  redirect_uri  text        NOT NULL,
  user_id       uuid        NULL REFERENCES identity.user_account (id) ON DELETE CASCADE,
  status        text        NOT NULL,
  created_at    timestamptz NOT NULL,
  expires_at    timestamptz NOT NULL,
  consumed_at   timestamptz NULL,
  CONSTRAINT oauth_authorization_request_status_chk
    CHECK (status IN ('pending', 'consumed', 'invalidated'))
);

CREATE UNIQUE INDEX oauth_authorization_request_state_uk
  ON identity.oauth_authorization_request (state_hash);
CREATE INDEX oauth_authorization_request_pending_idx
  ON identity.oauth_authorization_request (user_id, provider)
  WHERE status = 'pending';

CREATE TABLE identity.federated_identity (
  id             uuid        PRIMARY KEY,
  user_id        uuid        NOT NULL REFERENCES identity.user_account (id) ON DELETE CASCADE,
  provider       text        NOT NULL,
  subject        text        NOT NULL,
  email_at_link  text        NULL,
  linked_at      timestamptz NOT NULL,
  last_used_at   timestamptz NULL,
  revoked_at     timestamptz NULL
);

-- One provider account can never be attached to two NEXUS accounts (docs/06
-- §3.1 `subject UK`). Enforced across revoked rows too, so an unlinked identity
-- cannot be silently re-homed.
CREATE UNIQUE INDEX federated_identity_provider_subject_uk
  ON identity.federated_identity (provider, subject);
CREATE INDEX federated_identity_user_idx ON identity.federated_identity (user_id);
