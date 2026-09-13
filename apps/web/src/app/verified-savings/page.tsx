import type { Metadata } from 'next';

import { SiteFooter } from '@/components/SiteFooter';

/*
 * /verified-savings — what a saving has to survive before we count it.
 *
 * TRUTH RULE FOR THIS FILE: the four-state model (Estimated → Pending →
 * Confirmed → Reversed) is a ratified internal decision, not running software.
 * ADR-0021 D4 fixes the customer-facing states and restricts the headline
 * metric to Confirmed only; ADR-0012 and ADR-0014 fix the backend behaviour it
 * rests on. Everything here is therefore written as the rule we are bound to,
 * with §06 stating the running total plainly: zero, because nobody has used a
 * product that is not open. The worked example is labelled ILLUSTRATION and
 * uses Merchant A — attaching an invented figure to a real retailer would be a
 * fabricated claim about a real company.
 */

const BASE = 'https://honesttotal.com';

export const metadata: Metadata = {
  title: 'Verified savings — HonestTotal',
  description:
    'A saving is only counted once it is confirmed: estimated and pending amounts never reach the total. The four states explained, what each one has to survive, and why a number that can only go up is not evidence.',
  alternates: { canonical: '/verified-savings' },
  openGraph: {
    type: 'article',
    url: `${BASE}/verified-savings`,
    title: 'We refuse to count a saving until it is confirmed.',
    description:
      'Estimated → Pending → Confirmed → Reversed. Only Confirmed reaches the total, so the number can fall as well as rise — which is what makes it evidence rather than marketing.',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'We refuse to count a saving until it is confirmed.',
    description:
      'Four states, one that counts. A savings total that can only go up is not a measurement.',
  },
};

/** The four customer-facing states, and whether each reaches the total. */
const STATES = [
  {
    n: 'Estimated',
    d: 'The difference our comparison expects you to save, worked out before you buy anything. It is a forecast made from offer data, and forecasts are wrong sometimes.',
    counted: 'Never counted',
    tone: 'muted',
  },
  {
    n: 'Pending',
    d: 'A purchase has been reported to us by the affiliate network. One report is a signal, not proof — it can be duplicated, delayed, mistaken, or later withdrawn.',
    counted: 'Not yet counted',
    tone: 'warn',
  },
  {
    n: 'Confirmed',
    d: 'The purchase has been independently corroborated and has outlived the window in which it could be returned or reversed. Only now is the money genuinely yours to have saved.',
    counted: 'Counted',
    tone: 'ok',
  },
  {
    n: 'Reversed',
    d: 'The purchase was returned, cancelled, or rejected. The saving is removed from the total and the reversal stays on the record rather than quietly disappearing.',
    counted: 'Removed',
    tone: 'danger',
  },
];

/** What has to happen, in order, before a saving is allowed to count. */
const JOURNEY = [
  {
    n: '01',
    t: 'You buy from the merchant',
    d: 'We are not part of the transaction. We hold no card details, take no payment, and learn nothing at the moment you check out — so at this point we cannot know a purchase happened at all.',
  },
  {
    n: '02',
    t: 'The network reports a conversion',
    d: 'The affiliate network tells us a purchase occurred. This is where most sites would add the money to a total. We record it as Pending and treat it as an unverified claim, because that is what it is.',
  },
  {
    n: '03',
    t: 'We reconcile it independently',
    d: 'The report has to agree with a second source — the network’s own reporting or settlement record — before it is treated as real. A report that cannot be corroborated never becomes a saving.',
  },
  {
    n: '04',
    t: 'The reversal window elapses',
    d: 'Returns and cancellations undo purchases for weeks afterwards. Only once that window has passed without a reversal does the saving become Confirmed and reach the total.',
  },
];

