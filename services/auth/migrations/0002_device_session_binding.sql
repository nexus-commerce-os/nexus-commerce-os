-- I-7f — Strong Device/Session binding.
--
-- `session.device_binding` accepted three different kinds of value: a real
-- device id from a verified passkey ceremony, an arbitrary client-supplied
-- string from password login, and NULL from federated sign-in. Nothing told
-- them apart at read time, so a device-revocation cascade built on it would let
-- a caller end someone else's sessions by naming their device.
--
-- This adds a referentially-correct column instead of reinterpreting the old
-- one. Existing rows keep device_id NULL and are treated as unbound: they are
-- never swept by a device revocation, and they age out through the session
-- policy's absolute expiry. No legacy value is ever promoted to a device id.
--
-- Additive only: ADD COLUMN ... NULL with no default does not rewrite the
-- table, and the index is created transactionally because the table is empty.

ALTER TABLE identity.session
  ADD COLUMN device_id uuid NULL REFERENCES identity.device (id) ON DELETE SET NULL;

-- Partial: almost every row is unbound, and only bound rows are ever queried.
CREATE INDEX session_device_idx ON identity.session (device_id) WHERE device_id IS NOT NULL;

COMMENT ON COLUMN identity.session.device_binding IS
  'Deprecated (I-7f): opaque, unvalidated, never read for authorization. Retained for rollback.';
COMMENT ON COLUMN identity.session.device_id IS
  'Verified device this session is bound to; NULL means unbound.';
