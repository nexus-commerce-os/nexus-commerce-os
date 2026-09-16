import { type Result, ok, err } from '../../kernel/result';
import { WebAuthnVerificationFailedError } from '../domain/errors';
import type {
  WebAuthnVerifier,
  VerifyRegistrationRequest,
  VerifyAuthenticationRequest,
  VerifiedRegistration,
  VerifiedAuthentication,
} from '../domain/ports/webauthn-verifier';

/**
 * Test doubles for the {@link WebAuthnVerifier} port.
 *
 * These live in the test tree on purpose: no permissive stand-in ships in `src`.
 * The real adapter — which performs the actual CBOR/COSE parsing and signature
 * verification — arrives in I-7. A double lets the *identity* rules around the
 * ceremony (challenge validity, credential uniqueness, counter regression,
 * device attribution) be tested without pretending to do cryptography.
 */
export class StubWebAuthnVerifier implements WebAuthnVerifier {
  constructor(
    private registration: Result<VerifiedRegistration, WebAuthnVerificationFailedError>,
    private authentication: Result<VerifiedAuthentication, WebAuthnVerificationFailedError>,
  ) {}

  /** Facts the next registration should "verify" to. */
  setRegistration(value: VerifiedRegistration): void {
    this.registration = ok(value);
  }

  /** Facts the next assertion should "verify" to. */
  setAuthentication(value: VerifiedAuthentication): void {
    this.authentication = ok(value);
  }

  failRegistration(reason: string): void {
    this.registration = err(new WebAuthnVerificationFailedError(reason));
  }

  failAuthentication(reason: string): void {
    this.authentication = err(new WebAuthnVerificationFailedError(reason));
  }

  verifyRegistration(
    _request: VerifyRegistrationRequest,
  ): Promise<Result<VerifiedRegistration, WebAuthnVerificationFailedError>> {
    return Promise.resolve(this.registration);
  }

  verifyAuthentication(
    _request: VerifyAuthenticationRequest,
  ): Promise<Result<VerifiedAuthentication, WebAuthnVerificationFailedError>> {
    return Promise.resolve(this.authentication);
  }
}

export function verifiedRegistration(
  overrides: Partial<VerifiedRegistration> = {},
): VerifiedRegistration {
  return {
    credentialId: 'cred-AAAA',
    publicKey: 'cose-public-key-AAAA',
    signCount: 0,
    transports: ['internal'],
    aaguid: '00000000-0000-0000-0000-000000000000',
    backupEligible: true,
    backupState: true,
    userVerified: true,
    ...overrides,
  };
}

export function verifiedAuthentication(
  overrides: Partial<VerifiedAuthentication> = {},
): VerifiedAuthentication {
  return {
    credentialId: 'cred-AAAA',
    signCount: 1,
    userVerified: true,
    backupState: true,
    ...overrides,
  };
}
