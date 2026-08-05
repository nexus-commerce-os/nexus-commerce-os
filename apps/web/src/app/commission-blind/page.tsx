import type { Metadata } from 'next';

/*
 * /commission-blind — why money cannot reach the ranking.
 *
 * TRUTH RULE FOR THIS FILE: ADR-0021 D5 is a ratified policy, and the
 * enforcement it describes (a CI neutrality test that fails the build when
 * varying a merchant's commission changes the order) is SPECIFIED, NOT
 * RUNNING. There is no ranker: services/affiliate is a scaffold that declares
 * intent and implements nothing. §05 says so in those words. Nothing on this
 * page may describe the wall as currently enforced by executing code, and the
 * sponsored-placement rules describe a product surface that does not exist
 * yet — stated as the terms it would have to launch under.
 */

const BASE = 'https://honesttotal.com';

export const metadata: Metadata = {
  title: 'Commission-blind ranking — Honest Total',
  description:
    'Why affiliate commission can never change what we recommend: commission is absent from the ranking input rather than ignored by it, sponsored placement is walled off from organic results, and the rule is written to be audited.',
  alternates: { canonical: '/commission-blind' },
  openGraph: {
    type: 'article',
    url: `${BASE}/commission-blind`,
    title: 'The ranker is not allowed to know what we get paid.',
    description:
      'Commission is absent from the ranking input, not merely ignored by it. A rule that depends on remembering to ignore something eventually fails.',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'The ranker is not allowed to know what we get paid.',
    description:
      'Commission-blind by construction, sponsored placement walled off, and the whole rule published to be checked.',
  },
};

/** The three layers, weakest first — the order is the argument. */
const LAYERS = [
  {
    n: 'Weakest',
    t: 'A promise',
    d: 'Every comparison site says it is impartial. The claim costs nothing to make, cannot be checked from outside, and is broken quietly rather than announced. This is the layer we are trying not to rely on.',
    tone: 'muted',
  },
  {
    n: 'Better',
    t: 'A rule in the code',
    d: 'Logic that reads the commission and chooses not to use it. Better than a promise, but it survives only as long as everyone who edits it remembers why the line is there — and that memory has a half-life.',
    tone: 'warn',
  },
  {
    n: 'Strongest',
    t: 'Absence from the input',
    d: 'The ordering function is never given commission data at all. There is no field to read and nothing to remember, so neutrality does not depend on anyone’s discipline. This is the one we are building.',
    tone: 'ok',
  },
];

/** What separates a ranked result from a paid one. */
const WALL = [
  {
    k: 'Where it can appear',
    organic: 'Inside the ranked list, ordered by all-in total',
    sponsored: 'Only in clearly-marked slots outside the ranked list',
  },
  {
    k: 'Effect on order',
    organic: 'Determines it',
    sponsored: 'None — it cannot move, insert, or displace a ranked offer',
  },
  {
    k: 'Labelling',
    organic: 'Shown with its source and freshness state',
    sponsored: 'Labelled as sponsored, and visually distinct, on every surface',
  },
  {
    k: 'What decides it',
    organic: 'The total you pay',
    sponsored: 'A commercial agreement, disclosed as such',
  },
];

