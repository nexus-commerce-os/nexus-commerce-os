// Identity infrastructure adapters — concrete implementations of the domain
// ports, wired into composition roots (tests, and the NestJS module in I-7).

export * from './scrypt-password-hasher';
export * from './in-memory-user-repository';
export * from './in-memory-event-publisher';
export * from './system-clock';
export * from './uuid-id-generator';
export * from './in-memory-session-repository';
export * from './random-token-generator';
export * from './sha256-token-hasher';
export * from './hmac-token-hasher';
export * from './in-memory-verification-token-repository';
export * from './in-memory-webauthn-challenge-repository';
export * from './in-memory-passkey-credential-repository';
export * from './in-memory-device-repository';
export * from './in-memory-oauth-authorization-request-repository';
export * from './in-memory-federated-identity-repository';
export * from './postgres';
