import type { ReactNode } from 'react';

export type AgentTerminalProps = {
  /** Text shown at the right of the window bar, e.g. "nexus-agent · session". */
  session: string;
  /** The terminal body (conversation lines). */
  children: ReactNode;
  className?: string;
  ariaLabel?: string;
};

/** A terminal-window mock (`.term`): traffic-light bar + session label + body. */
export function AgentTerminal({ session, children, className, ariaLabel }: AgentTerminalProps) {
  return (
    <div className={['term', className].filter(Boolean).join(' ')} aria-label={ariaLabel}>
      <div className="bar">
        <i style={{ background: '#E5695B' }} />
        <i style={{ background: '#E4A94A' }} />
        <i style={{ background: '#2BD48F' }} />
        <span>{session}</span>
      </div>
      <div className="body">{children}</div>
    </div>
  );
}
