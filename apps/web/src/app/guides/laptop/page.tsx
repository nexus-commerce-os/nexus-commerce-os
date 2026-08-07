import type { Metadata } from 'next';

import { SiteFooter } from '@/components/SiteFooter';

/*
 * /guides/laptop — evergreen explainer.
 *
 * TRUTH RULE FOR THIS FILE: category knowledge only. No prices, no model
 * names, no manufacturer comparisons, no "best" list. Explaining that the same
 * chip performs differently in different chassis is how thermals work; naming
 * which company cools better would be a product claim we cannot substantiate.
 */

const BASE = 'https://honesttotal.com';

export const metadata: Metadata = {
  title: 'How to choose a laptop — HonestTotal',
  description:
    'A laptop guide that starts with the chassis, not the chip: why the same processor performs differently in different machines, why "up to 20 hours" is not a battery figure, and which specs you can never upgrade later.',
  alternates: { canonical: '/guides/laptop' },
  openGraph: {
    type: 'article',
    url: `${BASE}/guides/laptop`,
    title: 'The chip on the sticker is not the machine.',
    description:
      'Why identical processors perform differently, what a watt-hour tells you that "up to 20 hours" does not, and which decisions are permanent.',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'The chip on the sticker is not the machine.',
    description: 'Thermals, battery honesty, and the parts you can never change later.',
  },
};

/** The decisions ranked by how hard they are to undo. */
const PERMANENCE = [
  {
    n: 'Screen',
    d: 'Never changes. Brightness, panel type and resolution are the machine you look at for years. A dim screen cannot be fixed by anything you buy afterwards.',
    state: 'Permanent',
    tone: 'warn',
  },
  {
    n: 'Keyboard and trackpad',
    d: 'Never changes, and you touch them every minute. Layout, key travel and trackpad quality are the least specified and most felt parts of any laptop.',
    state: 'Permanent',
    tone: 'warn',
  },
  {
    n: 'Chassis and cooling',
    d: 'Never changes, and it decides what the processor is actually allowed to do. This is why the same chip is fast in one machine and mediocre in another.',
    state: 'Permanent',
    tone: 'warn',
  },
  {
    n: 'Memory',
    d: 'Frequently soldered now. If it is soldered, the amount you buy is the amount you have for the machine’s life — so it is worth checking before, not after.',
    state: 'Usually permanent',
    tone: 'warn',
  },
  {
    n: 'Storage',
    d: 'Often the one part still replaceable, and the one most often oversold at purchase. Buying the smaller drive and upgrading later is sometimes the cheaper path — if the machine allows it.',
    state: 'Sometimes upgradeable',
    tone: 'ok',
  },
];

/** Where spec sheets mislead. */
const MISLEADING = [
  {
    k: '“Up to 20 hours” of battery',
    v: 'Measured playing a local video at low brightness with the radios idle. The honest number is the battery capacity in watt-hours, next to what the machine draws doing your work. Two laptops with the same quoted hours can differ enormously in practice.',
  },
  {
    k: 'The processor name',
    v: 'The same chip appears in thin machines that throttle within minutes and thicker ones that sustain full power. A model number tells you the ceiling, not what the cooling will let it hold.',
  },
  {
    k: 'The graphics chip name',
    v: 'Mobile GPUs run at power limits set by the manufacturer, and the same part can be configured across a wide range. Without the power figure, the name alone does not tell you how it will perform.',
  },
  {
    k: '“Retina”, “4K”, and other resolution words',
    v: 'A high-resolution panel costs battery and often brings no visible benefit at laptop viewing distances. Brightness and colour accuracy usually matter more, and are quoted less often.',
  },
];

const JUDGING = [
  'Start from what you will actually run, not from a budget — the requirements for writing and for video editing barely overlap',
  'Look up the battery in watt-hours rather than quoted hours, and compare like with like',
  'Check whether memory is soldered, and whether storage can be replaced, before deciding capacities',
  'Find out the sustained power the chassis allows, not just the chip name — reviews that run a long load tell you this',
  'Type on it if you possibly can; the keyboard is the specification you will notice every day and cannot change',
  'Check screen brightness in nits if you will ever work near a window',
  'Look for a service manual and spare-part availability — repairability is a specification that only matters after something goes wrong',
];

