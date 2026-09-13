/**
 * TokenGenerator port — mints the raw refresh-token secret handed to the client
 * once at issue time. Implementations must use a cryptographically-secure source
 * with at least 256 bits of entropy.
 */
export interface TokenGenerator {
  generate(): string;
}