const FAQ = [
  {
    q: 'You earn commission. How can the ranking be neutral?',
    a: 'Because the two are separated structurally rather than by intention. The ordering function is not given commission data, so there is no value in it that could respond to money. We do earn more when you buy — we just cannot steer which merchant you buy from, because the component that decides the order has never seen what any of them pay.',
  },
  {
    q: 'Could you not simply cheat and put the field back?',
    a: 'Yes. Any published rule can be broken by whoever controls the code — that is true of every site making this claim, including the ones that do not admit it. What we can offer is that the rule is specific enough to be caught: a stated method, a planned test that fails the build, and results that can be re-derived from the same inputs. A vague promise cannot be falsified; this one can.',
  },
  {
    q: 'Do merchants pay for a better position?',
    a: 'No. There is no paid placement inside results and no arrangement of any kind that lifts a merchant in the ranked list. If sponsored placement is ever introduced it sits outside the ranked list, is labelled, and cannot reorder anything.',
  },
  {
    q: 'What if the highest-paying merchant genuinely is the cheapest?',
    a: 'Then it ranks first, and that is the correct outcome. Commission-blind does not mean penalising merchants who pay us — it means their payment is not an input either way. Sometimes the best offer for you is also the best one for us; that is a coincidence, and it is allowed to be one.',
  },
  {
    q: 'Is sponsored placement running now?',
    a: 'No. There are no sponsored slots, no advertisers and no ad revenue, because there is no product surface to place anything on. The rules above are the terms any such placement would have to launch under, written now so they cannot be relaxed later to fit a deal.',
  },
  {
    q: 'Is the neutrality test running today?',
    a: 'No, and this is the most important thing on the page. The test is specified — it varies a merchant’s commission across an otherwise identical set of offers and fails the build if the order changes. It cannot run yet because there is no ranker to test: the affiliate service is a scaffold that declares its intent and implements nothing. When there is something to test, this page will say the test runs, and not before.',
  },
  {
    q: 'Why publish this before anything works?',
    a: 'Because a neutrality policy written after launch bends around whatever already shipped and whatever revenue already depends on it. Written first, it is a constraint on what we are allowed to build. The order is the point.',
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
      name: 'Commission-blind ranking',
      item: `${BASE}/commission-blind`,
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

export default function CommissionBlindPage() {
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
            <a className="active" href="/commission-blind">
              Commission-blind
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
                <span aria-current="page">Commission-blind ranking</span>
              </li>
            </ol>
          </nav>
        </div>

        {/* 1 — hero */}
        <section className="hero" style={{ borderTop: 0 }}>
          <div className="wrap">
            <span className="pill-eyebrow">
              <span aria-hidden="true">✦</span>
              <p className="eyebrow">Commission-blind</p>
            </span>
            <h1 className="hero-h1" style={{ maxWidth: '21ch' }}>
              <span className="h1-underlined">The ranker</span> <em>is not allowed</em> to know what
              we get paid.
            </h1>
            <p className="lede" style={{ marginTop: 24 }}>
              A comparison site that earns commission has an obvious reason to nudge you toward
              whoever pays it most. This page explains why ours structurally cannot — and is honest
              about which parts of that are built and which are still only written down.
            </p>
            <p className="prelaunch" style={{ maxWidth: '58ch' }}>
              <b>Pre-launch.</b> No ranker exists yet, so the enforcement described here is
              specified rather than running. §05 states exactly what does and does not exist today.
            </p>
          </div>
        </section>

        {/* 2 — the rule */}
        <section id="rule">
          <div className="wrap">
            <div className="sec-head">
              <p className="eyebrow">01 · The rule</p>
              <h2>Commission never lifts a position.</h2>
            </div>
            <div className="rule-card card">
              <p className="rule-quote">
                Ranking is determined by <b>the value of an offer to you</b>. The amount a merchant
                pays us <b>must never increase</b> its position — not by a lot, not by a little, not
                as a tie-breaker.
              </p>
              <p className="muted">
                The tie-breaker clause matters more than it looks. &ldquo;We only use commission
                when two offers are otherwise equal&rdquo; sounds harmless and is the exact
                mechanism by which a neutral ranking becomes a paid one, because in a real catalogue
                near-ties are everywhere.
              </p>
            </div>
          </div>
        </section>

        {/* 3 — three layers */}
        <section id="layers">
          <div className="wrap">
            <div className="sec-head">
              <p className="eyebrow">02 · How it is held</p>
              <h2>Three ways to keep this promise, in ascending order of trustworthiness.</h2>
              <p>
                Most sites stop at the first. The difference between the first and the third is the
                whole subject of this page.
              </p>
            </div>
            <div className="fresh-table" role="table" aria-label="Enforcement strength">
              <div className="fresh-head" role="row">
                <span role="columnheader">Strength</span>
                <span role="columnheader">Mechanism</span>
                <span role="columnheader">Why it holds or fails</span>
              </div>
              {LAYERS.map((l) => (
                <div className="fresh-row" role="row" key={l.t}>
                  <span role="cell">
                    <b className={`fstate f-${l.tone}`}>{l.n}</b>
                  </span>
                  <span role="cell">
                    <b>{l.t}</b>
                  </span>
                  <span role="cell">{l.d}</span>
                </div>
              ))}
            </div>
            <p className="note">
              The distinction between the second and third rows is the one worth internalising:
              commission is <b>absent from the input</b>, not ignored by the logic. A rule that
              depends on remembering to ignore something eventually fails, and it fails silently,
              years later, in a change nobody connected to neutrality.
            </p>
          </div>
        </section>

        {/* 4 — what crosses the wall */}
        <section id="wall">
          <div className="wrap">
            <div className="sec-head">
              <p className="eyebrow">03 · The neutrality wall</p>
              <h2>What the ordering function is given.</h2>
            </div>
            <div className="blind-grid">
              <div className="card blind">
                <h3>Crosses into the ranker</h3>
                <ul className="tick-list">
                  <li>Item price, shipping, mandatory fees — the all-in total</li>
                  <li>Freshness state and the source the data came from</li>
                  <li>Availability, stock state and item condition</li>
                  <li>Whether required components are known or missing</li>
                </ul>
              </div>
              <div className="card blind blind-out">
                <h3>Never crosses</h3>
                <ul className="cross-list">
                  <li>Commission rate, expected payout, or lifetime merchant value</li>
                  <li>Whether a merchant has any commercial relationship with us at all</li>
                  <li>Placement fees, bids, or promotional agreements</li>
                  <li>Which merchant we would prefer you to choose</li>
                </ul>
              </div>
            </div>
            <p className="note">
              The last item on the right is the honest one. It is not that we have no preference —
              any business would. It is that the preference is given no route into the decision.
            </p>
          </div>
        </section>

        {/* 5 — organic vs sponsored */}
        <section id="sponsored">
          <div className="wrap">
            <div className="sec-head">
              <p className="eyebrow">04 · Organic vs sponsored</p>
              <h2>If we ever sell placement, these are the terms.</h2>
              <p>
                No sponsored placement exists today and no advertiser has ever paid us anything.
                These rules are written now precisely because writing them later, with revenue on
                the table, is how they get softened.
              </p>
            </div>
            <div className="fresh-table" role="table" aria-label="Organic versus sponsored rules">
              <div className="fresh-head" role="row">
                <span role="columnheader">Question</span>
                <span role="columnheader">Organic result</span>
                <span role="columnheader">Sponsored placement</span>
              </div>
              {WALL.map((w) => (
                <div className="fresh-row" role="row" key={w.k}>
                  <span role="cell">
                    <b>{w.k}</b>
                  </span>
                  <span role="cell">{w.organic}</span>
                  <span role="cell">{w.sponsored}</span>
                </div>
              ))}
            </div>
            <p className="note">
              A paid position mixed into organic results is indistinguishable from a bribe, whatever
              it is called internally. Keeping the two structurally separate — different slots,
              different labels, no path from one to the other — is the only version of this that
              survives contact with a large enough cheque.
            </p>
          </div>
        </section>

        {/* 6 — status */}
        <section id="status">
          <div className="wrap">
            <div className="sec-head">
              <p className="eyebrow">05 · What is actually true today</p>
              <h2>The part most pages leave out.</h2>
            </div>
            <div className="two-col">
              <div className="card blind">
                <h3>Written and binding on us</h3>
                <ul className="tick-list">
                  <li>Commission may never increase a ranking position</li>
                  <li>Sponsored placement must be labelled and cannot reorder results</li>
                  <li>The ranking method is published in full and can be re-derived</li>
                  <li>Reversing any of this requires a superseding, dated decision</li>
                </ul>
              </div>
              <div className="card blind blind-out">
                <h3>Not running</h3>
                <ul className="cross-list">
                  <li>There is no ranker — the affiliate service implements nothing yet</li>
                  <li>The neutrality test cannot run, because it has nothing to test</li>
                  <li>No merchant feed, catalogue, or commission data is connected</li>
                  <li>No audit has been performed, because there are no results to audit</li>
                </ul>
              </div>
            </div>
            <p className="note">
              The planned test is simple enough to describe in one sentence: take an identical set
              of offers, vary only what each merchant pays, and fail the build if the order changes.
              It is worth stating now so that its absence is visible, and so that its arrival can be
              checked rather than announced.
            </p>
          </div>
        </section>

        {/* 7 — FAQ */}
        <section id="faq">
          <div className="wrap">
            <div className="sec-head">
              <p className="eyebrow">06 · Questions</p>
              <h2>Including the one that assumes we are lying.</h2>
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

        {/* 8 — CTA */}
        <section id="cta" style={{ borderTop: 0 }}>
          <div className="wrap">
            <div className="cta-final">
              <h2>A rule you can check beats a promise you cannot.</h2>
              <p>
                The method is published, the status is stated, and both are dated. If a result ever
                contradicts them, the result is wrong.
              </p>
              <div className="hero-cta" style={{ justifyContent: 'center', marginTop: 28 }}>
                <a className="btn btn-primary" href="/#cta">
                  Join the waitlist →
                </a>
                <a className="btn btn-ghost" href="/how-we-rank">
                  Read the full method
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
            <span className="mono">No paid placement · no advertisers · pre-launch</span>
          </div>
        </div>
      </footer>
    </>
  );
}
