import type { ReactNode } from 'react';

export type MetricStatProps = {
  /** The figure — a ReactNode so an accented `<em>` can be passed in. */
  value: ReactNode;
  label: ReactNode;
  className?: string;
};

/** A single stat (value + caption) for a metric band (`.band`). */
export function MetricStat({ value, label, className }: MetricStatProps) {
  return (
    <div className={['metric', className].filter(Boolean).join(' ')}>
      <div className="v">{value}</div>
      <div className="k">{label}</div>
    </div>
  );
}
