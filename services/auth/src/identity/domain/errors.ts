/**
 * Identity domain errors — a discriminated union (`_tag`) so use-case callers
 * can switch exhaustively. These represent *expected* domain outcomes and are
 * returned via `Result`, never thrown.
 */

export class InvalidEmailError {
  readonly _tag = 'InvalidEmailError';
  constructor(public readonly input: string) {}
  get message(): string {
    return `"${this.input}" is not a valid email address.`;
  }
}

export class WeakPasswordError {
  readonly _tag = 'WeakPasswordError';
  constructor(public readonly reasons: readonly string[]) {}
  get message(): string {
    return `Password does not meet policy: ${this.reasons.join('; ')}.`;
  }
}

export class InvalidProfileError {
  readonly _tag = 'InvalidProfileError';
  constructor(public readonly reasons: readonly string[]) {}
  get message(): string {
    return `Profile is invalid: ${this.reasons.join('; ')}.`;
  }
}

export class EmailAlreadyInUseError {
  readonly _tag = 'EmailAlreadyInUseError';
  constructor(public readonly email: string) {}
  get message(): string {
    return `An account already exists for "${this.email}".`;
  }
}

export class UserNotFoundError {
  readonly _tag = 'UserNotFoundError';
  constructor(public readonly userId: string) {}
  get message(): string {
    return `No user found for id "${this.userId}".`;
  }
}

export class InvalidCredentialsError {
  readonly _tag = 'InvalidCredentialsError';
  get message(): string {
    return 'The email or password is incorrect.';
  }
}

export class UserDeactivatedError {
  readonly _tag = 'UserDeactivatedError';
  constructor(public readonly userId: string) {}
  get message(): string {
    return `Account "${this.userId}" is deactivated.`;
  }
}

export class SessionNotFoundError {
  readonly _tag = 'SessionNotFoundError';
  constructor(public readonly sessionId: string) {}
  get message(): string {
    return `No session found for "${this.sessionId}".`;
  }
}

export class SessionExpiredError {
  readonly _tag = 'SessionExpiredError';
  constructor(
    public readonly sessionId: string,
    public readonly kind: 'idle' | 'absolute',
  ) {}
  get message(): string {
    return `Session "${this.sessionId}" has passed its ${this.kind} lifetime.`;
  }
}

export class SessionRevokedError {
  readonly _tag = 'SessionRevokedError';
  constructor(public readonly sessionId: string) {}
  get message(): string {
    return `Session "${this.sessionId}" has been revoked.`;
  }
}

export class RefreshTokenReusedError {
  readonly _tag = 'RefreshTokenReusedError';
  constructor(public readonly sessionId: string) {}
  get message(): string {
    return `A consumed refresh token was presented for session "${this.sessionId}"; the token family has been revoked.`;
  }
}

export class InvalidRefreshTokenError {
  readonly _tag = 'InvalidRefreshTokenError';
  get message(): string {
    return 'The refresh token is not valid.';
  }
}

export class InvalidVerificationTokenError {
  readonly _tag = 'InvalidVerificationTokenError';
  get message(): string {
    return 'The verification link is not valid.';
  }
}

export class VerificationTokenExpiredError {
  readonly _tag = 'VerificationTokenExpiredError';
  constructor(public readonly tokenId: string) {}
  get message(): string {
    return 'The verification link has expired. Request a new one.';
  }
}

export class VerificationTokenAlreadyUsedError {
  readonly _tag = 'VerificationTokenAlreadyUsedError';
  constructor(public readonly tokenId: string) {}
  get message(): string {
    return 'The verification link has already been used.';
  }
}

export class EmailAlreadyVerifiedError {
  readonly _tag = 'EmailAlreadyVerifiedError';
  constructor(public readonly userId: string) {}
  get message(): string {
    return `The email address for "${this.userId}" is already verified.`;
  }
}

export type IdentityError =
  | InvalidEmailError
  | WeakPasswordError
  | InvalidProfileError
  | EmailAlreadyInUseError
  | UserNotFoundError
  | InvalidCredentialsError
  | UserDeactivatedError
  | SessionNotFoundError
  | SessionExpiredError
  | SessionRevokedError
  | RefreshTokenReusedError
  | InvalidRefreshTokenError
  | InvalidVerificationTokenError
  | VerificationTokenExpiredError
  | VerificationTokenAlreadyUsedError
  | EmailAlreadyVerifiedError;
