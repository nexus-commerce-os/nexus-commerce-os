export type SelectOption = { value: string; label: string };

export type SelectProps = {
  options: SelectOption[];
  value?: string;
  defaultValue?: string;
  name?: string;
  id?: string;
  disabled?: boolean;
  ariaLabel?: string;
  /** Called with the selected option's `value` (the DOM event is hidden). */
  onChange?: (value: string) => void;
};

/** Styled native `<select>` (`.select`) — accessible, no JS of its own. */
export function Select({
  options,
  value,
  defaultValue,
  name,
  id,
  disabled,
  ariaLabel,
  onChange,
}: SelectProps) {
  return (
    <select
      className="select"
      value={value}
      defaultValue={defaultValue}
      name={name}
      id={id}
      disabled={disabled}
      aria-label={ariaLabel}
      onChange={(e) => onChange?.(e.target.value)}
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}
