import { type Result, ok, err } from '../../../kernel/result';
import { InvalidEmailError } from '../errors';

/**
 * Email value object — validated and normalised (trimmed, lower-cased) on
 * construction, so an `Email` instance is always canonical and comparable.
 */
export class Email {
  private static readonly PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  private static readonly MAX_LENGTH = 254;

  private constructor(public readonly value: string) {}

  static create(raw: string): Result<Email, InvalidEmailError> {
    const normalised = raw.trim().toLowerCase();
    if (normalised.length === 0 || normalised.length > Email.MAX_LENGTH) {
      return err(new InvalidEmailError(raw));
    }
    if (!Email.PATTERN.test(normalised)) {
      return err(new InvalidEmailError(raw));
    }
    return ok(new Email(normalised));
  }

  equals(other: Email): boolean {
    return this.value === other.value;
  }

  toString(): string {
    return this.value;
  }
}
