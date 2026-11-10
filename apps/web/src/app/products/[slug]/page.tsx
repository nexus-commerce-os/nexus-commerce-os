import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { SiteFooter } from '@/components/SiteFooter';
import {
  AVAILABILITY_STATUS,
  PRICE_STATUS,
  PRODUCTS,
  categoryBySlug,
  displayName,
  formatVerifiedOn,
  productBySlug,
  productsInCategory,
  sourceHost,
} from '@/data/catalog';

/*
 * /products/[slug] — one product, in full.
 *
 * STATICALLY GENERATED, one HTML file per record, because the site is an
 * `output: 'export'` build with no server behind it. `generateStaticParams`
 * below is therefore not an optimisation — it is the only way these pages
 * exist at all.
 *
 * NO JSON-LD `Product` MARKUP, deliberately. schema.org's Product type exists
 * to feed price, availability and review data to search engines; this page has
 * none of those. Emitting the markup anyway would invite a rich result that
 * asserts more than the page does. It can be added the day the records carry a
 * verified offer, and not before.
 *
 * THE SOURCE LINK CARRIES rel="nofollow noopener". It is a citation, not an
 * endorsement and not a transfer of ranking signal, and the page says in words
 * that reading a maker's spec page is not a partnership with them.
 */

const BASE = 'https://honesttotal.com';

export function generateStaticParams(): Array<{ slug: string }> {
  return PRODUCTS.map((product) => ({ slug: product.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const product = productBySlug(slug);
  if (!product) return { title: 'Product not found — HonestTotal' };

  const category = categoryBySlug(product.categorySlug);
  const title = displayName(product);
  return {
    title: `${title} — HonestTotal`,
    description: `${product.summary} Specification only, read from ${sourceHost(product)}: no price, stock or merchant is claimed.`,
    robots: { index: false, follow: false },
    alternates: { canonical: null },
    openGraph: {
      type: 'article',
      url: `${BASE}/products/${product.slug}`,
      title,
      description: category
        ? `${category.name} · specification only, no price claimed.`
        : 'Specification only, no price claimed.',
    },
  };
}

export default async function ProductDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const product = productBySlug(slug);
  if (!product) notFound();

  const category = categoryBySlug(product.categorySlug);
  const siblings = category
    ? productsInCategory(category.slug).filter((p) => p.slug !== product.slug)
    : [];

  return (
    <>
      <main>
        <section>
          <div className="wrap" style={{ paddingTop: 40, paddingBottom: 8 }}>
            <nav className="crumbs" aria-label="Breadcrumb">
              <Link href="/products">Products</Link>
              {category ? <> · {category.name}</> : null}
            </nav>

            {category ? <p className="eyebrow">{category.name}</p> : null}
            <h1 style={{ fontSize: 'clamp(1.7rem,3.4vw,2.5rem)' }}>{displayName(product)}</h1>
            <p className="lede">{product.summary}</p>
          </div>
        </section>

        <section>
          <div className="wrap" style={{ paddingBottom: 24 }}>
            <h2>Specification</h2>
            <div className="table-wrap">
              <table className="table">
                <caption className="sr-only">Specification for {displayName(product)}</caption>
                <tbody>
                  <tr>
                    <th scope="row">Manufacturer</th>
                    <td>{product.brand}</td>
                  </tr>
                  <tr>
                    <th scope="row">Model</th>
                    <td>
                      {product.model ?? (
                        <span className="pc-unverified">
                          Not stated on the manufacturer&rsquo;s page
                        </span>
                      )}
                    </td>
                  </tr>
                  {product.specs.map((spec) => (
                    <tr key={spec.label}>
                      <th scope="row">{spec.label}</th>
                      <td>{spec.value}</td>
                    </tr>
                  ))}
                  <tr>
                    <th scope="row">Price</th>
                    <td>
                      <span className="pc-unverified">{PRICE_STATUS}</span>
                    </td>
                  </tr>
                  <tr>
                    <th scope="row">Availability</th>
                    <td>
                      <span className="pc-unverified">{AVAILABILITY_STATUS}</span>
                    </td>
                  </tr>
                  <tr>
                    <th scope="row">Where to buy</th>
                    <td>
                      No merchant link. This project publishes an outbound link only once the
                      merchant relationship and the link itself are both verified.
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </section>

        <section>
          <div className="wrap" style={{ paddingBottom: 24 }}>
            <h2>Where these values came from</h2>
            <div className="table-wrap">
              <table className="table">
                <caption className="sr-only">Provenance of this record</caption>
                <tbody>
                  <tr>
                    <th scope="row">Source</th>
                    <td>
                      <a href={product.sourceUrl} rel="nofollow noopener">
                        {sourceHost(product)}
                      </a>{' '}
                      — the manufacturer&rsquo;s own specification page
                    </td>
                  </tr>
                  <tr>
                    <th scope="row">Full source URL</th>
                    <td className="mono" style={{ wordBreak: 'break-all' }}>
                      {product.sourceUrl}
                    </td>
                  </tr>
                  <tr>
                    <th scope="row">Verified on</th>
                    <td>
                      <time dateTime={product.verifiedOn}>
                        {formatVerifiedOn(product.verifiedOn)}
                      </time>{' '}
                      — the date we read the page, not the maker&rsquo;s publication date
                    </td>
                  </tr>
                  <tr>
                    <th scope="row">Relationship</th>
                    <td>
                      None. Publishing a manufacturer&rsquo;s public specification is not an
                      endorsement by them and not an affiliate authorisation. We are not a partner,
                      affiliate or reseller of {product.brand}.
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            {product.notes && product.notes.length > 0 ? (
              <div className="note" role="note">
                <p>
                  <strong>What this record does not settle</strong>
                </p>
                <ul className="tick-list">
                  {product.notes.map((note) => (
                    <li key={note}>{note}</li>
                  ))}
                </ul>
              </div>
            ) : null}

            <p className="muted">
              No product photograph is shown. Reading a maker&rsquo;s specification page tells us
              what a product is; it grants no right to their imagery — so the card and this page
              show a neutral placeholder instead of somebody else&rsquo;s photograph.
            </p>
          </div>
        </section>

        {category ? (
          <section>
            <div className="wrap" style={{ paddingBottom: 56 }}>
              <h2>More in {category.name}</h2>
              {siblings.length === 0 ? (
                <p className="muted">Nothing else in this category yet.</p>
              ) : (
                <ul className="tick-list">
                  {siblings.map((sibling) => (
                    <li key={sibling.slug}>
                      <Link href={`/products/${sibling.slug}`}>{displayName(sibling)}</Link>
                    </li>
                  ))}
                </ul>
              )}
              {category.guide ? (
                <p>
                  <a href={category.guide}>How to judge {category.name.toLowerCase()}</a> — the
                  criteria, without a product list attached.
                </p>
              ) : null}
            </div>
          </section>
        ) : null}
      </main>
      <SiteFooter note={<>Specification only · no price verified · no merchant link</>} />
    </>
  );
}
