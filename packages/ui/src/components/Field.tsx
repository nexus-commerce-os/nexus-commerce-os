import type { ReactNode, ChangeEventHandler } from 'react';

export type FieldProps = {
  label: string;
  id?: string;
  name?: string;
  type?: string;
  placeholder?: string;
  value?: string;
  defaultValue?: string;
  required?: boolean;
  disabled?: boolean;
  autoComplete?: string;
  hint?: ReactNode;
  error?: string;
  onChange?: ChangeEventHandler<HTMLInputElement>;
};

/** Labelled text input with optional hint / error (`.field` + `.input`). */
export function Field({
  label,
  id,
  name,
  type = 'text',
  placeholder,
  value,
  defaultValue,
  required,
  disabled,
  autoComplete,
  hint,
  error,
  onChange,
}: FieldProps) {
  // Falling back to a label-derived id keeps the label associated even when a
  // caller supplies neither `id` nor `name` — previously both attributes went
  // undefined and the field was announced as unlabelled. Deterministic (not a
  // hook) so this stays a server-renderable component.
  const inputId = id ?? name ?? `field-${slugify(label)}`;
  const describedById = `${inputId}-description`;
  const description = error ?? hint;
  return (
    <div className="field">
      <label className="field-label" htmlFor={inputId}>
        {label}
      </label>
      <input
        className={['input', error ? 'input-error' : ''].filter(Boolean).join(' ')}
        id={inputId}
        name={name}
        type={type}
        placeholder={placeholder}
        value={value}
        defaultValue={defaultValue}
        required={required}
        disabled={disabled}
        autoComplete={autoComplete}
        onChange={onChange}
        aria-invalid={error ? true : undefined}
        aria-describedby={description === undefined ? undefined : describedById}
      />
      {error !== undefined ? (
        // role="alert" so a validation failure is announced, not just shown
        <span className="field-error" id={describedById} role="alert">
          {error}
        </span>
      ) : hint !== undefined ? (
        <span className="field-hint" id={describedById}>
          {hint}
        </span>
      ) : null}
    </div>
  );
}

/** Stable, URL-safe id fragment derived from the visible label. */
function slugify(label: string): string {
  return (
    label
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'input'
  );
}
