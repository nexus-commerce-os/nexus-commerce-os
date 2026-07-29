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

export type IdentityError =
  | InvalidEmailError
  | WeakPasswordError
  | InvalidProfileError
  | EmailAlreadyInUseError
  | UserNotFoundError
  | InvalidCredentialsError
  | UserDeactivatedError;
