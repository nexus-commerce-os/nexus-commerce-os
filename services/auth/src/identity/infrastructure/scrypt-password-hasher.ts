import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import { PasswordHash } from '../domain/value-objects/password-hash';
import type { PasswordHasher } from '../domain/ports/password-hasher';

const scryptAsync = promisify(scrypt) as (
  password: string,
  salt: Buffer,
  keylen: number,
) => Promise<Buffer>;

/**
 * PasswordHasher backed by Node's built-in scrypt KDF — a memory-hard hash with
 * a per-password random salt, no third-party dependency. Encoded form:
 * `scrypt$<saltBase64>$<hashBase64>`.
 */
export class ScryptPasswordHasher implements PasswordHasher {
  private static readonly KEY_LENGTH = 64;
  private static readonly SALT_BYTES = 16;
  private static readonly PREFIX = 'scrypt';

  async hash(plaintext: string): Promise<PasswordHash> {
    const salt = randomBytes(ScryptPasswordHasher.SALT_BYTES);
    const derived = await scryptAsync(plaintext, salt, ScryptPasswordHasher.KEY_LENGTH);
    const encoded = `${ScryptPasswordHasher.PREFIX}$${salt.toString('base64')}$${derived.toString('base64')}`;
    return PasswordHash.fromEncoded(encoded);
  }

  async verify(plaintext: string, hash: PasswordHash): Promise<boolean> {
    const parts = hash.encoded.split('$');
    if (parts.length !== 3 || parts[0] !== ScryptPasswordHasher.PREFIX) {
      return false;
    }
    const salt = Buffer.from(parts[1], 'base64');
    const expected = Buffer.from(parts[2], 'base64');
    if (salt.length === 0 || expected.length === 0) {
      return false;
    }
    const derived = await scryptAsync(plaintext, salt, expected.length);
    return derived.length === expected.length && timingSafeEqual(derived, expected);
  }
}
