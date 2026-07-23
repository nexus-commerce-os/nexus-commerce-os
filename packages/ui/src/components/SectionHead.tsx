import type { ReactNode } from "react";
import { Eyebrow } from "./Eyebrow";

export type SectionHeadProps = {
  eyebrow: string;
  title: ReactNode;
  /** Optional lede paragraph under the title. */
  children?: ReactNode;
};

/** Eyebrow + H2 + optional lede — the standard section header. */
export function SectionHead({ eyebrow, title, children }: SectionHeadProps) {
  return (
    <div className="sec-head">
      <Eyebrow>{eyebrow}</Eyebrow>
      <h2>{title}</h2>
      {children ? <p>{children}</p> : null}
    </div>
  );
}