const FAQ = [
  {
    q: 'Why not show me the estimated saving? It is useful.',
    a: 'It is useful, and you will see it — at the moment of comparison, labelled Estimated. What it will never do is join the total. A forecast shown beside an offer helps you decide; the same forecast added to a running total quietly turns a guess into a claim about money that may never have been saved.',
  },
  {
    q: 'How long does Pending last?',
    a: 'As long as the merchant’s return and reversal window, which varies by merchant and is not ours to set. We would rather a saving take weeks to count and be true than count immediately and be withdrawn later. No merchant is connected yet, so we cannot publish real windows — when one is, its window will be stated rather than described in general terms.',
  },
  {
    q: 'What happens to a saving that gets reversed?',
    a: 'It is removed from the total and the reversal is kept on the record. A total that silently drops is as misleading as one that silently rises, so the correction is visible rather than the number simply changing.',
  },
  {
    q: 'Could you not just count everything and adjust later?',
    a: 'That is the standard practice and it is the reason these numbers are not believed. A total built from estimates flatters whoever publishes it, is impossible to check from the outside, and never gets adjusted downwards in public. Counting only Confirmed savings is the version of the metric that can embarrass us, which is the only kind worth publishing.',
  },
  {
    q: 'Does a saving count if I return the item?',
    a: 'No. A returned purchase is reversed, and reversed savings do not count. This is the case that makes estimated totals dishonest: the item goes back, the money returns to you, and the saving was never real — but a site that counted it at checkout has already banked the headline.',
  },
  {
    q: 'How much has been saved so far?',
    a: 'Nothing. Zero dollars, and not because savings are stuck in Pending — because the product is not open, no merchant is connected, and nobody has bought anything through us. The counter is at zero because zero is the true figure today.',
  },
  {
    q: 'Is any of this running right now?',
    a: 'No. The four states are a published rule that the system is being built to follow, not a description of software in production. There is no connected merchant feed, no conversion reporting, and no total to keep. This page exists now so it cannot be quietly written to fit whatever ships later.',
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
      name: 'Verified savings',
      item: `${BASE}/verified-savings`,
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

export default function VerifiedSavingsPage() {
  return (
    <>
      {/*
       * Structured data is emitted from the same constants that render the
       * visible page, so the markup cannot drift from what a reader sees —
       * which is the failure mode Google penalises and, more to the point, the
       * one that would make us liars in a machine-readable format.
       */}
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
          <a className="brand" href="/" aria-label="HonestTotal home">
            <span className="mk" aria-hidden="true" />
            HonestTotal
          </a>
          <nav className="nav-links">
            <a href="/">Home</a>
            <a href="/how-we-rank">How we rank</a>
            <a className="active" href="/verified-savings">
              Verified savings
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
                <span aria-current="page">Verified savings</span>
              </li>
            </ol>
          </nav>
        </div>

        {/* 1 — hero */}
        <section className="hero" style={{ borderTop: 0 }}>
          <div className="wrap">
            <span className="pill-eyebrow">
              <span aria-hidden="true">✦</span>
              <p className="eyebrow">Verified savings</p>
            </span>
            <h1 className="hero-h1" style={{ maxWidth: '20ch' }}>
              <span className="h1-underlined">A saving counts</span> <em>when it survives.</em>
            </h1>
            <p className="lede" style={{ marginTop: 24 }}>
              Almost every shopping site totals up what it thinks it saved you. Those totals are
              built from estimates, they only ever go up, and nobody outside the company can check
              them. This page explains the number we intend to publish instead, and everything it
              has to survive first.
            </p>
            <p className="prelaunch" style={{ maxWidth: '58ch' }}>
              <b>Pre-launch.</b> No merchant is connected and no purchase has ever been made through
              this site. The states below are the rule we are bound to, published before there is
              anything to count — §06 gives the running total, which is zero.
            </p>
          </div>
        </section>

        {/* 2 — the rule */}
        <section id="rule">
          <div className="wrap">
            <div className="sec-head">
              <p className="eyebrow">01 · The rule</p>
              <h2>Only confirmed savings reach the total.</h2>
            </div>
            <div className="rule-card card">
              <p className="rule-quote">
                A saving is counted only once it has been <b>independently corroborated</b> and has
                outlived the window in which it could be reversed. Estimated and pending amounts are
                shown, labelled, and <b>excluded from the total</b>.
              </p>
              <p className="muted">
                The consequence is deliberate and uncomfortable: our headline number will be smaller
                than a competitor’s, it will lag behind reality by weeks, and it can go down. A
                figure that can only rise is not a measurement — it is a marketing surface with a
                dollar sign in front of it.
              </p>
            </div>
          </div>
        </section>

        {/* 3 — the four states */}
        <section id="states">
          <div className="wrap">
            <div className="sec-head">
              <p className="eyebrow">02 · The four states</p>
              <h2>Every saving is in exactly one of these.</h2>
              <p>
                The states are not presentation. They are the actual lifecycle a saving moves
                through, and only one of them is allowed anywhere near the total.
              </p>
            </div>
            <div className="fresh-table" role="table" aria-label="Savings states">
              <div className="fresh-head" role="row">
                <span role="columnheader">State</span>
                <span role="columnheader">What it means</span>
                <span role="columnheader">In the total</span>
              </div>
              {STATES.map((s) => (
                <div className="fresh-row" role="row" key={s.n}>
                  <span role="cell">
                    <b className={`fstate f-${s.tone}`}>{s.n}</b>
                  </span>
                  <span role="cell">{s.d}</span>
                  <span role="cell" className={`frank fr-${s.tone}`}>
                    {s.counted}
                  </span>
                </div>
              ))}
            </div>
            <p className="note">
              Reversed is the state most sites do not have, and its absence is the whole problem. If
              a system has no way to represent a saving that stopped being true, then returns,
              cancellations and rejected orders simply stay in the total forever.
            </p>
          </div>
        </section>

        {/* 4 — the journey */}
        <section id="journey">
          <div className="wrap">
            <div className="sec-head">
              <p className="eyebrow">03 · What has to happen</p>
              <h2>From your checkout to our total.</h2>
              <p>
                Four things must occur, in order. Skipping any of them is how a savings number
                becomes fiction.
              </p>
            </div>
            <div className="comp-list">
              {JOURNEY.map((j) => (
                <div className="comp card" key={j.n}>
                  <h3>
                    <span className="mono">{j.n}</span> · {j.t}
                  </h3>
                  <p>{j.d}</p>
                </div>
              ))}
            </div>
            <p className="note">
              Step 02 is where the discipline lives. A single conversion report is easy to receive
              and tempting to believe, and treating it as truth is how a total inflates without
              anyone deciding to inflate it. It is recorded as a claim, and a claim has to be
              corroborated before it becomes money.
            </p>
          </div>
        </section>

        {/* 5 — why estimated is refused */}
        <section id="refusal">
          <div className="wrap">
            <div className="sec-head">
              <p className="eyebrow">04 · The refusal</p>
              <h2>Why estimated savings are never counted.</h2>
              <p>
                This costs us the most attractive number on the site. The reasoning is worth stating
                rather than asserting.
              </p>
            </div>
            <div className="blind-grid">
              <div className="card blind">
                <h3>What a confirmed total gives you</h3>
                <ul className="tick-list">
                  <li>A figure that can be wrong, and therefore one that means something</li>
                  <li>Money that actually stayed in the buyer’s account</li>
                  <li>A number that falls when purchases are returned</li>
                  <li>An honest floor: real savings are higher, never lower</li>
                </ul>
              </div>
              <div className="card blind blind-out">
                <h3>What an estimated total hides</h3>
                <ul className="cross-list">
                  <li>Purchases that were returned or cancelled</li>
                  <li>Conversions the network later withdrew</li>
                  <li>Duplicate reports counted twice</li>
                  <li>Savings compared against a price nobody was going to pay</li>
                </ul>
              </div>
            </div>
            <p className="note">
              The last one is the quietest. A saving is a difference from something, and the easiest
              way to inflate one is to choose a flattering starting price — a list price, a
              historical high, a competitor nobody would have used. Our comparisons are made against
              the all-in total of the other ranked offers, which is described in full on{' '}
              <a href="/how-we-rank">How we rank</a>.
            </p>
          </div>
        </section>

        {/* 6 — illustrative example */}
        <section id="example">
          <div className="wrap">
            <div className="sec-head">
              <p className="eyebrow">05 · Worked example</p>
              <h2>One purchase, four states, over time.</h2>
              <p>
                Nothing below is real. The merchant is a placeholder and the figures are invented to
                show the mechanism, which is all this example is for.
              </p>
            </div>
            <div className="demo-panel">
              <div className="dp-glow" aria-hidden="true" />
              <div className="dp-head">
                <div>
                  <b>The same $40 saving, as it is treated over time</b>
                  <span className="dp-sub">Figures invented to demonstrate the rule</span>
                </div>
                <span className="dp-badge">ILLUSTRATION</span>
              </div>
              <div className="ex-table" role="table" aria-label="Illustrative savings lifecycle">
                <div className="ex-head" role="row">
                  <span role="columnheader">When</span>
                  <span role="columnheader">What happened</span>
                  <span role="columnheader">State</span>
                  <span role="columnheader">In the total</span>
                </div>
                <div className="ex-row" role="row">
                  <span role="cell">Before buying</span>
                  <span role="cell">Merchant A is ranked cheapest on the all-in total</span>
                  <span role="cell">
                    <b className="ex-badge">Estimated</b>
                  </span>
                  <span role="cell" className="mono ex-unknown">
                    $0.00
                  </span>
                </div>
                <div className="ex-row" role="row">
                  <span role="cell">Purchase reported</span>
                  <span role="cell">The network reports a completed order</span>
                  <span role="cell">
                    <b className="ex-badge">Pending</b>
                  </span>
                  <span role="cell" className="mono ex-unknown">
                    $0.00
                  </span>
                </div>
                <div className="ex-row" role="row">
                  <span role="cell">Window elapsed</span>
                  <span role="cell">Corroborated, not returned, past the reversal window</span>
                  <span role="cell">
                    <b className="ex-badge win">Confirmed</b>
                  </span>
                  <span role="cell" className="mono ex-win">
                    $40.00
                  </span>
                </div>
                <div className="ex-row" role="row">
                  <span role="cell">If returned</span>
                  <span role="cell">The buyer sends the item back and is refunded</span>
                  <span role="cell">
                    <b className="ex-badge out">Reversed</b>
                  </span>
                  <span role="cell" className="mono ex-unknown">
                    $0.00
                  </span>
                </div>
              </div>
              <p className="ex-note">
                The saving is real for exactly one row, and only after weeks of nothing appearing to
                happen. Every site that shows you a total on the day you buy is showing you row two.
              </p>
            </div>
          </div>
        </section>

        {/* 7 — the running total */}
        <section id="today">
          <div className="wrap">
            <div className="sec-head">
              <p className="eyebrow">06 · The running total</p>
              <h2>What the counter says right now.</h2>
            </div>
            <div className="card vms">
              <span className="vms-num">$0.00</span>
              <span className="vms-label">Confirmed savings to date</span>
              <p className="vms-body">
                Not zero because savings are waiting in Pending — zero because there are none of any
                kind. The product is not open, no merchant is connected, and nobody has bought
                anything through this site. When that changes, this figure changes, and it will be
                dated so you can see how recently it was true.
              </p>
            </div>
            <p className="note">
              Publishing a zero is the cheapest possible demonstration of the rule. A site willing
              to show an unflattering number before launch is the same site that will show one after
              it, and there is no way to prove that in advance except by doing it.
            </p>
          </div>
        </section>

        {/* 8 — FAQ */}
        <section id="faq">
          <div className="wrap">
            <div className="sec-head">
              <p className="eyebrow">07 · Questions</p>
              <h2>Including the ones we would rather avoid.</h2>
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

        {/* 9 — CTA */}
        <section id="cta" style={{ borderTop: 0 }}>
          <div className="wrap">
            <div className="cta-final">
              <h2>Judge the number when there is one.</h2>
              <p>
                Until then, judge the rule — it is published, dated, and cannot be quietly rewritten
                once it becomes inconvenient.
              </p>
              <div className="hero-cta" style={{ justifyContent: 'center', marginTop: 28 }}>
                <a className="btn btn-primary" href="/#cta">
                  Join the waitlist →
                </a>
                <a className="btn btn-ghost" href="/how-we-rank">
                  Read how we rank
                </a>
              </div>
            </div>
          </div>
        </section>
      </main>

      <SiteFooter note={<>Confirmed savings to date: $0.00 · pre-launch</>} />
    </>
  );
}
