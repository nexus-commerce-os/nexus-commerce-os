import { describe, it, expect } from 'vitest';
import { DefaultPasswordPolicy } from '../password-policy';

const policy = new DefaultPasswordPolicy();

describe('DefaultPasswordPolicy', () => {
  it('accepts a strong password', () => {
    expect(policy.validate('Sup3rSecret-Pw!').ok).toBe(true);
  });

  it.each([
    ['too short', 'Ab1cdef'],
    ['no uppercase', 'sup3rsecret-pw!'],
    ['no lowercase', 'SUP3RSECRET-PW!'],
    ['no digit', 'SuperSecret-Pw!'],
  ])('rejects a password that is %s', (_label, password) => {
    const result = policy.validate(password);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error._tag).toBe('WeakPasswordError');
      expect(result.error.reasons.length).toBeGreaterThan(0);
    }
  });

  it('reports every failing rule at once', () => {
    const result = policy.validate('short');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      // too short + no uppercase + no digit
      expect(result.error.reasons.length).toBe(3);
    }
  });
});
