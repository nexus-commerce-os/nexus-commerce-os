export type BrandProps = {
  /** When provided, the brand is a home link; otherwise a plain mark. */
  href?: string;
  className?: string;
  /**
   * The wordmark.
   *
   * A prop, not a literal, because this is a design-system component and the
   * product name is not a design-system fact. It was hard-coded to "NEXUS
   * Commerce OS", which is how the old codename survived a rename of every
   * consumer-facing string in apps/web and kept rendering in the nav and the
   * footer of a site served from honesttotal.com.
   */
  name?: string;
  /** Smaller text after the wordmark, e.g. a product suffix. Omitted by default. */
  suffix?: string;
};

/** The wordmark + mark. Used in the nav (as a link) and the footer. */
export function Brand({ href, className, name = 'HonestTotal', suffix }: BrandProps) {
  const cls = ['brand', className].filter(Boolean).join(' ');
  const label = suffix ? `${name} ${suffix}` : name;
  const inner = (
    <>
      <span className="mk" aria-hidden="true" />
      {name} {suffix ? <small>{suffix}</small> : null}
    </>
  );
  if (href) {
    return (
      <a className={cls} href={href} aria-label={`${label} home`}>
        {inner}
      </a>
    );
  }
  return <div className={cls}>{inner}</div>;
}
