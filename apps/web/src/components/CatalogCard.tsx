/*
 * The product card for the informational catalog.
 *
 * WHY THIS IS NOT `ProductCard` FROM `@nexus/ui`. That component is
 * OFFER-shaped: `merchantName`, `availability`, `itemPrice` and `snapshotAt`
 * are all required, because an offer without them is not an offer. This
 * catalog has no merchant, no price and no stock state, so rendering it
 * through that component would mean passing placeholder strings into fields a
 * reader reasonably treats as facts. Two cards is the honest answer; one card
 * with four lies in it is not.
 *
 * It reuses the design system's own class names (`card pcard pc-*` from
 * `@nexus/ui` styles.css) so the two look like one family without copying any
 * CSS, and `@nexus/ui` itself is left untouched.
 *
 * It renders no image. `data-placeholder` makes the existing neutral tile show
 * through, which is exactly what is wanted: reading a manufacturer's public
 * specification page tells us what a product is, and grants no right at all to
 * their photography.
 */
import Link from 'next/link';

import {
  AVAILABILITY_STATUS,
  PRICE_STATUS,
  displayName,
  formatVerifiedOn,
  sourceHost,
  type Category,
  type Product,
} from '@/data/catalog';

function idFrom(slug: string, suffix: string): string {
  return `cc-${slug}-${suffix}`;
}

export type CatalogCardProps = {
  readonly product: Product;
  readonly category: Category | undefined;
};

export function CatalogCard({ product, category }: CatalogCardProps) {
  const titleId = idFrom(product.slug, 'title');

  return (
    <article className="card pcard" aria-labelledby={titleId}>
      {/* No image is ever passed: the placeholder is the intended state. */}
      <div className="pc-media" data-placeholder="true">
        <span className="pc-media-ph" aria-hidden="true">
          No image
        </span>
      </div>

      <div className="pc-body">
        {category ? <p className="eyebrow">{category.name}</p> : null}

        <h3 className="pc-title" id={titleId}>
          <Link href={`/products/${product.slug}`}>{displayName(product)}</Link>
        </h3>

        <dl className="pc-facts">
          <div className="pc-fact">
            <dt>Model</dt>
            <dd>{product.model ?? <span className="pc-unverified">Not stated by maker</span>}</dd>
          </div>

          {product.specs.slice(0, 3).map((spec) => (
            <div className="pc-fact" key={spec.label}>
              <dt>{spec.label}</dt>
              <dd>{spec.value}</dd>
            </div>
          ))}

          <div className="pc-fact">
            <dt>Price</dt>
            <dd>
              <span className="pc-unverified">{PRICE_STATUS}</span>
            </dd>
          </div>

          <div className="pc-fact">
            <dt>Availability</dt>
            <dd>
              <span className="pc-unverified">{AVAILABILITY_STATUS}</span>
            </dd>
          </div>
        </dl>

        <p className="pc-note">
          Specification only, read from {sourceHost(product)} on{' '}
          <time dateTime={product.verifiedOn}>{formatVerifiedOn(product.verifiedOn)}</time>. We have
          not verified price, stock or delivery cost for this product.
        </p>

        <p className="pc-disc">
          No merchant is named and no purchase link exists. We earn nothing from this page, and
          publishing a maker&rsquo;s specification is not a partnership with them.
        </p>
      </div>
    </article>
  );
}

/** Shown in place of the grid when a search or filter matches nothing. */
export function CatalogEmpty({ query, categoryName }: { query: string; categoryName?: string }) {
  const scope = categoryName ? ` in ${categoryName}` : '';
  return (
    <div className="card table-empty" role="status">
      <p>
        {query.trim() === ''
          ? `No products${scope} yet.`
          : `Nothing${scope} matches “${query.trim()}”.`}
      </p>
      <p className="muted">
        The catalog is small on purpose. It grows only as records are read off a manufacturer page
        that a reader can open and check.
      </p>
    </div>
  );
}
