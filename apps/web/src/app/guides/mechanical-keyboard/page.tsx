import type { Metadata } from 'next';

/*
 * /guides/mechanical-keyboard — evergreen explainer.
 *
 * TRUTH RULE FOR THIS FILE: category knowledge only. Switch families, mounting
 * styles and keycap plastics are how the products are built; naming a "best"
 * switch or brand would be a preference stated as a fact, and this category is
 * unusually prone to exactly that. No prices, no models, no rankings.
 */

const BASE = 'https://honesttotal.com';

export const metadata: Metadata = {
  title: 'How to choose a mechanical keyboard — Honest Total',
  description:
    'Switches are the famous decision and rarely the one you notice most. Stabilisers, mounting style, keycap plastic and layout explained — plus why polling-rate marketing is mostly noise.',
  alternates: { canonical: '/guides/mechanical-keyboard' },
  openGraph: {
    type: 'article',
    url: `${BASE}/guides/mechanical-keyboard`,
    title: 'Switches get the attention. Stabilisers decide the experience.',
    description:
      'What actually separates keyboards: stabiliser quality, mounting style, keycap plastic and layout — and why the famous decision is the least permanent one.',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Switches get the attention. Stabilisers decide the experience.',
    description: 'The parts nobody advertises are the ones you notice every day.',
  },
};

/** The three switch families, described by behaviour rather than colour. */
const SWITCHES = [
  {
    k: 'Linear',
    v: 'Smooth all the way down with no bump. Popular for gaming because nothing interrupts the press, and often preferred by people who bottom out anyway. Quiet relative to clicky, though the sound depends far more on the case than the switch.',
  },
  {
    k: 'Tactile',
    v: 'A bump partway down telling you the key has registered. Many typists prefer this because it allows lighter, more accurate keypresses without pressing every key to the floor. Bump size and position vary enormously within the category.',
  },
  {
    k: 'Clicky',
    v: 'A tactile bump plus a deliberate click mechanism. Satisfying to some, genuinely disruptive to anyone sharing a room. The loudest decision in the category, and the one most often regretted in an office.',
  },
];

/** What actually separates a good board from an average one. */
const WHAT_MATTERS = [
  {
    n: 'Stabilisers',
    d: 'The mechanisms under long keys — space, shift, enter. Bad ones rattle and sound hollow, and they are what makes a keyboard feel cheap even when the switches are excellent. Almost never mentioned on a product page.',
    state: 'Decides the feel',
    tone: 'ok',
  },
  {
    n: 'Mounting style',
    d: 'How the plate attaches to the case — gasket, top-mount, tray-mount. It changes flex and sound more than any switch swap will. This is where the money in enthusiast boards actually goes.',
    state: 'Decides the sound',
    tone: 'ok',
  },
  {
    n: 'Keycap plastic',
    d: 'PBT resists the shine that ABS develops with use, and the legend printing method decides whether the letters survive. A board can be excellent and still look worn within a year on this alone.',
    state: 'Decides how it ages',
    tone: 'warn',
  },
  {
    n: 'Switches',
    d: 'The famous choice, and on a hot-swap board the easiest one to change later. Worth thinking about — but it is the reversible decision, which is exactly why it should not dominate the others.',
    state: 'Often reversible',
    tone: 'muted',
  },
];

/** Layout, in plain terms. */
const LAYOUTS = [
  {
    k: 'Full size',
    v: 'Everything, including the number pad. The right answer for anyone entering figures all day, and the widest — which pushes your mouse further from your body.',
  },
  {
    k: 'Tenkeyless',
    v: 'Full layout minus the number pad. The common compromise: nothing unfamiliar is missing, and the mouse comes back into a more natural position.',
  },
  {
    k: '75% and 65%',
    v: 'Arrow keys retained, function row shrunk or dropped, everything tightened up. Compact without losing the keys most people use unconsciously.',
  },
  {
    k: '60% and smaller',
    v: 'No arrows, no function row — those move onto a layer accessed with a modifier. Excellent once learned, genuinely awkward for the first fortnight, and worth being honest with yourself about.',
  },
];

const JUDGING = [
  'Try switches before committing if you can — a cheap switch tester answers a question no review can',
  'Prefer hot-swap sockets: they turn the switch decision from permanent into an afternoon',
  'Listen to a sound test of the exact board rather than the switch alone — the case dominates the result',
  'Check whether stabilisers come lubricated and tuned, or whether that is a job waiting for you',
  'Look for PBT keycaps and a durable legend printing method if the board will see years of use',
  'Check the software: whether remapping needs a proprietary app, and whether settings live on the board itself',
  'Be realistic about layout — the compact board that looks elegant may cost you a fortnight of accuracy',
];

