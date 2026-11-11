import type { Metadata } from 'next';

import { SiteFooter } from '@/components/SiteFooter';

/*
 * 404 — the page a visitor lands on when a URL is wrong, and until now the only
 * page on this site with no way out of it. Next's built-in 404 renders bare
 * text with no header, no navigation and no footer, which on a trust-led site is
 * the worst possible impression: the one page that looks abandoned.
 *
 * TRUTH RULE FOR THIS FILE: it offers only pages that exist. No search box (the
 * site has no search), no "popular products" (there are none), no apology for a
 * broken link we have not confirmed is broken — the URL may simply be mistyped.
 *
 * `noindex` is set deliberately. A 404 already returns the right status code,
 * but Next renders this component for any unmatched route, and there is no value
 * in Google holding it. It is excluded from sitemap.ts for the same reason.
 */

export const metadata: Metadata = {
  title: 'Page not found — HonestTotal',
  description: 'That page does not exist. Here is everything on this site that does.',
  robots: { index: false, follow: true },
};

/** Grouped so the 404 stays useful as the site grows, rather than a flat dump. */
const DESTINATIONS: { group: string; links: { href: string; label: string; note: string }[] }[] = [
  {
    group: 'Start here',
    links: [
      { href: '/', label: 'Home', note: 'What this is and what it refuses to do' },
      { href: '/how-we-rank', label: 'How we rank', note: 'The ranking rule, in full' },
      {
        href: '/commission-blind',
        label: 'Commission-blind',
        note: 'Why paying us cannot buy position',
      },
      {
        href: '/verified-savings',
        label: 'Verified savings',
        note: 'Why a saving only counts once confirmed',
      },
    ],
  },
  {
    group: 'Buying guides',
    links: [
      {
        href: '/guides/over-ear-headphones',
        label: 'Over-ear headphones',
        note: 'Fit, ANC, sound, battery, calls',
      },
      { href: '/guides/how-anc-works', label: 'How ANC works', note: 'The physics and its limits' },
      { href: '/guides/laptop', label: 'Laptops', note: 'Chassis first, chip second' },
      { href: '/guides/ssd', label: 'SSDs', note: 'Why 7,000 MB/s rarely matters' },
      {
        href: '/guides/mechanical-keyboard',
        label: 'Mechanical keyboards',
        note: 'Beyond the switch decision',
      },
      { href: '/guides/oled-tv', label: 'OLED TVs', note: 'Burn-in and brightness, honestly' },
    ],
  },
  {
    group: 'The fine print',
    links: [
      { href: '/faq', label: 'FAQ', note: 'Including how this might fail' },
      { href: '/disclosure', label: 'Disclosure', note: 'How we are paid' },
      { href: '/privacy', label: 'Privacy', note: 'One email address, if you give it' },
      { href: '/cookies', label: 'Cookies', note: 'There are none — verify it yourself' },
      { href: '/terms', label: 'Terms', note: 'Short, because the site does one thing' },
      { href: '/contact', label: 'Contact', note: 'Two real addresses, read by a person' },
    ],
  },
];

export default function NotFound() {
  return (
    <>
      <header className="nav">
        <div className="wrap nav-in">
          <a className="brand" href="/" aria-label="HonestTotal home">
            <span className="mk" aria-hidden="true" />
            HonestTotal
          </a>
          <nav className="nav-links">
            <a href="/">Home</a>
            <a href="/how-we-rank">How we rank</a>
            <a href="/faq">FAQ</a>
          </nav>
          <a className="btn btn-primary" href="/#cta">
            Join the waitlist
          </a>
        </div>
      </header>

      <main>
        <section className="hero" style={{ borderTop: 0 }}>
          <div className="wrap">
            <span className="pill-eyebrow">
              <span aria-hidden="true">✦</span>
              <p className="eyebrow">404 — page not found</p>
            </span>
            <h1 className="hero-h1" style={{ maxWidth: '18ch' }}>
              <span className="h1-underlined">That page</span>
              <br />
              <em>does not</em> exist.
            </h1>
            <p className="lede" style={{ marginTop: 24 }}>
              Either the address is mistyped or it never existed here — this site is small enough
              that the list below is genuinely everything on it. Nothing has been removed to make
              room for something else.
            </p>
          </div>
        </section>

        {DESTINATIONS.map((d) => (
          <section key={d.group}>
            <div className="wrap">
              <div className="sec-head">
                <h2>{d.group}</h2>
              </div>
              <ul className="crumbs" style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                {d.links.map((l) => (
                  <li key={l.href} style={{ marginBottom: 14 }}>
                    <a href={l.href} style={{ fontWeight: 600 }}>
                      {l.label}
                    </a>
                    <span className="proof-cap" style={{ marginLeft: 10 }}>
                      {l.note}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </section>
        ))}
      </main>

      <SiteFooter note={<>No active partnerships · no live data · stated plainly</>} />
    </>
  );
}
