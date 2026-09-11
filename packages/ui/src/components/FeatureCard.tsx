import type { ReactNode } from 'react';

export type FeatureCardProps = {
  /** Small glyph shown in the icon chip. */
  icon: ReactNode;
  title: string;
  children: ReactNode;
  className?: string;
};

/** Icon + title + body cell for a feature/promise grid (`.trust`). */
export function FeatureCard({ icon, title, children, className }: FeatureCardProps) {
  return (
    <div className={['promise', className].filter(Boolean).join(' ')}>
      <div className="ic">{icon}</div>
      <h3>{title}</h3>
      <p>{children}</p>
    </div>
  );
}
