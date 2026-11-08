'use client';

/*
 * Search and category filtering for /products.
 *
 * CLIENT-SIDE ON PURPOSE. `apps/web` is a static export served by a Cloudflare
 * Worker (next.config.mjs, output: 'export'), so there is no server to answer
 * `?q=`. Twenty-five records is a trivial amount of data to filter in the
 * browser, and doing it here means the page is instant and works from the
 * Worker's cache.
 *
 * NO FRAMEWORK, NO FETCH, NO DEBOUNCE. The whole catalog is already in the
 * bundle; filtering it is a string comparison over a small array. A debounce
 * would add latency to hide work that takes microseconds.
 *
 * The grid below the controls is server-rendered for the unfiltered case by
 * the parent, so the first paint shows products even before this hydrates.
 */
import { useMemo, useState } from 'react';

import { CatalogCard, CatalogEmpty } from '@/components/CatalogCard';
import { CATEGORIES, categoryBySlug, searchProducts, type Product } from '@/data/catalog';

const ALL = 'all';

export function ProductsBrowser({ products }: { products: readonly Product[] }) {
  const [query, setQuery] = useState('');
  const [categorySlug, setCategorySlug] = useState<string>(ALL);

  const visible = useMemo(() => {
    const inCategory =
      categorySlug === ALL ? products : products.filter((p) => p.categorySlug === categorySlug);
    return searchProducts(query, inCategory);
  }, [products, query, categorySlug]);

  const selected = categorySlug === ALL ? undefined : categoryBySlug(categorySlug);

  return (
    <>
      <div className="wrap" style={{ paddingBottom: 16 }}>
        <form
          role="search"
          onSubmit={(event) => event.preventDefault()}
          style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'flex-end' }}
        >
          <div className="field" style={{ flex: '1 1 260px', minWidth: 0 }}>
            <label className="field-label" htmlFor="catalog-search">
              Search products
            </label>
            <input
              className="input"
              id="catalog-search"
              type="search"
              value={query}
              placeholder="e.g. OLED, NVMe, tenkeyless"
              autoComplete="off"
              onChange={(event) => setQuery(event.target.value)}
            />
          </div>

          <div className="field" style={{ flex: '0 1 220px', minWidth: 0 }}>
            <label className="field-label" htmlFor="catalog-category">
              Category
            </label>
            <select
              className="select"
              id="catalog-category"
              value={categorySlug}
              onChange={(event) => setCategorySlug(event.target.value)}
            >
              <option value={ALL}>All categories</option>
              {CATEGORIES.map((category) => (
                <option key={category.slug} value={category.slug}>
                  {category.name}
                </option>
              ))}
            </select>
          </div>
        </form>

        <p className="muted" aria-live="polite" style={{ marginTop: 12 }}>
          Showing {visible.length} of {products.length} products
          {selected ? ` in ${selected.name}` : ''}.
        </p>

        {selected ? (
          <p className="lede" style={{ marginTop: 0 }}>
            {selected.blurb}
            {selected.guide ? (
              <>
                {' '}
                <a href={selected.guide}>How to judge this category</a>.
              </>
            ) : null}
          </p>
        ) : null}
      </div>

      <div className="wrap" style={{ paddingBottom: 56 }}>
        {visible.length === 0 ? (
          <CatalogEmpty query={query} categoryName={selected?.name} />
        ) : (
          <div
            style={{
              display: 'grid',
              gap: 20,
              gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
            }}
          >
            {visible.map((product) => (
              <CatalogCard
                key={product.slug}
                product={product}
                category={categoryBySlug(product.categorySlug)}
              />
            ))}
          </div>
        )}
      </div>
    </>
  );
}
