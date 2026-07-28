import type { ReactNode } from "react";

export type BadgeTone = "neutral" | "accent" | "warning" | "danger";

export type BadgeProps = {
  tone?: BadgeTone;
  children: ReactNode;
  className?: string;
};

/** Small labelled status badge (`.badge .badge-{tone}`). */
export function Badge({ tone = "neutral", children, className }: BadgeProps) {
  return (
    <span className={["badge", `badge-${tone}`, className].filter(Boolean).join(" ")}>
      {children}
    </span>
  );
}
