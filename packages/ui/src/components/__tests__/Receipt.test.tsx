import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { Receipt } from '../Receipt';

describe('Receipt', () => {
  it('renders header, rows, total, stamp and footer', () => {
    const { container } = render(
      <Receipt
        title="T"
        code="C1"
        rows={[
          { label: 'A', value: '1', mono: true },
          { label: 'B', value: '2' },
        ]}
        totalLabel="Saved"
        totalValue="$9"
        stamp="OK"
        footer="foot"
      />,
    );
    expect(container.querySelector('.receipt')).not.toBeNull();
    expect(container.querySelectorAll('.rc-row').length).toBe(2);
    expect(container.querySelector('.rc-total .val')?.textContent).toContain('$9');
    expect(container.querySelector('.stamp')?.textContent).toBe('OK');
    expect(container.querySelector('.rc-foot')?.textContent).toBe('foot');
  });

  it('omits stamp/footer when not provided', () => {
    const { container } = render(
      <Receipt title="T" rows={[]} totalLabel="Saved" totalValue="$0" />,
    );
    expect(container.querySelector('.stamp')).toBeNull();
    expect(container.querySelector('.rc-foot')).toBeNull();
  });
});
