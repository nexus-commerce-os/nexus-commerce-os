import { describe, it, expect } from 'vitest';
import { TokenHash } from '../token-hash';

describe('TokenHash', () => {
  it('compares equal values as equal', () => {
    expect(TokenHash.fromHex('abc123').equals(TokenHash.fromHex('abc123'))).toBe(true);
  });

  it('compares different values of the same length as unequal', () => {
    expect(TokenHash.fromHex('abc123').equals(TokenHash.fromHex('abc124'))).toBe(false);
  });

  it('compares values of different length as unequal', () => {
    expect(TokenHash.fromHex('abc').equals(TokenHash.fromHex('abc123'))).toBe(false);
  });

  it('rejects an empty digest', () => {
    expect(() => TokenHash.fromHex('')).toThrow();
  });
});
