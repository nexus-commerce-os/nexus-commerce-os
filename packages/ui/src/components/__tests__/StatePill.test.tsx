import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { StatePill, type SavingsState } from '../StatePill';

describe('StatePill', () => {
  const states: SavingsState[] = ['estimated', 'pending', 'confirmed', 'reversed'];
  const classes = ['est', 'pend', 'conf', 'rev'];

  states.forEach((state, i) => {
    it(`maps ${state} → "st ${classes[i]}"`, () => {
      const { container } = render(<StatePill state={state}>{state}</StatePill>);
      const span = container.querySelector('span');
      expect(span?.className).toBe(`st ${classes[i]}`);
      expect(span?.textContent).toBe(state);
    });
  });
});
