import { type Result, ok, err } from '../../../kernel/result';
import { InvalidProfileError } from '../errors';

export interface ProfileProps {
  displayName: string;
  locale: string;
}

/**
 * Profile entity — user-facing presentation data owned by the User aggregate
 * (doc 06 §3.1 `PROFILE`). Deliberately minimal for P0.2 I-1; extended in later
 * increments (avatar, timezone, …).
 */
export class Profile {
  private static readonly MAX_DISPLAY_NAME = 100;
  private static readonly LOCALE_PATTERN = /^[a-z]{2}(-[A-Z]{2})?$/;

  private constructor(
    private _displayName: string,
    private _locale: string,
  ) {}

  static create(props: ProfileProps): Result<Profile, InvalidProfileError> {
    const displayName = props.displayName.trim();
    const reasons: string[] = [];
    if (displayName.length === 0) {
      reasons.push('displayName must not be empty');
    }
    if (displayName.length > Profile.MAX_DISPLAY_NAME) {
      reasons.push(`displayName must be at most ${Profile.MAX_DISPLAY_NAME} characters`);
    }
    if (!Profile.LOCALE_PATTERN.test(props.locale)) {
      reasons.push('locale must be a BCP-47 tag like "en" or "en-US"');
    }
    if (reasons.length > 0) {
      return err(new InvalidProfileError(reasons));
    }
    return ok(new Profile(displayName, props.locale));
  }

  /** Rehydrate from persistence without re-validation. */
  static reconstitute(props: ProfileProps): Profile {
    return new Profile(props.displayName, props.locale);
  }

  get displayName(): string {
    return this._displayName;
  }

  get locale(): string {
    return this._locale;
  }
}
