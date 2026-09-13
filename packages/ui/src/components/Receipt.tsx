import type { ReactNode } from 'react';

export type ReceiptRow = { label: ReactNode; value: ReactNode; mono?: boolean };

export type ReceiptProps = {
  title: string;
  code?: string;
  rows: ReceiptRow[];
  totalLabel: string;
  /** Rendered inside `.val` — pass a live element (e.g. a count-up span). */
  totalValue: ReactNode;
  stamp?: string;
  footer?: ReactNode;
  className?: string;
  ariaLabel?: string;
};

/** The verified-savings receipt surface (perforated edges + VERIFIED stamp via CSS). */
export function Receipt({
  title,
  code,
  rows,
  totalLabel,
  totalValue,
  stamp,
  footer,
  className,
  ariaLabel,
}: ReceiptProps) {
  return (
    <div
      className={['receipt', className].filter(Boolean).join(' ')}
      role="img"
      aria-label={ariaLabel}
    >
      <div className="rc-head">
        <b>{title}</b>
        {code ? <span>{code}</span> : null}
      </div>
      {rows.map((r, i) => (
        <div className="rc-row" key={i}>
          <span>{r.label}</span>
          <b className={r.mono ? 'mono' : undefined}>{r.value}</b>
        </div>
      ))}
      <div className="rc-rule" />
      <div className="rc-total">
        <span className="lab">{totalLabel}</span>
        <span className="val mono">{totalValue}</span>
      </div>
      {stamp ? <div className="stamp">{stamp}</div> : null}
      {footer ? <div className="rc-foot">{footer}</div> : null}
    </div>
  );
}
