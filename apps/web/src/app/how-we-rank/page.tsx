import type { Metadata } from 'next';

/*
 * /how-we-rank — the methodology page.
 *
 * TRUTH RULE FOR THIS FILE: nothing here may describe the ranker as running.
 * No connector, feed, or ranking code exists yet, so every capability is
 * written as the rule the product is built to follow, and §7 states plainly
 * what is not connected. The worked example is labelled ILLUSTRATION and uses
 * Merchant A/B/C — naming a real retailer beside a number we invented would be
 * a fabricated claim about a real company.
 */

export const metadata: Metadata = {
  title: 'How we rank — Honest Total',
  description:
    'The ranking rule in full: offers are ordered by the total you actually pay, incomplete totals are never ranked, and commission is not an input. Written for shoppers and for reviewers.',
  alternates: { canonical: '/how-we-rank' },
};

/** Every component of an all-in total, and who supplies it. */
const COMPONENTS = [
  {
    k: 'Item price',
    v: 'What the merchant lists the product at.',
    s: 'From the merchant’s own authorized feed.',
  },
  {
    k: 'Shipping',
    v: 'Delivery to the destination, or a verified free-shipping eligibility.',
    s: 'From the provider, when the provider states it.',
  },
  {
    k: 'Mandatory fees',
    v: 'Anything unavoidable at checkout — handling, surcharges, disposal levies.',
    s: 'From the provider, when disclosed.',
  },
  {
    k: 'Tax',
    v: 'Destination-based in the US, so genuinely unknown without an address.',
    s: 'Not estimated. Comparisons are made pre-tax and labelled as such.',
  },
  {
    k: 'Order-level discounts',
    v: 'Reductions that apply to the order rather than the item.',
    s: 'Only when the provider states them as applicable.',
  },
];

const FRESHNESS = [
  {
    n: 'Live',
    d: 'Observed from the provider just now, with a timestamp for that specific offer.',
    rank: 'Rankable',
    tone: 'ok',
  },
  {
    n: 'Cached',
    d: 'Observed recently and still inside the caching window our licence permits.',
    rank: 'Rankable',
    tone: 'ok',
  },
  {
    n: 'Stale',
    d: 'Older than that window. It may still be correct — but we cannot say so.',
    rank: 'Not ranked',
    tone: 'warn',
  },
  {
    n: 'Unavailable',
    d: 'The provider returned nothing usable, or the offer is out of stock.',
    rank: 'Not ranked',
    tone: 'warn',
  },
  {
    n: 'Illustrative',
    d: 'A worked example on this site. Never a real offer, always labelled.',
    rank: 'Never ranked',
    tone: 'muted',
  },
];

const FAQ = [
  {
    q: 'Why not just show the lowest item price?',
    a: 'Because the item price is not what leaves your account. Two merchants can list the same product at the same price and cost you different amounts once delivery and mandatory fees are added. Ordering by item price puts whichever merchant hides the most cost at the top.',
  },
  {
    q: 'If a total is incomplete, why not estimate the missing part?',
    a: 'An estimate presented inside a total becomes a claim we cannot substantiate — and the whole point of the ranking is that every figure in it can be traced to a source. An offer with an unknown required component is left out of the comparison rather than guessed into it.',
  },
  {
    q: 'How can ranking be commission-blind if you earn commission?',
    a: 'The two are separated structurally rather than by promise. Commission is not part of the data the ordering function receives, so there is no value it could respond to. It is the difference between a rule that is enforced and a rule that is stated.',
  },
  {
    q: 'Do merchants pay to appear higher?',
    a: 'No. There is no paid placement inside results. If sponsored placement is ever introduced it will sit outside the ranked list and be labelled, because a paid position mixed into organic results is indistinguishable from a bribe.',
  },
  {
    q: 'What is actually running today?',
    a: 'The site, and nothing else. There is no merchant feed connected, no catalogue, and no live ranking. Every figure you see on this site is illustrative and labelled. When that changes, this page changes with it.',
  },
];

