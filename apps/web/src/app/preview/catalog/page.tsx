import type { Metadata } from 'next';
import { ProductCard, ProductCardError } from '@nexus/ui';

import { SiteFooter } from '@/components/SiteFooter';
import { getMerchant, mayClaimAffiliateRelationship } from '@/lib/merchants';
import { toProductCardView } from '@/lib/product-card-view';
import { describeFreshness, isReleasable } from '@nexus/catalog';
import { FEED_ENV_VAR, loadSoundcoreFeed } from '@/lib/soundcore-preview-feed';

/*
 * /preview/catalog — NOT A PUBLIC PAGE.
 *
 * The first real products this project has ever rendered, kept behind a route
 * nothing links to and robots are told to ignore. It exists to answer one
 * question before anything ships: does an authorized feed, run through the
 * catalog guard and into the design system, produce something honest?
 *
 * WHAT IT DELIBERATELY IS NOT. There is no ranking, no "cheapest", no delivered
 * total and no sort — the products appear in feed order, because every ordering
 * this site would want to apply needs a delivered cost, and the measured feed
 * states no shipping for any of its 227 records. There are no outbound links
 * and no buy buttons: no network-issued affiliate URL exists for this merchant.
 * There are no Soundcore or Anker logos; the merchant is named in text.
 *
 * THE PATH CARRIES NO BRAND NAME, and that is a contract term rather than a
 * preference. Soundcore's CJ program terms prohibit branded keywords in a
 * publisher's URLs ("Website — URL keywords"), so `/preview/soundcore` would
 * have breached the agreement the moment it was served — noindex does not
 * help, because the restriction is about the URL, not about indexing.
 *
 * This page is excluded from sitemap.ts by omission and from indexing by the
 * metadata below. Both, and the absence of a brand term in any route path, are
 * asserted by apps/web/scripts/verify-preview.mjs so they cannot rot.
 */

/** How many products the preview shows. Deliberately small and deliberately fixed. */
const PREVIEW_COUNT = 20;

export const metadata: Metadata = {
  title: 'Catalog preview — HonestTotal (internal)',
  description: 'Internal, non-public preview of validated product data. Not indexed.',
  robots: { index: false, follow: false, nocache: true },
  /*
   * The root layout sets `canonical: '/'` so that pages which forget to declare
   * one still point somewhere sane. Inheriting it here would tell a crawler
   * that this page IS the home page while also telling it not to index this
   * page — two instructions that contradict each other, and the kind of mixed
   * signal that makes the rest of the site's canonicals less trustworthy.
   * `null` emits no canonical at all, which is the honest answer for a page
   * that is not a public URL.
   */
  alternates: { canonical: null },
};

export default function SoundcorePreviewPage() {
  const merchant = getMerchant('soundcore');
  const feed = loadSoundcoreFeed();

  /*
   * Stated as a fact about this build, not as marketing. If the registry ever
   * does say approved, the sentence changes with it rather than going stale.
   */
  const disclosure =
    merchant && mayClaimAffiliateRelationship(merchant)
      ? 'We have an affiliate relationship with this merchant. It cannot affect the order of these products.'
      : 'We are not an affiliate of this merchant and earn nothing from this page.';

  const linkUnavailableReason =
    'No authorised link to this merchant exists yet, so we will not send you to one.';

  const offers = feed.ok ? feed.offers.slice(0, PREVIEW_COUNT) : [];

  return (
    <>
      <main>
        <section>
          <div className="wrap" style={{ paddingTop: 48, paddingBottom: 8 }}>
            <p className="eyebrow">Internal preview · not public</p>
            <h1 style={{ fontSize: 'clamp(1.9rem,4vw,2.8rem)' }}>Soundcore catalog preview</h1>
            <p className="lede">
              Real products from an authorized CJ product feed, validated by the catalog guard and
              rendered by the production component. Nothing here is ranked, compared or linked.
            </p>

            {/*
             * The disclaimer is the point of the page, so it is above the grid
             * rather than under it.
             */}
            <div
              className="card"
              style={{ padding: '18px 20px', marginTop: 26, borderColor: 'var(--amber)' }}
            >
              <p style={{ margin: 0, fontWeight: 600 }}>
                Shipping is not verified for any product on this page.
              </p>
              <p style={{ margin: '8px 0 0', color: 'var(--muted)', fontSize: '.9rem' }}>
                The merchant&rsquo;s feed states no delivery cost for any of its records, so every
                price below is the item alone. We do not estimate what delivery would cost, and we
                do not show a total, a saving or a cheapest-price claim until the delivered cost of
                every compared offer has been verified.
              </p>
            </div>

            {feed.ok && !isReleasable(feed.freshness) ? (
              <div
                className="card"
                style={{ padding: '14px 18px', marginTop: 16, borderColor: 'var(--danger)' }}
              >
                <p style={{ margin: 0, fontWeight: 600, color: 'var(--danger)' }}>
                  Local preview only — this data is not fit to publish.
                </p>
                <p style={{ margin: '6px 0 0', color: 'var(--muted)', fontSize: '.85rem' }}>
                  {describeFreshness(feed.freshness)}. A release build refuses it.
                </p>
              </div>
            ) : null}

            {feed.ok ? (
              <p className="foot-note" style={{ marginTop: 18, maxWidth: '72ch' }}>
                Source: {feed.sourceName} · exported {feed.exportedAt?.slice(0, 10) ?? 'unknown'} ·{' '}
                {feed.offers.length} products passed validation
                {feed.rejectedCount > 0 ? `, ${feed.rejectedCount} rejected` : ''}
                {feed.malformedCount > 0 ? `, ${feed.malformedCount} malformed rows` : ''} · showing
                the first {offers.length} in feed order, unsorted.
              </p>
            ) : null}
          </div>
        </section>

        <section style={{ borderTop: 0 }}>
          <div className="wrap" style={{ paddingBottom: 56 }}>
            {feed.ok ? (
              <div
                style={{
                  display: 'grid',
                  gap: 22,
                  gridTemplateColumns: 'repeat(auto-fill,minmax(250px,1fr))',
                }}
              >
                {offers.map((offer) => (
                  <ProductCard
                    key={offer.offerId}
                    {...toProductCardView(offer, {
                      merchantName: merchant?.name ?? 'Unknown merchant',
                      linkUnavailableReason,
                      disclosure,
                    })}
                  />
                ))}
              </div>
            ) : (
              <div style={{ maxWidth: 520 }}>
                <ProductCardError message={feed.reason} />
                <p className="foot-note" style={{ marginTop: 14 }}>
                  Point <code>{FEED_ENV_VAR}</code> at an extracted CJ Shopping export stored
                  outside this repository, then rebuild.
                </p>
              </div>
            )}
          </div>
        </section>
      </main>

      <SiteFooter note={<>Internal preview · no affiliate links · shipping not verified</>} />
    </>
  );
}
