import type { Metadata } from 'next';

/*
 * /about — who is behind this, and on what terms.
 *
 * TRUTH RULE FOR THIS FILE: no invented team, no invented history, no
 * borrowed credibility. The project is founder-built, self-funded and
 * pre-launch, and the page says so. The founder's personal name is
 * deliberately not published here without an explicit decision to do so —
 * what a visitor needs is the terms the site operates on, which are public
 * and checkable.
 */

export const metadata: Metadata = {
  title: 'About — Honest Total',
  description:
    'Who is behind Honest Total, why it exists, what it refuses to do, and what pre-launch means here. Independent, self-funded, and written down before launch so it can be held against us.',
  alternates: { canonical: '/about' },
};

const PRINCIPLES = [
  {
    k: 'The total is the product',
    v: 'Shopping comparison is broken in one specific way: the number you compare is not the number you pay. Fixing exactly that — nothing broader — is the project.',
  },
  {
    k: 'Rules before features',
    v: 'The ranking method, the disclosure terms and the data-sourcing policy were published before any comparison existed. The order matters: rules written after launch bend around what already shipped.',
  },
  {
    k: 'Structure over promises',
    v: 'Where a promise can be enforced in how the system is built — commission invisible to the ranker, no payment custody — we build it that way, so keeping it does not depend on anyone’s discipline.',
  },
  {
    k: 'Boring honesty',
    v: 'No invented users, no invented partnerships, no numbers without sources. If a page here ever claims something we cannot show, the page is wrong and will be corrected — that standard is public.',
  },
];

const STATUS = [
  { k: 'Stage', v: 'Pre-launch. The site is live; the comparison product is not.' },
  { k: 'Funding', v: 'Self-funded and independent. No investors, no advertisers.' },
  { k: 'Team', v: 'Founder-built — one person, building deliberately and in the open.' },
  { k: 'Partnerships', v: 'None active. When one exists, the disclosure page will name it.' },
  { k: 'First market', v: 'United States, one category at a time, starting with headphones.' },
];

export default function AboutPage() {
  return (
    <>
      <header className="nav">
        <div className="wrap nav-in">
          <a className="brand" href="/" aria-label="Honest Total home">
            <span className="mk" aria-hidden="true" />
            NEXUS <small>Commerce OS</small>
          </a>
          <nav className="nav-links">
            <a href="/">Home</a>
            <a href="/how-we-rank">How we rank</a>
            <a className="active" href="/about">
              About
            </a>
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
              <p className="eyebrow">About</p>
            </span>
            <h1 className="hero-h1" style={{ maxWidth: '20ch' }}>
              <span className="h1-underlined">Built small,</span>
              <br />
              <em>built on</em> the record.
            </h1>
            <p className="lede" style={{ marginTop: 24 }}>
              Honest Total is an independent project with one idea: a price comparison is only
              honest if it compares what you actually pay. This page says who is behind it, on what
              terms, and what stage it is truly at.
            </p>
          </div>
        </section>

        <section id="why">
          <div className="wrap">
            <div className="sec-head">
              <p className="eyebrow">01 · Why this exists</p>
              <h2>The gap between the price and the total.</h2>
            </div>
            <div className="card rule-card">
              <p className="rule-quote">
                Most comparison sites rank by the headline price, and most quietly favour whoever
                pays them most. Both problems have the same fix:{' '}
                <b>rank the real total, and make commission invisible to the ranking.</b>
              </p>
              <p className="muted">
                That fix is small enough for one builder to get right, and important enough to be
                worth doing slowly. The method is published in full on{' '}
                <a href="/how-we-rank">How we rank</a> — it was written before the product, so the
                product has to live up to it rather than the reverse.
              </p>
            </div>
          </div>
        </section>

        <section id="principles">
          <div className="wrap">
            <div className="sec-head">
              <p className="eyebrow">02 · Operating principles</p>
              <h2>The terms this project runs on.</h2>
            </div>
            <div className="comp-list">
              {PRINCIPLES.map((p) => (
                <div className="comp card" key={p.k}>
                  <h3>{p.k}</h3>
                  <p>{p.v}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="status">
          <div className="wrap">
            <div className="sec-head">
              <p className="eyebrow">03 · Plain status</p>
              <h2>Exactly where things stand.</h2>
              <p>
                Updated when it changes, dated so staleness is visible. Last updated August 2026.
              </p>
            </div>
            <div className="fresh-table" role="table" aria-label="Project status">
              {STATUS.map((s) => (
                <div className="fresh-row" role="row" key={s.k}>
                  <span role="cell">
                    <b className="fstate f-muted">{s.k}</b>
                  </span>
                  <span role="cell">{s.v}</span>
                  <span role="cell" />
                </div>
              ))}
            </div>
            <p className="note">
              Why so bare? Because the alternative is the usual pre-launch theatre — invented team
              pages and borrowed logos — and a site whose premise is honesty does not get to warm up
              with fiction. The project is documented as it actually is, and this page grows as the
              truth does.
            </p>
          </div>
        </section>

        <section id="docs">
          <div className="wrap">
            <div className="sec-head">
              <p className="eyebrow">04 · The public record</p>
              <h2>Everything a reviewer needs is already published.</h2>
            </div>
            <div className="blind-grid">
              <div className="card blind">
                <h3>Read the commitments</h3>
                <ul className="tick-list">
                  <li>
                    <a href="/how-we-rank">How we rank</a> — the full method, incl. what is not live
                  </li>
                  <li>
                    <a href="/disclosure">Disclosure</a> — money, data sourcing, privacy
                  </li>
                  <li>
                    <a href="/guides/over-ear-headphones">Buying guide</a> — the content standard
                  </li>
                </ul>
              </div>
              <div className="card blind">
                <h3>Hold us to them</h3>
                <ul className="tick-list">
                  <li>Every figure on this site is labelled illustrative until data is live</li>
                  <li>Status sections are dated, so staleness is checkable</li>
                  <li>If a page contradicts reality, the page is wrong — publicly</li>
                </ul>
              </div>
            </div>
          </div>
        </section>

        <section id="cta" style={{ borderTop: 0 }}>
          <div className="wrap">
            <div className="cta-final">
              <h2>Watch it get built.</h2>
              <p>
                The waitlist is one email when your region opens — and the only list your address
                joins.
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

      <footer>
        <div className="wrap">
          <div className="foot-bottom">
            <span>© 2026 NEXUS Commerce OS</span>
            <span className="mono">Independent · self-funded · pre-launch</span>
          </div>
        </div>
      </footer>
    </>
  );
}
