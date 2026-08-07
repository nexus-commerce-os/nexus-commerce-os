export type BrandProps = {
  /** When provided, the brand is a home link; otherwise a plain mark. */
  href?: string;
  className?: string;
};

/*
 * The HonestTotal wordmark + mark. Used in the nav (as a link) and the footer.
 *
 * The public brand is HonestTotal — it is the domain and the name every page
 * title carries. NEXUS is the internal architecture codename and is no longer
 * shown as the masthead, because a first-time visitor on honesttotal.com
 * reading "NEXUS Commerce OS" has no way to tell they are the same project.
 * NEXUS remains visible where it is explanatory rather than identifying: the
 * footer note and the FAQ.
 */
export function Brand({ href, className }: BrandProps) {
  const cls = ['brand', className].filter(Boolean).join(' ');
  const inner = (
    <>
      <span className="mk" aria-hidden="true" />
      HonestTotal
    </>
  );
  if (href) {
    return (
      <a className={cls} href={href} aria-label="HonestTotal home">
        {inner}
      </a>
    );
  }
  return <div className={cls}>{inner}</div>;
}
