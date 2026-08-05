import type { Metadata } from 'next';

/*
 * /guides/over-ear-headphones — the first buying guide.
 *
 * TRUTH RULE FOR THIS FILE: no prices, no merchant names, no model names, no
 * per-product claims. A sentence like "the XM5 lasts 30 hours" is an
 * unverified product claim we have no data source for; a sentence like
 * "battery figures are measured at moderate volume with ANC settings the box
 * doesn't mention" is checkable knowledge about the category. Everything here
 * is the second kind. Recommendations are explicitly deferred until a real
 * data source is connected — and the page says so rather than hiding it.
 */

const BASE = 'https://honesttotal.com';

export const metadata: Metadata = {
  title: 'How to choose over-ear headphones — Honest Total',
  description:
    'A buying guide with no prices and no favourites: what actually matters in over-ear headphones — fit, noise cancelling, sound, battery, calls, repairability — and which spec-sheet numbers mislead.',
  alternates: { canonical: '/guides/over-ear-headphones' },
  openGraph: {
    type: 'article',
    url: `${BASE}/guides/over-ear-headphones`,
    title: 'Choosing headphones, without a favourite.',
    description:
      'Fit before sound, why battery figures flatter, which spec-sheet numbers mislead — and no recommendation, because we have no data source to make one honestly.',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Choosing headphones, without a favourite.',
    description: 'What actually matters, and which numbers are theatre.',
  },
};

/** The five decisions that actually separate headphones, in priority order. */
const FACTORS = [
  {
    k: '1 · Comfort and fit',
    v: 'The factor people regret most. Clamp force, earcup depth, weight distribution and pad material decide whether you reach for them daily or leave them in a drawer.',
    s: 'Cannot be read off a spec sheet — check pad dimensions, weight, and the return window.',
  },
  {
    k: '2 · Noise cancelling',
    v: 'ANC quality varies more than any other feature. Good ANC removes engine rumble and hum; no ANC removes voices — physics limits mid-range cancellation.',
    s: 'Ignore marketing decibel claims; they rarely state the frequency they were measured at.',
  },
  {
    k: '3 · Sound signature',
    v: 'Most closed over-ears are tuned warm with lifted bass. Whether that suits you is preference, not quality. EQ support in the app matters more than the stock tuning.',
    s: 'A published frequency-response measurement tells you more than any adjective.',
  },
  {
    k: '4 · Battery, honestly read',
    v: '“Up to” figures are measured at moderate volume, often with ANC in a state the box does not mention. Real-world use lands below the headline number.',
    s: 'Look for the ANC-on figure, charge time, and whether a quick charge is quoted in minutes-per-hours.',
  },
  {
    k: '5 · Calls and microphones',
    v: 'Headphones that sound excellent can still transmit poor voice. Beamforming mic arrays and wind handling decide whether you can take a call outdoors.',
    s: 'Reviews with recorded mic samples are worth more than any spec line here.',
  },
];

const TRAPS = [
  {
    t: 'Driver size',
    d: 'A 50 mm driver is not better than a 40 mm one. Tuning, enclosure and pad seal dominate; diameter is the number printed because it is easy to print.',
  },
  {
    t: 'Codec alphabet soup',
    d: 'Higher-bitrate codecs help only when source, phone and headphone all support them, and the difference is subtle on most material. A good fit changes the sound more than a codec swap.',
  },
  {
    t: '“Studio”, “Pro”, “Reference”',
    d: 'Naming, not category. Words in a product name carry no measurable meaning and are best read as decoration.',
  },
  {
    t: 'ANC decibel claims',
    d: 'Cancellation varies by frequency. A single “-XX dB” figure without a frequency range is marketing, not measurement.',
  },
  {
    t: 'Waterproof-sounding language',
    d: 'Most over-ears have no ingress rating at all. “Sweat-resistant” without an IP code is a hope, not a spec.',
  },
];

