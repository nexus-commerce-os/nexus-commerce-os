import type { ReactNode } from "react";

/** Small uppercase mono label that sits above a heading. */
export function Eyebrow({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <p className={["eyebrow", className].filter(Boolean).join(" ")}>{children}</p>
  );
}