const FAQ = [
  {
    q: 'How much memory do I actually need?',
    a: 'For browsing, documents and video calls, 16 GB is a comfortable floor today and will age better than 8. Heavy virtualisation, large datasets or professional creative work push higher. The critical question is whether it is soldered — if it is, buy for the machine’s whole life rather than for this month.',
  },
  {
    q: 'Is a more expensive laptop faster?',
    a: 'Often it is better cooled, better built and better screened rather than faster in a benchmark. Past a point, extra money buys sustained performance, a nicer display and a keyboard you enjoy — which is usually the better purchase, just not the one a spec comparison shows.',
  },
  {
    q: 'Do I need a dedicated graphics card?',
    a: 'For gaming and GPU-accelerated creative work, yes. For everything else, integrated graphics have been sufficient for years, and a dedicated GPU costs battery life, weight and heat. It is the clearest example of a specification worth skipping if the use case is not there.',
  },
  {
    q: 'Why does my laptop slow down after a few minutes?',
    a: 'Thermal throttling. The chip runs fast until the chassis cannot remove the heat, then drops to a level it can sustain. This is normal engineering, not a defect — and it is exactly why the chassis matters more than the chip name.',
  },
  {
    q: 'Is it worth waiting for the next generation?',
    a: 'There is always a next generation, and year-over-year gains in this category are usually modest relative to the wait. Buying when you need it, at a specification that will still be adequate in three years, beats timing a release cycle.',
  },
  {
    q: 'Which laptop should I buy?',
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
      name: 'How to choose a laptop',
      item: `${BASE}/guides/laptop`,
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

export default function LaptopGuidePage() {
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
          <a className="brand" href="/" aria-label="HonestTotal home">
            <span className="mk" aria-hidden="true" />
            HonestTotal
          </a>
          <nav className="nav-links">
            <a href="/">Home</a>
            <a href="/guides/ssd">SSDs</a>
            <a className="active" href="/guides/laptop">
              Laptops
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
                <span aria-current="page">How to choose a laptop</span>
              </li>
            </ol>
          </nav>
        </div>

        <section className="hero" style={{ borderTop: 0 }}>
          <div className="wrap">
            <span className="pill-eyebrow">
              <span aria-hidden="true">✦</span>
              <p className="eyebrow">Buying guide · laptops</p>
            </span>
            <h1 className="hero-h1" style={{ maxWidth: '22ch' }}>
              <span className="h1-underlined">The chip</span> <em>is not the machine.</em>
            </h1>
            <p className="lede" style={{ marginTop: 24 }}>
              Two laptops with the same processor can perform very differently, because the chassis
              decides how much of that processor you are allowed to use. This guide starts with the
              parts you can never change and works towards the ones you can.
            </p>
            <p className="prelaunch" style={{ maxWidth: '58ch' }}>
              <b>No models named, no prices quoted, no manufacturer declared best.</b> This is
              category knowledge — checkable anywhere, owned by no brand.
            </p>
          </div>
        </section>

        <section id="permanence">
          <div className="wrap">
            <div className="sec-head">
              <p className="eyebrow">01 · What you cannot undo</p>
              <h2>Decide these first.</h2>
              <p>
                A useful ordering: spend attention in proportion to how permanent the decision is,
                rather than to how prominent it is on the product page.
              </p>
            </div>
            <div className="fresh-table" role="table" aria-label="How permanent each decision is">
              <div className="fresh-head" role="row">
                <span role="columnheader">Part</span>
                <span role="columnheader">Why it matters</span>
                <span role="columnheader">Changeable?</span>
              </div>
              {PERMANENCE.map((p) => (
                <div className="fresh-row" role="row" key={p.n}>
                  <span role="cell">
                    <b className={`fstate f-${p.tone}`}>{p.n}</b>
                  </span>
                  <span role="cell">{p.d}</span>
                  <span role="cell" className={`frank fr-${p.tone}`}>
                    {p.state}
                  </span>
                </div>
              ))}
            </div>
            <p className="note">
              Notice what is missing from the top of this table: the processor. It is the most
              advertised component and, within a given class, rarely the thing that decides whether
              you enjoy the machine.
            </p>
          </div>
        </section>

        <section id="misleading">
          <div className="wrap">
            <div className="sec-head">
              <p className="eyebrow">02 · Where the spec sheet misleads</p>
              <h2>Four numbers that mean less than they look.</h2>
            </div>
            <div className="comp-list">
              {MISLEADING.map((m) => (
                <div className="comp card" key={m.k}>
                  <h3>{m.k}</h3>
                  <p>{m.v}</p>
                </div>
              ))}
            </div>
            <p className="note">
              None of these figures is false. They are measured under conditions chosen to flatter,
              which is a different problem and a harder one to spot — the number is real, the
              implication is not.
            </p>
          </div>
        </section>

        <section id="judging">
          <div className="wrap">
            <div className="sec-head">
              <p className="eyebrow">03 · Before you buy</p>
              <h2>Seven checks worth the time.</h2>
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
              <p className="eyebrow">04 · Questions</p>
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

      <SiteFooter note={<>No prices quoted · no models endorsed · pre-launch</>} />
    </>
  );
}
