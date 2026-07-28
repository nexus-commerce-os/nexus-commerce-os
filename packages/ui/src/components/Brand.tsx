export type BrandProps = {
  /** When provided, the brand is a home link; otherwise a plain mark. */
  href?: string;
  className?: string;
};

/** The NEXUS wordmark + mark. Used in the nav (as a link) and the footer. */
export function Brand({ href, className }: BrandProps) {
  const cls = ['brand', className].filter(Boolean).join(' ');
  const inner = (
    <>
      <span className="mk" aria-hidden="true" />
      NEXUS <small>Commerce&nbsp;OS</small>
    </>
  );
  if (href) {
    return (
      <a className={cls} href={href} aria-label="NEXUS Commerce OS home">
        {inner}
      </a>
    );
  }
  return <div className={cls}>{inner}</div>;
}