const LONGEVITY = [
  'Replaceable earpads — pads wear out first; gluing them in makes the whole unit disposable',
  'User-replaceable or serviceable battery — the second thing to die',
  'Folding mechanism and hinge construction — the most common mechanical failure point',
  'Firmware and app support history — features can be added or quietly dropped after purchase',
  'Availability of parts — a headband or cable you can actually order',
];

const FAQ = [
  {
    q: 'Which model should I buy?',
    a: 'We are not going to answer that yet, and that is deliberate. A recommendation is only honest when it comes from data we can verify — real offers, real availability, real totals. Until a data source is connected, this guide teaches you how to judge, and declines to pretend it has judged for you.',
  },
  {
    q: 'Why is there no price advice on this page?',
    a: 'Because we have no authorized price data yet, and quoting a price we cannot source would break the one rule this site is built on. When live comparisons exist, they will follow the method on our How we rank page — totals, not headline prices.',
  },
  {
    q: 'Is more expensive better?',
    a: 'Above the budget tier, price mostly buys ANC quality, materials, and call performance — not proportionally better sound. The relationship between price and quality flattens quickly, which is precisely why comparing totals matters.',
  },
  {
    q: 'Wireless or wired?',
    a: 'For most people, wireless with an optional cable is the practical answer. If you need zero latency for production work, wired remains the reliable path — and many wireless over-ears work passively with a cable, which is worth checking before buying.',
  },
];

const BREADCRUMB_LD = {
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: [
    { '@type': 'ListItem', position: 1, name: 'Home', item: `${BASE}/` },
    {
      '@type': 'ListItem',
      position: 2,
      name: 'How to choose over-ear headphones',
      item: `${BASE}/guides/over-ear-headphones`,
    },
  ],
};

const FAQ_LD = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: FAQ.map((f) => ({
    '@type': 'Question',
    name: f.q,
    acceptedAnswer: { '@type': 'Answer', text: f.a },
  })),
};

