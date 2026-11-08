import type { Metadata } from 'next';

import { SiteFooter } from '@/components/SiteFooter';
import { CATEGORIES, PRODUCTS } from '@/data/catalog';

import { ProductsBrowser } from './ProductsBrowser';

/*
 * /products — the informational catalog.
 *
 * WHAT THIS PAGE IS. Product identity and specification, browsable and
 * searchable, every record read off the manufacturer's own published page and
 * linked back to it. No price, no stock, no merchant, no outbound buy link, no
 * image. That is not a reduced version of the real thing — it is a different
 * thing, and it is the product surface this project can honestly publish today.
 *
 * WHY IT IS SEPARATE FROM /preview/catalog. That route renders the authorized
 * Soundcore feed: real merchant records, behind noindex, with no links,
 * because the feed carries no shipping, its image rights are UNKNOWN and no
 * tracking link has been verified as ours. None of those blockers apply here,
 * because this page makes none of those claims and names no merchant.
 *
 * STILL NOINDEX, FOR A DIFFERENT REASON THAN BEFORE. The records are real now,
 * but ten products is not a catalog a search engine should be invited to rank,
 * and two of them are end-of-life or superseded by the maker's own admission.
 * Indexing is a release decision for the founder, taken once the set is large
 * enough to be useful to a stranger. `scripts/verify-catalog.mjs` asserts that
 * this page and sitemap.ts agree, so the two cannot drift apart.
 */

const BASE = 'https://honesttotal.com';

export const metadata: Metadata = {
  title: 'Products — HonestTotal',
  description:
    'Product specifications read from the manufacturer’s own pages and linked back to them. No prices, no stock claims and no merchant links.',
  robots: { index: false, follow: false },
  alternates: { canonical: null },
  openGraph: {
    type: 'website',
    url: `${BASE}/products`,
    title: 'Product specifications, without the price theatre',
    description: 'What a product is, with the maker’s own page cited. Not what somebody wants you to pay for it.',
  },
};

export default function ProductsPage() {
  const verifiedDates = PRODUCTS.map((p) => p.verifiedOn).sort();
  const oldest = verifiedDates[0];
  const newest = verifiedDates[verifiedDates.length - 1];

  return (
    <>
      <main>
        <section>
          <div className="wrap" style={{ paddingTop: 48, paddingBottom: 8 }}>
            <p className="eyebrow">Catalog · {PRODUCTS.length} products</p>
            <h1 style={{ fontSize: 'clamp(1.9rem,4vw,2.8rem)' }}>Products</h1>
            <p className="lede">
              What each product <em>is</em> — panel type, interface, switch type, impedance — taken
              from the manufacturer&rsquo;s own specification page and linked straight back to it.
              This catalog deliberately carries{' '}
              <strong>no price, no stock state and no merchant</strong>, because none of those has
              been verified for these records and this project will not print a number it cannot
              stand behind.
            </p>

            <div className="note" role="note">
              <p>
                <strong>Every record is sourced.</strong> Each product page links the exact maker
                page its values were read from and the date they were read
                {oldest && newest ? (
                  <>
                    {' '}
                    — currently between {oldest} and {newest}
                  </>
                ) : null}
                . Where a page states several variants, the record says so instead of picking one;
                where a page states nothing, the field is simply absent.
              </p>
              <p>
                <strong>Publishing a specification is not an endorsement</strong> and not a
                partnership. We are not an affiliate, reseller or partner of any manufacturer named
                here, there are no buy links, and no manufacturer imagery is used.
              </p>
              <p className="muted" style={{ marginBottom: 0 }}>
                Read the <a href="/guides/over-ear-headphones">buying guides</a> for the criteria
                these categories are judged on, and <a href="/how-we-rank">how we rank</a> for why
                no ordering is applied here.
              </p>
            </div>

            <p className="muted">
              Categories:{' '}
              {CATEGORIES.map((category, index) => (
                <span key={category.slug}>
                  {index > 0 ? ' · ' : ''}
                  {category.name}
                </span>
              ))}
            </p>
          </div>
        </section>

        <section>
          <ProductsBrowser products={PRODUCTS} />
        </section>
      </main>
      <SiteFooter note={<>Maker-sourced specs · no prices · no merchant links</>} />
    </>
  );
}