export default function HowWeRankPage() {
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
            <a href="/#how">How it works</a>
            <a className="active" href="/how-we-rank">
              How we rank
            </a>
          </nav>
          <a className="btn btn-primary" href="/#cta">
            Join the waitlist
          </a>
        </div>
      </header>

      <main>
        {/* 1 — hero */}
        <section className="hero" style={{ borderTop: 0 }}>
          <div className="wrap">
            <span className="pill-eyebrow">
              <span aria-hidden="true">✦</span>
              <p className="eyebrow">Methodology</p>
            </span>
            <h1 className="hero-h1" style={{ maxWidth: '18ch' }}>
              <span className="h1-underlined">How we</span> <em>rank.</em>
            </h1>
            <p className="lede" style={{ marginTop: 24 }}>
              This page is the whole method, written plainly enough to check. It is here for two
              readers: a shopper deciding whether to trust a result, and a reviewer deciding whether
              to trust us. Both deserve the same answer.
            </p>
            <p className="prelaunch" style={{ maxWidth: '58ch' }}>
              <b>Pre-launch.</b> No merchant feed, catalogue, or partnership is connected yet. What
              follows is the rule the product is built to follow — not a description of something
              already running. §7 says exactly what is and is not live.
            </p>
          </div>
        </section>

        {/* 2 — the rule */}
        <section id="rule">
          <div className="wrap">
            <div className="sec-head">
              <p className="eyebrow">01 · The rule</p>
              <h2>One rule, and everything else follows from it.</h2>
            </div>
            <div className="rule-card card">
              <p className="rule-quote">
                Offers are ordered by <b>the total you actually pay</b>. If any required part of
                that total is unknown, the offer is <b>not ranked at all</b>.
              </p>
              <p className="muted">
                The second sentence is the one that costs us something. It means a cheap-looking
                offer can be left out of the comparison entirely, and that a comparison can come
                back shorter than you expected — or empty. We would rather show you less than show
                you a number we cannot stand behind.
              </p>
            </div>
          </div>
        </section>

        {/* 3 — all-in breakdown */}
        <section id="all-in">
          <div className="wrap">
            <div className="sec-head">
              <p className="eyebrow">02 · All-in price</p>
              <h2>What goes into a total.</h2>
              <p>
                An item price is a headline. The all-in price is the sum a merchant will take from
                you. These are the parts, and where each one has to come from.
              </p>
            </div>
            <div className="comp-list">
              {COMPONENTS.map((c) => (
                <div className="comp card" key={c.k}>
                  <h3>{c.k}</h3>
                  <p>{c.v}</p>
                  <p className="comp-src">{c.s}</p>
                </div>
              ))}
            </div>
            <p className="note">
              Tax is the hardest of these and the most often glossed over. In the United States it
              depends on the delivery address, so without one it is not merely unmeasured — it is
              unknowable. We compare pre-tax and label it, rather than inventing a figure that would
              look precise and be wrong.
            </p>
          </div>
        </section>

        {/* 4 — incomplete data */}
        <section id="incomplete">
          <div className="wrap">
            <div className="sec-head">
              <p className="eyebrow">03 · Incomplete data</p>
              <h2>What happens when a cost is missing.</h2>
            </div>
            <div className="flow">
              <div className="flow-step card">
                <span className="flow-n">If</span>
                <p>a required component is missing, ambiguous, or outside the freshness window</p>
              </div>
              <div className="flow-step card">
                <span className="flow-n">Then</span>
                <p>the offer has no all-in price, and is excluded from the comparison</p>
              </div>
              <div className="flow-step card">
                <span className="flow-n">Never</span>
                <p>
                  is it estimated, defaulted to zero, or ranked on item price with the gap hidden
                </p>
              </div>
            </div>
            <p className="note">
              A missing shipping cost is not zero shipping. Treating absent data as a favourable
              value is the single most common way a comparison becomes dishonest, and it is usually
              an accident rather than a decision — which is exactly why the rule is written down.
            </p>
          </div>
        </section>

        {/* 5 — commission-blind */}
        <section id="commission">
          <div className="wrap">
            <div className="sec-head">
              <p className="eyebrow">04 · Commission-blind</p>
              <h2>Commission is not an input.</h2>
              <p>
                We expect to earn an affiliate commission when someone buys through a hand-off link.
                That is how the site is meant to pay for itself, and we would rather say so than let
                you discover it.
              </p>
            </div>
            <div className="blind-grid">
              <div className="card blind">
                <h3>What the ordering function receives</h3>
                <ul className="tick-list">
                  <li>Item price, shipping, mandatory fees</li>
                  <li>Freshness state and the source it came from</li>
                  <li>Availability and item condition</li>
                </ul>
              </div>
              <div className="card blind blind-out">
                <h3>What it never receives</h3>
                <ul className="cross-list">
                  <li>Commission rate or expected payout</li>
                  <li>Merchant bids or placement fees</li>
                  <li>Any commercial relationship at all</li>
                </ul>
              </div>
            </div>
            <p className="note">
              The distinction that matters: commission is absent from the input, not merely ignored
              by the logic. A rule that depends on remembering to ignore something eventually fails.
              And there is no paid placement inside results — if sponsored placement is ever
              introduced, it will sit outside the ranked list and carry a label.
            </p>
          </div>
        </section>

        {/* 6 — freshness */}
        <section id="freshness">
          <div className="wrap">
            <div className="sec-head">
              <p className="eyebrow">05 · Freshness</p>
              <h2>Every offer carries a state.</h2>
              <p>
                A price is a claim about a moment. These are the states an offer can be in, and
                whether it is allowed into a comparison.
              </p>
            </div>
            <div className="fresh-table" role="table" aria-label="Freshness states">
              <div className="fresh-head" role="row">
                <span role="columnheader">State</span>
                <span role="columnheader">Meaning</span>
                <span role="columnheader">In the ranking</span>
              </div>
              {FRESHNESS.map((f) => (
                <div className="fresh-row" role="row" key={f.n}>
                  <span role="cell">
                    <b className={`fstate f-${f.tone}`}>{f.n}</b>
                  </span>
                  <span role="cell">{f.d}</span>
                  <span role="cell" className={`frank fr-${f.tone}`}>
                    {f.rank}
                  </span>
                </div>
              ))}
            </div>
            <p className="note">
              Freshness is only as precise as the source allows. Where a provider timestamps a whole
              catalogue rather than each offer, that is what we can honestly say — a catalogue-level
              time is recorded as such and never presented as the moment a particular price was
              seen.
            </p>
          </div>
        </section>

        {/* 7 — illustrative example */}
        <section id="example">
          <div className="wrap">
            <div className="sec-head">
              <p className="eyebrow">06 · Worked example</p>
              <h2>The rule, applied.</h2>
              <p>
                Nothing below is a real offer. The merchants are placeholders and the figures are
                invented to show the mechanism — which is the only thing this example is for.
              </p>
            </div>
            <div className="demo-panel">
              <div className="dp-glow" aria-hidden="true" />
              <div className="dp-head">
                <div>
                  <b>Same product, three offers</b>
                  <span className="dp-sub">Figures invented to demonstrate the rule</span>
                </div>
                <span className="dp-badge">ILLUSTRATION</span>
              </div>
              <div className="ex-table" role="table" aria-label="Illustrative comparison">
                <div className="ex-head" role="row">
                  <span role="columnheader">Merchant</span>
                  <span role="columnheader">Item</span>
                  <span role="columnheader">Shipping</span>
                  <span role="columnheader">All-in</span>
                  <span role="columnheader">Result</span>
                </div>
                <div className="ex-row" role="row">
                  <span role="cell">Merchant A</span>
                  <span role="cell" className="mono">
                    $340.00
                  </span>
                  <span role="cell" className="mono">
                    $0.00 verified
                  </span>
                  <span role="cell" className="mono ex-win">
                    $340.00
                  </span>
                  <span role="cell">
                    <b className="ex-badge win">Ranked 1st</b>
                  </span>
                </div>
                <div className="ex-row" role="row">
                  <span role="cell">Merchant B</span>
                  <span role="cell" className="mono">
                    $328.00
                  </span>
                  <span role="cell" className="mono">
                    $24.00
                  </span>
                  <span role="cell" className="mono">
                    $352.00
                  </span>
                  <span role="cell">
                    <b className="ex-badge">Ranked 2nd</b>
                  </span>
                </div>
                <div className="ex-row" role="row">
                  <span role="cell">Merchant C</span>
                  <span role="cell" className="mono">
                    $325.00
                  </span>
                  <span role="cell" className="mono ex-unknown">
                    unknown
                  </span>
                  <span role="cell" className="mono ex-unknown">
                    —
                  </span>
                  <span role="cell">
                    <b className="ex-badge out">Not ranked</b>
                  </span>
                </div>
              </div>
              <p className="ex-note">
                Merchant C has the lowest item price and does not appear. Merchant B looks cheapest
                until delivery is counted. Merchant A wins on the only number that reaches your
                account.
              </p>
            </div>
          </div>
        </section>

        {/* 8 — disclosure summary */}
        <section id="disclosure">
          <div className="wrap">
            <div className="sec-head">
              <p className="eyebrow">07 · Money and status</p>
              <h2>How we would be paid, and what is not connected.</h2>
            </div>
            <div className="two-col">
              <div className="card blind">
                <h3>The commercial model</h3>
                <ul className="tick-list">
                  <li>You are handed off to the merchant’s own checkout</li>
                  <li>You pay the merchant directly — we never take custody of money or orders</li>
                  <li>
                    A merchant may pay us a referral commission on a completed purchase, disclosed
                    before you leave
                  </li>
                  <li>That commission is invisible to the ordering function</li>
                </ul>
              </div>
              <div className="card blind blind-out">
                <h3>Not connected today</h3>
                <ul className="cross-list">
                  <li>No merchant feed, catalogue, or product API is live</li>
                  <li>No affiliate partnership is active</li>
                  <li>No live ranking runs — every figure on this site is illustrative</li>
                  <li>No shopper has used the product, because it is not open yet</li>
                </ul>
              </div>
            </div>
            <p className="note">
              This section will read differently once something is connected. Until then it says the
              plain thing, because a methodology page that overstates its own status has already
              broken the rule it is describing.
            </p>
          </div>
        </section>

        {/* 9 — FAQ */}
        <section id="faq">
          <div className="wrap">
            <div className="sec-head">
              <p className="eyebrow">08 · Questions</p>
              <h2>The awkward ones.</h2>
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

        {/* 10 — CTA */}
        <section id="cta" style={{ borderTop: 0 }}>
          <div className="wrap">
            <div className="cta-final">
              <h2>Hold us to this page.</h2>
              <p>
                It is written to be checkable. If a result on this site ever contradicts what is
                described here, the result is wrong — not the rule.
              </p>
              <div className="hero-cta" style={{ justifyContent: 'center', marginTop: 28 }}>
                <a className="btn btn-primary" href="/#cta">
                  Join the waitlist →
                </a>
                <a className="btn btn-ghost" href="/">
                  Back to home
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
            <span className="mono">Illustrative figures · pre-launch · nothing connected yet</span>
          </div>
        </div>
      </footer>
    </>
  );
}
