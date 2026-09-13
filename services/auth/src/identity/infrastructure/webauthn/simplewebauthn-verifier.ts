import {
  verifyRegistrationResponse,
  verifyAuthenticationResponse,
} from '@simplewebauthn/server';
import type {
  RegistrationResponseJSON,
  AuthenticationResponseJSON,
} from '@simplewebauthn/server';
import { type Result, ok, err } from '../../../kernel/result';
import { WebAuthnVerificationFailedError } from '../../domain/errors';
import type {
  WebAuthnVerifier,
  VerifyRegistrationRequest,
  VerifyAuthenticationRequest,
  VerifiedRegistration,
  VerifiedAuthentication,
} from '../../domain/ports/webauthn-verifier';

export interface WebAuthnRelyingParty {
  /** Registrable domain a credential is scoped to. */
  readonly rpId: string;
  /** Exact origin the browser must have signed. */
  readonly origin: string;
  /**
   * Whether the authenticator must have verified the *user* (PIN, biometric),
   * not merely their presence. Off by default so a security key that only
   * proves presence can still be a second factor; step-up flows demand it.
   */
  readonly requireUserVerification?: boolean;
}

/**
 * The real {@link WebAuthnVerifier} — the adapter Path A deferred from I-4.
 *
 * Everything the domain refused to touch lives behind this one class: CBOR and
 * COSE decoding, attestation parsing, ES256/RS256 signature checks, origin and
 * RP-ID binding. It is a thin, deliberate translation layer — the library does
 * the cryptography, and this file's only jobs are to (a) hand it the right
 * expectations, (b) fail closed on anything unexpected, and (c) return the flat
 * facts the domain models.
 *
 * `publicKey` crosses the port as a base64url **string** because the domain
 * treats it as opaque; the COSE bytes are encoded here on the way out of
 * registration and decoded here on the way into authentication.
 */
export class SimpleWebAuthnVerifier implements WebAuthnVerifier {
  constructor(private readonly rp: WebAuthnRelyingParty) {}

  async verifyRegistration(
    request: VerifyRegistrationRequest,
  ): Promise<Result<VerifiedRegistration, WebAuthnVerificationFailedError>> {
    let verification;
    try {
      verification = await verifyRegistrationResponse({
        response: request.response as unknown as RegistrationResponseJSON,
        expectedChallenge: request.challenge,
        expectedOrigin: this.rp.origin,
        expectedRPID: this.rp.rpId,
        requireUserVerification: this.rp.requireUserVerification ?? false,
      });
    } catch (error) {
      // the library throws on malformed input as well as on a failed check;
      // both mean the same thing to us — this ceremony is not acceptable
      return err(new WebAuthnVerificationFailedError(describe(error)));
    }

    if (!verification.verified || verification.registrationInfo === undefined) {
      return err(new WebAuthnVerificationFailedError('registration was not verified'));
    }

    const info = verification.registrationInfo;
    return ok({
      credentialId: info.credential.id,
      publicKey: Buffer.from(info.credential.publicKey).toString('base64url'),
      signCount: info.credential.counter,
      transports: info.credential.transports ?? [],
      aaguid: info.aaguid,
      backupEligible: info.credentialDeviceType === 'multiDevice',
      backupState: info.credentialBackedUp,
      userVerified: info.userVerified,
    });
  }

  async verifyAuthentication(
    request: VerifyAuthenticationRequest,
  ): Promise<Result<VerifiedAuthentication, WebAuthnVerificationFailedError>> {
    const response = request.response as unknown as AuthenticationResponseJSON;
    const credentialId = typeof response.id === 'string' ? response.id : '';
    if (credentialId.length === 0) {
      return err(new WebAuthnVerificationFailedError('response carries no credential id'));
    }

    let publicKey: Buffer;
    try {
      publicKey = Buffer.from(request.publicKey, 'base64url');
    } catch {
      return err(new WebAuthnVerificationFailedError('stored public key is unreadable'));
    }
    if (publicKey.length === 0) {
      return err(new WebAuthnVerificationFailedError('stored public key is empty'));
    }

    let verification;
    try {
      verification = await verifyAuthenticationResponse({
        response,
        expectedChallenge: request.challenge,
        expectedOrigin: this.rp.origin,
        expectedRPID: this.rp.rpId,
        credential: {
          id: credentialId,
          publicKey: new Uint8Array(publicKey),
          counter: request.storedSignCount,
        },
        requireUserVerification: this.rp.requireUserVerification ?? false,
      });
    } catch (error) {
      return err(new WebAuthnVerificationFailedError(describe(error)));
    }

    if (!verification.verified) {
      return err(new WebAuthnVerificationFailedError('assertion was not verified'));
    }

    const info = verification.authenticationInfo;
    return ok({
      credentialId,
      signCount: info.newCounter,
      userVerified: info.userVerified,
      backupState: info.credentialBackedUp,
    });
  }
}

/** Never surface a raw stack to a caller; the reason is for logs and audit. */
function describe(error: unknown): string {
  return error instanceof Error ? error.message : 'malformed WebAuthn response';
}