const FAQ = [
  {
    q: 'Are mechanical keyboards actually better for typing?',
    a: 'Better is doing a lot of work in that sentence. They are more consistent, more repairable and far more customisable, and many people type more comfortably on them. They are also heavier, louder and more expensive. If a membrane keyboard is not bothering you, that is a legitimate position.',
  },
  {
    q: 'Which switch should I get?',
    a: 'The honest answer is that it depends on how you type and nobody can tell from the outside — which is why switch testers exist and why hot-swap sockets are worth more than any specific recommendation. If you must guess, tactile suits typists and linear suits gaming, with enormous individual exceptions.',
  },
  {
    q: 'Does polling rate matter?',
    a: 'Above 1000 Hz it is mostly marketing. The difference between 1 ms and 0.125 ms of input latency is far below what the rest of the chain — display, game engine, your reaction time — contributes. It is a number that improves without the experience changing.',
  },
  {
    q: 'Why do two boards with the same switches sound completely different?',
    a: 'Because the case, plate, mounting style and any internal foam shape the sound far more than the switch does. This is the single most counter-intuitive thing in the category, and the reason sound tests of a specific board are worth more than switch reviews.',
  },
  {
    q: 'Is wireless worth it?',
    a: 'For a keyboard that stays on one desk, wireless mainly buys a tidier cable run. Modern low-latency wireless is genuinely fine for most gaming, but it adds battery management and a small ongoing cost. Convenience, rather than performance, is the honest case for it.',
  },
  {
    q: 'Which keyboard should I buy?',
    a: 'We are not answering that, deliberately. Ranking requires data we can verify, and we have no connected data source. This guide gives you the questions; comparisons will follow the published method when real offer data exists.',
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
      name: 'How to choose a mechanical keyboard',
      item: `${BASE}/guides/mechanical-keyboard`,
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

export default function KeyboardGuidePage() {
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
            <a href="/guides/laptop">Laptops</a>
            <a className="active" href="/guides/mechanical-keyboard">
              Keyboards
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
                <span aria-current="page">How to choose a mechanical keyboard</span>
              </li>
            </ol>
          </nav>
        </div>

        <section className="hero" style={{ borderTop: 0 }}>
          <div className="wrap">
            <span className="pill-eyebrow">
              <span aria-hidden="true">✦</span>
              <p className="eyebrow">Buying guide · mechanical keyboards</p>
            </span>
            <h1 className="hero-h1" style={{ maxWidth: '22ch' }}>
              <span className="h1-underlined">Switches get</span>{' '}
              <em>the attention. Stabilisers decide it.</em>
            </h1>
            <p className="lede" style={{ marginTop: 24 }}>
              Every discussion in this category starts with switch colours, and switches are the one
              decision you can often reverse in an afternoon. The parts that are permanent are
              barely advertised at all.
            </p>
            <p className="prelaunch" style={{ maxWidth: '58ch' }}>
              <b>No models named, no prices quoted, no switch declared best.</b> This category is
              unusually prone to stating preference as fact, so this guide describes behaviour and
              lets you decide.
            </p>
          </div>
        </section>

        <section id="switches">
          <div className="wrap">
            <div className="sec-head">
              <p className="eyebrow">01 · Switch families</p>
              <h2>Three behaviours, endless variations.</h2>
              <p>
                Described by what they do rather than by colour, since colours are not standardised
                between manufacturers.
              </p>
            </div>
            <div className="comp-list">
              {SWITCHES.map((s) => (
                <div className="comp card" key={s.k}>
                  <h3>{s.k}</h3>
                  <p>{s.v}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="matters">
          <div className="wrap">
            <div className="sec-head">
              <p className="eyebrow">02 · What actually separates boards</p>
              <h2>Roughly the inverse of what gets discussed.</h2>
            </div>
            <div className="fresh-table" role="table" aria-label="What separates keyboards">
              <div className="fresh-head" role="row">
                <span role="columnheader">Component</span>
                <span role="columnheader">Why it matters</span>
                <span role="columnheader">Effect</span>
              </div>
              {WHAT_MATTERS.map((w) => (
                <div className="fresh-row" role="row" key={w.n}>
                  <span role="cell">
                    <b className={`fstate f-${w.tone}`}>{w.n}</b>
                  </span>
                  <span role="cell">{w.d}</span>
                  <span role="cell" className={`frank fr-${w.tone}`}>
                    {w.state}
                  </span>
                </div>
              ))}
            </div>
            <p className="note">
              A rattling space bar will bother you every day and appears on no specification sheet.
              A switch you dislike, on a hot-swap board, is a twenty-minute fix. That asymmetry is
              the most useful thing to take from this page.
            </p>
          </div>
        </section>

        <section id="layouts">
          <div className="wrap">
            <div className="sec-head">
              <p className="eyebrow">03 · Layout</p>
              <h2>How much keyboard do you want to relearn?</h2>
            </div>
            <div className="comp-list">
              {LAYOUTS.map((l) => (
                <div className="comp card" key={l.k}>
                  <h3>{l.k}</h3>
                  <p>{l.v}</p>
                </div>
              ))}
            </div>
            <p className="note">
              Compact boards are genuinely excellent once the layers are in your fingers. The cost
              is paid in the first two weeks, and it is a real cost — worth accepting deliberately
              rather than discovering.
            </p>
          </div>
        </section>

        <section id="judging">
          <div className="wrap">
            <div className="sec-head">
              <p className="eyebrow">04 · Before you buy</p>
              <h2>Seven checks that beat the switch debate.</h2>
            </div>
            <div className="card blind" style={{ maxWidth: 760 }}>
              <h3>In roughly this order</h3>
              <ul className="tick-list">
                {JUDGING.map((j) => (
                  <li key={j}>{j}</li>
                ))}
              </ul>
            </div>
          </div>
        </section>

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

        <section id="cta" style={{ borderTop: 0 }}>
          <div className="wrap">
            <div className="cta-final">
              <h2>Questions now, comparisons when the data is real.</h2>
              <p>
                When live offers exist they will be ranked by the published method — totals,
                commission-blind, nothing unverified.
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
