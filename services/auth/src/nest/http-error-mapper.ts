import { ConcurrentModificationError } from '../identity/infrastructure/postgres/concurrency';

/**
 * RFC 9457 (formerly 7807) problem detail — the error shape the public REST API
 * returns, per docs/07 §1 (REST + JSON, OpenAPI 3.1).
 */
export interface ProblemDetail {
  readonly type: string;
  readonly title: string;
  readonly status: number;
  readonly code: string;
}

/** Anything the domain returns as a failure carries a discriminating `_tag`. */
interface TaggedError {
  readonly _tag: string;
  readonly message?: string;
}

const PROBLEM_BASE = 'https://docs.nexus.example/problems/';

/**
 * Status codes per failure tag.
 *
 * Two rules shape this table beyond the obvious mapping:
 *
 * 1. **Nothing here may leak whether an account exists.** Wrong password,
 *    unknown account and a bad link all answer the same way the use cases
 *    already do — the mapper never widens what the domain deliberately
 *    narrowed (docs/08 threat X7).
 * 2. **A lost write race is not the caller's fault.** `ConcurrentModificationError`
 *    means the database refused a conditional write because someone else got
 *    there first; the request was well-formed, so it answers 409 and is safe to
 *    retry, rather than a 500 that reads like a defect.
 */
const STATUS_BY_TAG: Readonly<Record<string, number>> = {
  // 400 — the request itself is malformed
  InvalidEmailError: 400,
  WeakPasswordError: 400,
  InvalidProfileError: 400,

  // 401 — authentication failed; deliberately indistinguishable
  InvalidCredentialsError: 401,
  InvalidAccessTokenError: 401,

  // 403 — identified, but not permitted in this state
  UserDeactivatedError: 403,

  // 404 — not found, including "not yours" so ownership cannot be probed
  UserNotFoundError: 404,
  SessionNotFoundError: 404,
  PasskeyNotFoundError: 404,
  DeviceNotFoundError: 404,
  FederatedIdentityNotFoundError: 404,

  // 409 — conflicts with existing state
  EmailAlreadyInUseError: 409,
  EmailAlreadyVerifiedError: 409,
  DuplicateCredentialError: 409,
  FederatedIdentityAlreadyLinkedError: 409,
  LastFactorRemovalError: 409,
  ConcurrentModificationError: 409,

  // 410 — the capability existed and is now spent or timed out
  VerificationTokenExpiredError: 410,
  VerificationTokenAlreadyUsedError: 410,
  SessionExpiredError: 410,
  ChallengeExpiredError: 410,
  OidcStateExpiredError: 410,

  // 401 — a presented credential/ceremony artefact is not acceptable
  InvalidVerificationTokenError: 401,
  InvalidRefreshTokenError: 401,
  RefreshTokenReusedError: 401,
  SessionRevokedError: 401,
  InvalidChallengeError: 401,
  WebAuthnVerificationFailedError: 401,
  PasskeyCloneDetectedError: 401,
  InvalidOidcStateError: 401,
  InvalidOidcTokenError: 401,

  // 422 — semantically understood but cannot be acted on
  AccountLinkRequiresAuthenticationError: 422,

  // 502 — an upstream provider failed us, not the caller
  OidcTokenExchangeFailedError: 502,
};

const UNMAPPED_STATUS = 500;

function isTagged(value: unknown): value is TaggedError {
  return (
    typeof value === 'object' &&
    value !== null &&
    '_tag' in value &&
    typeof (value as { _tag: unknown })._tag === 'string'
  );
}

/** Human-readable title, without echoing anything the domain kept vague. */
function titleOf(error: TaggedError): string {
  const message = error.message;
  return typeof message === 'string' && message.length > 0
    ? message
    : 'The request could not be completed.';
}

/**
 * Translate a domain failure (or a thrown infrastructure error) into a problem
 * detail. Unknown tags become 500 rather than being guessed at: a new error
 * type must be mapped deliberately, and `everyErrorIsMapped` in the tests fails
 * the build until it is.
 */
export function toProblemDetail(error: unknown): ProblemDetail {
  if (error instanceof ConcurrentModificationError) {
    return {
      type: `${PROBLEM_BASE}concurrent-modification`,
      title: 'The resource was modified concurrently. Retry the request.',
      status: 409,
      code: 'ConcurrentModificationError',
    };
  }
  if (!isTagged(error)) {
    return {
      type: `${PROBLEM_BASE}internal`,
      title: 'The request could not be completed.',
      status: UNMAPPED_STATUS,
      code: 'InternalError',
    };
  }
  const status = STATUS_BY_TAG[error._tag] ?? UNMAPPED_STATUS;
  return {
    type: `${PROBLEM_BASE}${error._tag}`,
    title: status === UNMAPPED_STATUS ? 'The request could not be completed.' : titleOf(error),
    status,
    code: error._tag,
  };
}

/** The tags this mapper knows about — used by the coverage test. */
export function mappedErrorTags(): readonly string[] {
  return Object.keys(STATUS_BY_TAG);
}
