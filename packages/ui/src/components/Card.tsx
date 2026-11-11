import type { ReactNode, CSSProperties } from 'react';

export type CardProps = {
  children: ReactNode;
  /** Variant/modifier classes appended after the base `.card` surface. */
  className?: string;
  style?: CSSProperties;
};

/** Bordered, rounded surface. Base look comes from the `.card` token class. */
export function Card({ children, className, style }: CardProps) {
  return (
    <div className={['card', className].filter(Boolean).join(' ')} style={style}>
      {children}
    </div>
  );
}
