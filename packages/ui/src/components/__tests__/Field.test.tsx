import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { Field } from '../Field';

describe('Field', () => {
  it('renders a label tied to the input by id', () => {
    const { container } = render(
      <Field label="Email" id="email" type="email" placeholder="you@x.com" />,
    );
    const label = container.querySelector('label');
    const input = container.querySelector('input');
    expect(label?.textContent).toBe('Email');
    expect(label?.getAttribute('for')).toBe('email');
    expect(input?.getAttribute('id')).toBe('email');
    expect(input?.getAttribute('type')).toBe('email');
  });

  it('shows an error and sets aria-invalid', () => {
    const { container } = render(<Field label="Email" error="Bad email" />);
    expect(container.querySelector('.field-error')?.textContent).toBe('Bad email');
    expect(container.querySelector('input')?.getAttribute('aria-invalid')).toBe('true');
    expect(container.querySelector('input')?.className).toContain('input-error');
  });

  it('shows a hint when there is no error', () => {
    const { container } = render(<Field label="Email" hint="We never spam" />);
    expect(container.querySelector('.field-hint')?.textContent).toBe('We never spam');
    expect(container.querySelector('.field-error')).toBeNull();
  });
  it('associates the label even when neither id nor name is given', () => {
    // regression: both attributes used to go undefined, so the field was
    // announced as unlabelled by a screen reader
    const { getByLabelText } = render(<Field label="Email address" type="email" />);
    expect(getByLabelText('Email address')).toBeTruthy();
  });

  it('links a hint to the input via aria-describedby', () => {
    const { container, getByText } = render(<Field label="Email" hint="We never spam." />);
    const input = container.querySelector('input');
    const hint = getByText('We never spam.');
    expect(input?.getAttribute('aria-describedby')).toBe(hint.id);
    expect(hint.id.length).toBeGreaterThan(0);
  });

  it('announces an error via role=alert and describes the input with it', () => {
    const { container, getByRole } = render(
      <Field label="Email" error="That address is invalid." />,
    );
    const input = container.querySelector('input');
    const alert = getByRole('alert');
    expect(alert.textContent).toBe('That address is invalid.');
    expect(input?.getAttribute('aria-describedby')).toBe(alert.id);
    expect(input?.getAttribute('aria-invalid')).toBe('true');
  });
});
