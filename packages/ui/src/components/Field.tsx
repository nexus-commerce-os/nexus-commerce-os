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
  const inputId = id ?? name;
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
      />
      {error ? (
        <span className="field-error">{error}</span>
      ) : hint ? (
        <span className="field-hint">{hint}</span>
      ) : null}
    </div>
  );
}
