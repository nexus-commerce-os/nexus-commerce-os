import type { Metadata } from 'next';

import { SiteFooter } from '@/components/SiteFooter';

/*
 * /disclosure — affiliate disclosure, data-sourcing policy, and privacy in
 * plain language.
 *
 * TRUTH RULE FOR THIS FILE: this page describes obligations we accept, not
 * relationships we have. As of writing there is no active affiliate
 * partnership and no live data source, and the page says so. It must be
 * updated when the first partnership goes live — the "Current status" section
 * exists precisely so that update has an obvious home.
 */

export const metadata: Metadata = {
  title: 'Disclosure — HonestTotal',
  description:
    'How HonestTotal is paid, what we promise about affiliate links, where our data comes from, and what we do — and refuse to do — with yours. Written in plain language.',
  alternates: { canonical: '/disclosure' },
};

const PROMISES = [
  {
    k: 'Disclosure before the click',
    v: 'Any link that can earn us a commission is identified as such before you use it — on the page, not buried in a policy.',
  },
  {
    k: 'Commission never moves a ranking',
    v: 'Our ordering function does not receive commission data. A merchant cannot pay to rank higher, and we cannot be tempted by what we cannot see.',
  },
  {
    k: 'Authorized data only',
    v: 'Prices and availability will come from official APIs and licensed feeds. We do not scrape merchant sites, and we show no figure we cannot trace to a source.',
  },
  {
    k: 'No payment custody',
    v: 'You always pay the merchant directly at the merchant’s own checkout. We never hold your money, your order, or your payment details.',
  },
];

const PRIVACY = [
  {
    k: 'Waitlist email',
    v: 'If you join the waitlist we store the address you gave us, and use it to tell you when HonestTotal opens in your region. Nothing else is done with it.',
  },
  {
    k: 'No tracking pixels, no ad-tech',
    v: 'This site currently sets no advertising cookies and embeds no third-party trackers. If analytics are ever added, this page will name them.',
  },
  {
    k: 'No sale of personal data',
    v: 'We do not sell or rent personal information. That is not a temporary position.',
  },
];

export default function DisclosurePage() {
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
            <a className="active" href="/disclosure">
              Disclosure
            </a>
          </nav>
          <a className="btn btn-primary" href="/#cta">
            Join the waitlist
          </a>
        </div>
      </header>

      <main>
        {/* hero */}
        <section className="hero" style={{ borderTop: 0 }}>
          <div className="wrap">
            <span className="pill-eyebrow">
              <span aria-hidden="true">✦</span>
              <p className="eyebrow">Disclosure &amp; policies</p>
            </span>
            <h1 className="hero-h1" style={{ maxWidth: '20ch' }}>
              <span className="h1-underlined">How we’re paid,</span>
              <br />
              <em>in plain</em> language.
            </h1>
            <p className="lede" style={{ marginTop: 24 }}>
              This page exists so that nothing about our incentives has to be discovered. It covers
              how money would reach us, what that does and does not influence, where our data comes
              from, and what happens to yours.
            </p>
          </div>
        </section>

        {/* current status — the section that keeps this page honest */}
        <section id="status">
          <div className="wrap">
            <div className="sec-head">
              <p className="eyebrow">01 · Current status</p>
              <h2>What is true today.</h2>
            </div>
            <div className="card rule-card">
              <p className="rule-quote">
                As of August 2026, HonestTotal has <b>no active affiliate partnership</b> and{' '}
                <b>no live data source</b>. No link on this site currently earns us anything.
              </p>
              <p className="muted">
                Everything below describes the obligations we accept for when that changes. When a
                partnership goes live, this section will name the network and the date — it is kept
                deliberately easy to update so there is never an excuse for it to be stale.
              </p>
            </div>
          </div>
        </section>

        {/* affiliate promises */}
        <section id="affiliate">
          <div className="wrap">
            <div className="sec-head">
              <p className="eyebrow">02 · Affiliate links</p>
              <h2>The rules we hold ourselves to.</h2>
              <p>
                The model is referral: if you buy through a link on this site, the merchant may pay
                us a commission. It costs you nothing extra. These are the conditions under which we
                are willing to earn it.
              </p>
            </div>
            <div className="comp-list">
              {PROMISES.map((p) => (
                <div className="comp card" key={p.k}>
                  <h3>{p.k}</h3>
                  <p>{p.v}</p>
                </div>
              ))}
            </div>
            <p className="note">
              These commitments align with what the US FTC requires of affiliate publishers — clear
              and conspicuous disclosure of material connections. We treat that as a floor, not a
              target.
            </p>
          </div>
        </section>

        {/* data sourcing */}
        <section id="data">
          <div className="wrap">
            <div className="sec-head">
              <p className="eyebrow">03 · Where figures come from</p>
              <h2>Sourcing, and the refusal that defines it.</h2>
            </div>
            <div className="blind-grid">
              <div className="card blind">
                <h3>We will use</h3>
                <ul className="tick-list">
                  <li>Official merchant and network APIs</li>
                  <li>Licensed product feeds, within their written terms</li>
                  <li>Figures that carry a source and a timestamp</li>
                </ul>
              </div>
              <div className="card blind blind-out">
                <h3>We will not use</h3>
                <ul className="cross-list">
                  <li>Scraped merchant pages, ever</li>
                  <li>Estimated or reconstructed prices</li>
                  <li>Any figure we could not defend to the merchant it names</li>
                </ul>
              </div>
            </div>
            <p className="note">
              The full reasoning — including what happens when data is incomplete — is on{' '}
              <a href="/how-we-rank">How we rank</a>.
            </p>
          </div>
        </section>

        {/* privacy */}
        <section id="privacy">
          <div className="wrap">
            <div className="sec-head">
              <p className="eyebrow">04 · Your data</p>
              <h2>What we hold, and what we refuse to.</h2>
            </div>
            <div className="comp-list">
              {PRIVACY.map((p) => (
                <div className="comp card" key={p.k}>
                  <h3>{p.k}</h3>
                  <p>{p.v}</p>
                </div>
              ))}
            </div>
            <p className="note">
              To have your waitlist address removed, use the contact route on this site and it will
              be deleted. We keep this simple because the data we hold is simple — one address,
              given voluntarily, used for one purpose.
            </p>
          </div>
        </section>

        {/* CTA */}
        <section id="cta" style={{ borderTop: 0 }}>
          <div className="wrap">
            <div className="cta-final">
              <h2>Incentives, on the record.</h2>
              <p>
                If anything on this page stops being true and the page has not been updated, that is
                a failure you are entitled to call out.
              </p>
              <div className="hero-cta" style={{ justifyContent: 'center', marginTop: 28 }}>
                <a className="btn btn-primary" href="/#cta">
                  Join the waitlist →
                </a>
                <a className="btn btn-ghost" href="/how-we-rank">
                  Read the method
                </a>
              </div>
            </div>
          </div>
        </section>
      </main>

      <SiteFooter note={<>No active partnerships · no live data · stated plainly</>} />
    </>
  );
}
