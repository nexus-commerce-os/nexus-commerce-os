import type { ReactNode } from 'react';

export type PhaseTagProps = {
  /** Short phase code, e.g. "P1". */
  code: string;
  /** Highlight the currently-live phase. */
  live?: boolean;
  children: ReactNode;
};

/** A rollout-phase chip (`.phase`). */
export function PhaseTag({ code, live = false, children }: PhaseTagProps) {
  return (
    <span className={live ? 'phase live' : 'phase'}>
      <b>{code}</b> {children}
    </span>
  );
}
