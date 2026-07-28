import type { ReactNode } from "react";

export type AgentPointProps = {
  /** Ordinal marker, e.g. "01". */
  index: string;
  title: string;
  children: ReactNode;
  className?: string;
};

/** A numbered capability point (`.apt`) — marker + title + body. */
export function AgentPoint({
  index,
  title,
  children,
  className,
}: AgentPointProps) {
  return (
    <div className={["apt", className].filter(Boolean).join(" ")}>
      <span className="k">{index}</span>
      <div>
        <b>{title}</b>
        <p>{children}</p>
      </div>
    </div>
  );
}
