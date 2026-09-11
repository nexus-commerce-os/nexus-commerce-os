// Postgres adapters for the Identity ports (I-6). Imported by composition roots
// only — the domain and use cases never reference them.

export * from './connection';
export * from './migration-runner';
export * from './postgres-user-repository';
export * from './postgres-session-repository';
export * from './concurrency';
export * from './postgres-verification-token-repository';
export * from './postgres-webauthn-challenge-repository';
export * from './postgres-passkey-credential-repository';
export * from './postgres-device-repository';
export * from './postgres-oauth-authorization-request-repository';
export * from './postgres-federated-identity-repository';
