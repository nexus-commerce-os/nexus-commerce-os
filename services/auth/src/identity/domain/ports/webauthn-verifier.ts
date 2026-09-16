import type { Result } from '../../../kernel/result';
import type { WebAuthnVerificationFailedError } from '../errors';

/**
 * The raw client payload of a ceremony, passed through untouched. The domain
 * treats it as opaque — parsing `attestationObject`, `clientDataJSON`, CBOR,
 * COSE keys and signatures is the adapter's job (I-7), never this module's.
 */
export type WebAuthnClientResponse = Readonly<Record<string, unknown>>;

export interface VerifyRegistrationRequest {
  /** The raw challenge that was issued for this ceremony. */
  challenge: string;
  response: WebAuthnClientResponse;
}

export interface VerifyAuthenticationRequest {
  challenge: string;
  response: WebAuthnClientResponse;
  /** Stored public key of the credential the response claims to be. */
  publicKey: string;
  /** Stored counter, so the adapter can surface the authenticator's new value. */
  storedSignCount: number;
}

/** Facts the verifier extracts from a *cryptographically verified* registration. */
export interface VerifiedRegistration {
  readonly credentialId: string;
  readonly publicKey: string;
  readonly signCount: number;
  readonly transports: readonly string[];
  readonly aaguid: string;
  readonly backupEligible: boolean;
  readonly backupState: boolean;
  readonly userVerified: boolean;
}

/** Facts the verifier extracts from a *cryptographically verified* assertion. */
export interface VerifiedAuthentication {
  readonly credentialId: string;
  readonly signCount: number;
  readonly userVerified: boolean;
  readonly backupState: boolean;
}

/**
 * WebAuthnVerifier port — the entire WebAuthn/FIDO2 protocol boundary.
 *
 * An implementation MUST perform the full ceremony validation (origin, RP id,
 * type, challenge match, attestation and assertion signature) and MUST fail
 * closed. No implementation ships in I-4 by design: the real adapter arrives in
 * I-7. Tests supply explicit doubles, never a permissive stand-in in `src`.
 */
export interface WebAuthnVerifier {
  verifyRegistration(
    request: VerifyRegistrationRequest,
  ): Promise<Result<VerifiedRegistration, WebAuthnVerificationFailedError>>;

  verifyAuthentication(
    request: VerifyAuthenticationRequest,
  ): Promise<Result<VerifiedAuthentication, WebAuthnVerificationFailedError>>;
}