export default function OverEarGuidePage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(BREADCRUMB_LD) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(FAQ_LD) }}
      />

      <header className="nav">
        <div className="wrap nav-in">
          <a className="brand" href="/" aria-label="Honest Total home">
            <span className="mk" aria-hidden="true" />
            NEXUS <small>Commerce OS</small>
          </a>
          <nav className="nav-links">
            <a href="/">Home</a>
            <a href="/how-we-rank">How we rank</a>
            <a className="active" href="/guides/over-ear-headphones">
              Buying guide
            </a>
          </nav>
          <a className="btn btn-primary" href="/#cta">
            Join the waitlist
          </a>
        </div>
      </header>

      <main>
        <div className="wrap">
          <nav className="crumbs" aria-label="Breadcrumb">
            <ol>
              <li>
                <a href="/">Home</a>
              </li>
              <li>
                <span aria-current="page">How to choose over-ear headphones</span>
              </li>
            </ol>
          </nav>
        </div>

        {/* hero */}
        <section className="hero" style={{ borderTop: 0 }}>
          <div className="wrap">
            <span className="pill-eyebrow">
              <span aria-hidden="true">✦</span>
              <p className="eyebrow">Buying guide · over-ear headphones</p>
            </span>
            <h1 className="hero-h1" style={{ maxWidth: '22ch' }}>
              <span className="h1-underlined">Choose well.</span>
              <br />
              <em>No favourites,</em> no prices.
            </h1>
            <p className="lede" style={{ marginTop: 24 }}>
              This guide has one job: make you harder to mislead. It covers what genuinely separates
              over-ear headphones, which spec-sheet numbers deserve your attention, and which exist
              mainly to be printed on a box.
            </p>
            <p className="prelaunch" style={{ maxWidth: '58ch' }}>
              <b>No recommendations yet — on purpose.</b> We name no models and quote no prices,
              because we have no verified data source to stand behind them. When live comparisons
              exist they will follow <a href="/how-we-rank">the method</a>, publicly.
            </p>
          </div>
        </section>

        {/* five factors */}
        <section id="factors">
          <div className="wrap">
            <div className="sec-head">
              <p className="eyebrow">01 · What actually matters</p>
              <h2>Five decisions, in order.</h2>
              <p>
                Everything else on a product page is downstream of these. They are ordered by how
                often getting them wrong leads to regret.
              </p>
            </div>
            <div className="comp-list">
              {FACTORS.map((f) => (
                <div className="comp card" key={f.k}>
                  <h3>{f.k}</h3>
                  <p>{f.v}</p>
                  <p className="comp-src">{f.s}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* spec traps */}
        <section id="traps">
          <div className="wrap">
            <div className="sec-head">
              <p className="eyebrow">02 · Spec-sheet traps</p>
              <h2>Numbers that are printed to impress.</h2>
              <p>
                None of these are lies, exactly. They are true statements selected because they
                sound like quality. Here is what each one actually tells you.
              </p>
            </div>
            <div className="comp-list">
              {TRAPS.map((t) => (
                <div className="comp card" key={t.t}>
                  <h3>{t.t}</h3>
                  <p>{t.d}</p>
                </div>
              ))}
            </div>
            <p className="note">
              A useful habit: for any impressive number, ask what unit it is in and what condition
              it was measured under. If the page does not say, the number was chosen for you, not
              measured for you.
            </p>
          </div>
        </section>

        {/* longevity */}
        <section id="longevity">
          <div className="wrap">
            <div className="sec-head">
              <p className="eyebrow">03 · The years after the purchase</p>
              <h2>What decides whether they last.</h2>
              <p>
                The true cost of headphones includes the pair you buy to replace the pair that
                failed. These are the things to check before that becomes relevant.
              </p>
            </div>
            <div className="card blind" style={{ maxWidth: 720 }}>
              <h3>Before you buy, find out</h3>
              <ul className="tick-list">
                {LONGEVITY.map((l) => (
                  <li key={l}>{l}</li>
                ))}
              </ul>
            </div>
            <p className="note">
              This is also where the all-in mindset from{' '}
              <a href="/how-we-rank">our ranking method</a> applies before any ranking exists: a
              cheaper pair with glued pads and no parts supply can cost more per year of use than
              the pair that looked expensive.
            </p>
          </div>
        </section>

        {/* what this guide won't do */}
        <section id="honesty">
          <div className="wrap">
            <div className="sec-head">
              <p className="eyebrow">04 · What this guide refuses to do</p>
              <h2>The line we hold.</h2>
            </div>
            <div className="blind-grid">
              <div className="card blind">
                <h3>This guide gives you</h3>
                <ul className="tick-list">
                  <li>The factors that separate good from regrettable</li>
                  <li>How to read a spec sheet without being led</li>
                  <li>What to check for longevity before paying</li>
                </ul>
              </div>
              <div className="card blind blind-out">
                <h3>It deliberately does not</h3>
                <ul className="cross-list">
                  <li>Name a best model — no verified data source yet</li>
                  <li>Quote any price — none would have a source</li>
                  <li>Rank merchants — no live comparison exists</li>
                </ul>
              </div>
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section id="faq">
          <div className="wrap">
            <div className="sec-head">
              <p className="eyebrow">05 · Questions</p>
              <h2>Asked and answered plainly.</h2>
            </div>
            <div className="faq">
              {FAQ.map((f) => (
                <details key={f.q}>
                  <summary>{f.q}</summary>
                  <p>{f.a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        {/* CTA */}
        <section id="cta" style={{ borderTop: 0 }}>
          <div className="wrap">
            <div className="cta-final">
              <h2>When the data arrives, the totals will too.</h2>
              <p>
                Live comparisons will follow the published method — all-in totals, commission-blind,
                nothing unverified. Be there when they open.
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
            <span className="mono">No prices quoted · no models endorsed · pre-launch</span>
          </div>
        </div>
      </footer>
    </>
  );
}
