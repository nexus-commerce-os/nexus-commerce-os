import { randomBytes } from 'node:crypto';
import type { TokenGenerator } from '../domain/ports/token-generator';

/** TokenGenerator producing 256 bits of CSPRNG entropy, URL-safe base64. */
export class RandomTokenGenerator implements TokenGenerator {
  private static readonly ENTROPY_BYTES = 32;

  generate(): string {
    return randomBytes(RandomTokenGenerator.ENTROPY_BYTES).toString('base64url');
  }
}
