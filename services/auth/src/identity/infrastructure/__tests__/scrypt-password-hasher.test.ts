import { describe, it, expect } from 'vitest';
import { ScryptPasswordHasher } from '../scrypt-password-hasher';
import { PasswordHash } from '../../domain/value-objects/password-hash';

const hasher = new ScryptPasswordHasher();

describe('ScryptPasswordHasher', () => {
  it('produces an encoded hash that is not the plaintext', async () => {
    const hash = await hasher.hash('Sup3rSecret-Pw!');
    expect(hash.encoded).not.toContain('Sup3rSecret-Pw!');
    expect(hash.encoded.startsWith('scrypt$')).toBe(true);
  });

  it('verifies a correct password', async () => {
    const hash = await hasher.hash('Sup3rSecret-Pw!');
    expect(await hasher.verify('Sup3rSecret-Pw!', hash)).toBe(true);
  });

  it('rejects an incorrect password', async () => {
    const hash = await hasher.hash('Sup3rSecret-Pw!');
    expect(await hasher.verify('wrong', hash)).toBe(false);
  });

  it('uses a random salt (same password → different encodings)', async () => {
    const a = await hasher.hash('Sup3rSecret-Pw!');
    const b = await hasher.hash('Sup3rSecret-Pw!');
    expect(a.encoded).not.toBe(b.encoded);
  });

  it('returns false for a malformed stored hash instead of throwing', async () => {
    expect(await hasher.verify('anything', PasswordHash.fromEncoded('not-a-valid-format'))).toBe(false);
  });
});
