import type { Metadata } from 'next';

import { SiteFooter } from '@/components/SiteFooter';
import { PRODUCTS } from '@/data/catalog';

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
  return (
    <>
      <main>
        <section>
          <div className="wrap" style={{ paddingTop: 24, paddingBottom: 4 }}>
            <p className="eyebrow">Catalog · {PRODUCTS.length} products</p>
            <h1 style={{ fontSize: 'clamp(1.9rem,4vw,2.8rem)' }}>Products</h1>
            <p className="lede">
              Specifications taken from each manufacturer&rsquo;s own page — every product here
              links the exact page its values came from and the date we read it.{' '}
              <strong>We do not verify prices</strong>, so none is shown.
            </p>
            <p className="muted">
              No merchant, no buy links, no manufacturer imagery, and no ordering applied.{' '}
              <a href="/how-we-rank">Why nothing is ranked yet</a>.
            </p>
          </div>

          {/*
            The browser lives INSIDE this section rather than in one of its
            own. Two sections meant two 80px paddings plus a border between
            the intro and the search box — 169px of nothing, which pushed the
            first product card to 837px on a 812px-tall phone, i.e. entirely
            below the fold. One section puts it around 650px.
          */}
          <ProductsBrowser products={PRODUCTS} />
        </section>
      </main>
      <SiteFooter note={<>Maker-sourced specs · no prices · no merchant links</>} />
    </>
  );
}
