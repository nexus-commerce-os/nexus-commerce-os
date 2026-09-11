import { describe, it, expect } from 'vitest';
import { Email } from '../email';

describe('Email', () => {
  it('accepts and normalises a valid address (trim + lowercase)', () => {
    const result = Email.create('  Jane.Doe@Example.COM  ');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.value).toBe('jane.doe@example.com');
    }
  });

  it('treats case/whitespace variants as equal', () => {
    const a = Email.create('user@example.com');
    const b = Email.create('USER@EXAMPLE.COM');
    expect(a.ok && b.ok).toBe(true);
    if (a.ok && b.ok) {
      expect(a.value.equals(b.value)).toBe(true);
    }
  });

  it.each(['', '   ', 'no-at-sign', 'missing@domain', 'a@b', '@example.com', 'user@'])(
    'rejects invalid address "%s"',
    (input) => {
      const result = Email.create(input);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error._tag).toBe('InvalidEmailError');
      }
    },
  );

  it('rejects an over-length address', () => {
    const local = 'a'.repeat(250);
    const result = Email.create(`${local}@example.com`);
    expect(result.ok).toBe(false);
  });
});
