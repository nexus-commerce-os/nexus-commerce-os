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
 * TEXT-FIRST, AND NO MEDIA BOX AT ALL. The first version kept the design
 * system's image frame and let its "No image" placeholder show through. Ten of
 * those in a grid did not read as a principled refusal to use somebody else's
 * photography — it read as a page that had failed to load, and it pushed the
 * actual specifications below the fold. A card with no image area is a
 * deliberate layout; a card with an empty one is a broken layout. There is
 * still no image anywhere, for the same reason as before: reading a maker's
 * public specification page grants no right to their imagery.
 *
 * WHY "Price not verified" IS PLAIN GREY AND NOT AN AMBER PILL. It is the
 * normal, expected state of every record in this catalog, not an exception or
 * a fault. Rendering it in the design system's warning colour — alongside an
 * amber "Not verified" availability row and an amber "Not stated by maker"
 * model row — turned a grid of ten honest records into a wall of warnings, and
 * a page where everything is a warning teaches a reader to ignore warnings.
 * The fact is unchanged and still stated on every card; only its visual weight
 * is now proportionate.
 *
 * AVAILABILITY IS NOT ON THE CARD. Stock is not something this catalog tries
 * to establish, so flagging it as unverified advertises a gap in work nobody
 * is doing. Price is different — an honest total is the site's whole premise,
 * so "not verified" there is information. Availability stays on the detail
 * page, where the full provenance table belongs.
 *
 * A MISSING MODEL NUMBER IS NOT AN ERROR EITHER. Three manufacturers publish
 * no model identifier on their own specification page. That is a fact about
 * their page, not a defect in the record, so the row is simply omitted here
 * and explained in full on the detail page.
 */
import Link from 'next/link';

import { PRICE_STATUS, displayName, type Category, type Product } from '@/data/catalog';

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
      <div className="pc-body">
        {category ? <p className="eyebrow">{category.name}</p> : null}

        <h3 className="pc-title" id={titleId}>
          <Link href={`/products/${product.slug}`}>{displayName(product)}</Link>
        </h3>

        {/* Omitted entirely when the maker publishes none — see the note above. */}
        {product.model ? (
          <p className="muted mono" style={{ margin: '0 0 12px', fontSize: '0.85rem' }}>
            {product.model}
          </p>
        ) : null}

        <dl className="pc-facts">
          {product.specs.slice(0, 3).map((spec) => (
            <div className="pc-fact" key={spec.label}>
              <dt>{spec.label}</dt>
              <dd>{spec.value}</dd>
            </div>
          ))}
        </dl>

        <p className="muted" style={{ marginBottom: 12 }}>
          {PRICE_STATUS}
        </p>

        <p style={{ marginBottom: 0 }}>
          <Link href={`/products/${product.slug}`}>
            View product details<span className="sr-only"> for {displayName(product)}</span>
          </Link>
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
