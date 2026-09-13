import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { Select } from '../Select';

const options = [
  { value: 'us', label: 'United States' },
  { value: 'eu', label: 'EU' },
];

describe('Select', () => {
  it('renders options and reflects the controlled value', () => {
    const { container } = render(
      <Select options={options} value="eu" onChange={() => {}} ariaLabel="Region" />,
    );
    const select = container.querySelector('select');
    expect(select?.className).toBe('select');
    expect(select?.getAttribute('aria-label')).toBe('Region');
    expect(container.querySelectorAll('option').length).toBe(2);
    expect((select as HTMLSelectElement).value).toBe('eu');
  });
});
