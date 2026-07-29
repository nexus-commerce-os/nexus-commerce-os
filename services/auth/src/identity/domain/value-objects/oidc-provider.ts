/**
 * OidcProvider — which identity provider a federation record belongs to
 * (`google`, `apple`, …). Kept as a validated slug rather than a closed enum so
 * a new provider is a configuration change, not a domain change; the concrete
 * issuer/JWKS metadata lives with the adapter (I-7).
 *
 * Part of the `(provider, subject)` uniqueness key, so it is normalised to lower
 * case — `Google` and `google` must never become two different providers.
 */
export class OidcProvider {
  private static readonly SLUG = /^[a-z0-9][a-z0-9-]{0,63}$/;

  private constructor(public readonly value: string) {}

  static fromSlug(raw: string): OidcProvider {
    const normalised = raw.trim().toLowerCase();
    if (!OidcProvider.SLUG.test(normalised)) {
      throw new Error(`Invalid OidcProvider: "${raw}"`);
    }
    return new OidcProvider(normalised);
  }

  equals(other: OidcProvider): boolean {
    return this.value === other.value;
  }

  toString(): string {
    return this.value;
  }
}
