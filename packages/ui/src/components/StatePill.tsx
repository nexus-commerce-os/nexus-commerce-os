import type { ReactNode } from "react";

/** The four savings states (docs/11 §2 · ADR-0021 D4). */
export type SavingsState = "estimated" | "pending" | "confirmed" | "reversed";

const TONE: Record<SavingsState, string> = {
  estimated: "est",
  pending: "pend",
  confirmed: "conf",
  reversed: "rev",
};

/** Colour-coded pill for a savings-lifecycle state. */
export function StatePill({
  state,
  children,
}: {
  state: SavingsState;
  children: ReactNode;
}) {
  return <span className={`st ${TONE[state]}`}>{children}</span>;
}
