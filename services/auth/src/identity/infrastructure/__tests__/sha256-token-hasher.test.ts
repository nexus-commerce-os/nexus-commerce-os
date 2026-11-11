import { describe, it, expect } from 'vitest';
import { Sha256TokenHasher } from '../sha256-token-hasher';
import { RandomTokenGenerator } from '../random-token-generator';

const hasher = new Sha256TokenHasher();
const generator = new RandomTokenGenerator();

describe('Sha256TokenHasher', () => {
  it('is deterministic for the same secret', () => {
    const token = generator.generate();
    expect(hasher.hash(token).equals(hasher.hash(token))).toBe(true);
  });

  it('produces a different digest for a different secret', () => {
    expect(hasher.hash('a').equals(hasher.hash('b'))).toBe(false);
  });

  it('never returns the secret itself', () => {
    const token = generator.generate();
    expect(hasher.hash(token).value).not.toBe(token);
  });

  it('produces a 64-character hex digest', () => {
    expect(hasher.hash('anything').value).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe('RandomTokenGenerator', () => {
  it('produces unique, high-entropy, URL-safe secrets', () => {
    const tokens = new Set(Array.from({ length: 100 }, () => generator.generate()));
    expect(tokens.size).toBe(100);
    for (const token of tokens) {
      expect(token).toMatch(/^[A-Za-z0-9_-]+$/);
      expect(token.length).toBeGreaterThanOrEqual(43);
    }
  });
});
