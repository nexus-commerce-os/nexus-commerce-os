/**
 * Injection tokens for values that have no class to key on. Declared in one
 * place so a typo cannot silently create a second, unprovided token.
 */
export const IDENTITY_POOL = Symbol('IDENTITY_POOL');
export const IDENTITY_CONTAINER = Symbol('IDENTITY_CONTAINER');
export const IDENTITY_CONFIG = Symbol('IDENTITY_CONFIG');

/** Abuse protection (I-7g). */
export const RATE_LIMITER = Symbol('RATE_LIMITER');
export const RATE_LIMIT_POLICY = Symbol('RATE_LIMIT_POLICY');
export const RATE_LIMIT_OBSERVER = Symbol('RATE_LIMIT_OBSERVER');
