import type { ReactNode } from 'react';

export type StepProps = {
  /** Ordinal shown as "STEP {index}", e.g. "01". */
  index: string;
  title: string;
  children: ReactNode;
  className?: string;
};

/** A single numbered step in a process grid (`.steps`). */
export function Step({ index, title, children, className }: StepProps) {
  return (
    <div className={['step', className].filter(Boolean).join(' ')}>
      <div className="n">STEP {index}</div>
      <h3>{title}</h3>
      <p>{children}</p>
    </div>
  );
}
