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
export * from './identity/domain/entities/profile';
export * from './identity/domain/entities/password-credential';
export * from './identity/domain/entities/user';
export * from './identity/domain/events/user-registered';
export * from './identity/domain/events/email-changed';
export * from './identity/domain/events/password-changed';
export * from './identity/domain/events/user-deactivated';
export type { UserRepository } from './identity/domain/ports/user-repository';
export type { PasswordHasher } from './identity/domain/ports/password-hasher';
export type { EventPublisher } from './identity/domain/ports/event-publisher';

// ── identity · application ────────────────────────────────────────────────────
export * from './identity/application/register-user';
export * from './identity/application/authenticate-user';
export * from './identity/application/change-password';
