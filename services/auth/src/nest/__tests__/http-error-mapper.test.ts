import { describe, it, expect } from 'vitest';
import { toProblemDetail, mappedErrorTags } from '../http-error-mapper';
import { ConcurrentModificationError } from '../../identity/infrastructure/postgres/concurrency';
import * as errors from '../../identity/domain/errors';

describe('toProblemDetail', () => {
  it('maps a domain failure to its status and code', () => {
    const problem = toProblemDetail(new errors.EmailAlreadyInUseError('jane@example.com'));
    expect(problem.status).toBe(409);
    expect(problem.code).toBe('EmailAlreadyInUseError');
    expect(problem.type).toContain('EmailAlreadyInUseError');
  });

  it('keeps authentication failures indistinguishable', () => {
    const wrongPassword = toProblemDetail(new errors.InvalidCredentialsError());
    const unknownAccount = toProblemDetail(new errors.InvalidCredentialsError());
    expect(wrongPassword).toEqual(unknownAccount);
    expect(wrongPassword.status).toBe(401);
  });

  it('answers 404 for "not yours" so ownership cannot be probed', () => {
    for (const error of [
      new errors.SessionNotFoundError('s'),
      new errors.PasskeyNotFoundError('p'),
      new errors.DeviceNotFoundError('d'),
      new errors.FederatedIdentityNotFoundError('f'),
    ]) {
      expect(toProblemDetail(error).status).toBe(404);
    }
  });

  it('answers 410 for a capability that is spent or timed out', () => {
    expect(toProblemDetail(new errors.VerificationTokenExpiredError('t')).status).toBe(410);
    expect(toProblemDetail(new errors.VerificationTokenAlreadyUsedError('t')).status).toBe(410);
    expect(toProblemDetail(new errors.ChallengeExpiredError('c')).status).toBe(410);
  });

  it('treats a lost write race as a retryable 409, not a server defect', () => {
    const problem = toProblemDetail(new ConcurrentModificationError('VerificationToken', 'id'));
    expect(problem.status).toBe(409);
    expect(problem.code).toBe('ConcurrentModificationError');
    expect(problem.title).toContain('Retry');
  });

  it('blames the upstream provider, not the caller, for a failed token exchange', () => {
    expect(toProblemDetail(new errors.OidcTokenExchangeFailedError('invalid_grant')).status).toBe(
      502,
    );
  });

  it('falls back to 500 for an unknown tag and reveals nothing about it', () => {
    const problem = toProblemDetail({ _tag: 'SomethingNewError', message: 'internal detail' });
    expect(problem.status).toBe(500);
    expect(problem.title).not.toContain('internal detail');
  });

  it('falls back to 500 for a value that is not a tagged error at all', () => {
    for (const value of [new Error('boom'), 'boom', null, undefined, 42]) {
      expect(toProblemDetail(value).status).toBe(500);
    }
  });

  /**
   * The guard that keeps this table honest: every error the domain can return
   * must have a deliberate status. A new error type fails the build here rather
   * than silently becoming a 500 in production.
   */
  it('maps every error exported by the domain', () => {
    const domainTags = Object.entries(errors)
      .filter(([, value]) => typeof value === 'function')
      .map(([name]) => name);
    const mapped = new Set(mappedErrorTags());

    const unmapped = domainTags.filter((tag) => !mapped.has(tag));
    expect(unmapped, `unmapped domain errors: ${unmapped.join(', ')}`).toEqual([]);
  });
});
