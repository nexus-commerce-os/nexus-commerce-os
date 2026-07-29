// @nexus/auth — Identity & Profile module (P0.2 · increment I-1: Identity domain core).
//
// Public surface: kernel primitives, the Identity domain (User aggregate, value
// objects, events, typed errors), the ports it depends on, and the application
// use cases. Infrastructure adapters are intentionally NOT re-exported here —
// import them from `./identity/infrastructure` when wiring composition roots.

// ── kernel ──────────────────────────────────────────────────────────────────
export * from './kernel/result';
export type { Brand } from './kernel/identifier';
export type { DomainEvent } from './kernel/domain-event';
export type { Clock } from './kernel/clock';
export type { IdGenerator } from './kernel/id-generator';

// ── identity · domain ─────────────────────────────────────────────────────────
export * from './identity/domain/errors';
export * from './identity/domain/value-objects/email';
export * from './identity/domain/value-objects/user-id';
export * from './identity/domain/value-objects/password-hash';
export * from './identity/domain/value-objects/password-policy';
export * from './identity/domain/value-objects/session-id';
export * from './identity/domain/value-objects/token-hash';
export * from './identity/domain/value-objects/session-policy';
export type { SessionRevocationReason } from './identity/domain/value-objects/session-revocation-reason';
export * from './identity/domain/entities/profile';
export * from './identity/domain/entities/password-credential';
export * from './identity/domain/entities/user';
export * from './identity/domain/entities/refresh-token';
export * from './identity/domain/entities/session';
export * from './identity/domain/events/user-registered';
export * from './identity/domain/events/email-changed';
export * from './identity/domain/events/password-changed';
export * from './identity/domain/events/user-deactivated';
export * from './identity/domain/events/session-started';
export * from './identity/domain/events/session-refreshed';
export * from './identity/domain/events/session-revoked';
export * from './identity/domain/events/session-reuse-detected';
export type { UserRepository } from './identity/domain/ports/user-repository';
export type { PasswordHasher } from './identity/domain/ports/password-hasher';
export type { EventPublisher } from './identity/domain/ports/event-publisher';
export * from './identity/domain/value-objects/verification-token-id';
export * from './identity/domain/value-objects/verification-purpose';
export * from './identity/domain/value-objects/verification-policy';
export * from './identity/domain/entities/verification-token';
export * from './identity/domain/events/email-verification-requested';
export * from './identity/domain/events/email-verified';
export * from './identity/domain/events/password-reset-requested';
export * from './identity/domain/events/password-reset-completed';
export type { VerificationTokenRepository } from './identity/domain/ports/verification-token-repository';
export * from './identity/domain/value-objects/webauthn-challenge-id';
export * from './identity/domain/value-objects/passkey-credential-id';
export * from './identity/domain/value-objects/device-id';
export * from './identity/domain/value-objects/credential-id';
export * from './identity/domain/value-objects/webauthn-ceremony';
export * from './identity/domain/value-objects/webauthn-policy';
export * from './identity/domain/value-objects/device-trust-state';
export * from './identity/domain/value-objects/authentication-factor-policy';
export * from './identity/domain/entities/webauthn-challenge';
export * from './identity/domain/entities/passkey-credential';
export * from './identity/domain/entities/device';
export * from './identity/domain/events/passkey-registered';
export * from './identity/domain/events/passkey-authenticated';
export * from './identity/domain/events/passkey-revoked';
export * from './identity/domain/events/passkey-clone-suspected';
export * from './identity/domain/events/device-registered';
export * from './identity/domain/events/device-revoked';
export type { WebAuthnChallengeRepository } from './identity/domain/ports/webauthn-challenge-repository';
export type { PasskeyCredentialRepository } from './identity/domain/ports/passkey-credential-repository';
export type { DeviceRepository } from './identity/domain/ports/device-repository';
export * from './identity/domain/ports/webauthn-verifier';
export type { SessionRepository } from './identity/domain/ports/session-repository';
export type { TokenGenerator } from './identity/domain/ports/token-generator';
export type { TokenHasher } from './identity/domain/ports/token-hasher';

// ── identity · application ────────────────────────────────────────────────────
export * from './identity/application/register-user';
export * from './identity/application/authenticate-user';
export * from './identity/application/change-password';
export * from './identity/application/start-session';
export * from './identity/application/refresh-session';
export * from './identity/application/revoke-session';
export * from './identity/application/revoke-all-user-sessions';
export * from './identity/application/request-email-verification';
export * from './identity/application/verify-email';
export * from './identity/application/request-password-reset';
export * from './identity/application/reset-password';
export * from './identity/application/start-passkey-registration';
export * from './identity/application/complete-passkey-registration';
export * from './identity/application/start-passkey-authentication';
export * from './identity/application/complete-passkey-authentication';
export * from './identity/application/revoke-passkey';
export * from './identity/application/list-user-passkeys';
export * from './identity/application/revoke-device';
