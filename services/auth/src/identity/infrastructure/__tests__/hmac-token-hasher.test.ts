import { describe, it, expect } from 'vitest';
import { HmacTokenHasher } from '../hmac-token-hasher';
import { Sha256TokenHasher } from '../sha256-token-hasher';
import { RandomTokenGenerator } from '../random-token-generator';
import { TEST_TOKEN_PEPPER } from '../../__tests__/support';

const hasher = new HmacTokenHasher(TEST_TOKEN_PEPPER);
const generator = new RandomTokenGenerator();

describe('HmacTokenHasher', () => {
  it('is deterministic for the same secret and key', () => {
    const token = generator.generate();
    expect(hasher.hash(token).equals(hasher.hash(token))).toBe(true);
  });

  it('produces a different digest for a different token', () => {
    expect(hasher.hash('a').equals(hasher.hash('b'))).toBe(false);
  });

  it('produces a different digest under a different key (the pepper matters)', () => {
    const other = new HmacTokenHasher('another-test-only-pepper-00000000000000');
    expect(hasher.hash('same-token').equals(other.hash('same-token'))).toBe(false);
  });

  it('differs from a plain SHA-256 of the same token (keyed, not bare)', () => {
    const plain = new Sha256TokenHasher();
    expect(hasher.hash('same-token').equals(plain.hash('same-token'))).toBe(false);
  });

  it('never returns the token itself and emits a 64-char hex digest', () => {
    const token = generator.generate();
    expect(hasher.hash(token).value).not.toBe(token);
    expect(hasher.hash(token).value).toMatch(/^[0-9a-f]{64}$/);
  });

  it('refuses a key that is too short to be a real pepper', () => {
    expect(() => new HmacTokenHasher('short')).toThrow(/at least/);
  });
});
