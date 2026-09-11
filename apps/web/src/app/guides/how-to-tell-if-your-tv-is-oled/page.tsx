import type { Metadata } from 'next';

import { SiteFooter } from '@/components/SiteFooter';

/*
 * /guides/how-to-tell-if-your-tv-is-oled — identification, not purchasing.
 *
 * WHY THIS PAGE EXISTS, AND WHY IT IS NOT /guides/oled-tv. Search Console shows
 * several real query variants for this intent — "how to know if your tv is
 * oled", "how do i know if my tv is oled", "how to know if a tv is oled" —
 * and none of them are buying questions. The reader already has a screen in
 * front of them. The existing OLED guide answers "which should I buy", which is
 * a different person with a different problem, so this is a separate page
 * rather than a section bolted onto that one.
 *
 * TRUTH RULE FOR THIS FILE: method over assertion. The one brand-specific claim
 * made here — that LG puts "OLED" at the start of its OLED model numbers — was
 * checked against lg.com/us/oled-tvs on 8 September 2026, where the listed sets
 * include OLED77C5PUA, OLED77B3PUA and OLED77M5PUA. Every other naming
 * convention is left to the manufacturer's own specification page rather than
 * asserted here, because naming schemes change yearly and a confident wrong
 * answer is worse than teaching the lookup.
 *
 * No prices, no models recommended, no merchants, no affiliate links. This page
 * answers a question and stops.
 */

const BASE = 'https://honesttotal.com';

export const metadata: Metadata = {
  title: 'How to tell if your TV is OLED — HonestTotal',
  description:
    'The reliable way to identify an OLED television: find the exact model number and check the manufacturer’s specification. Why QLED is not OLED, and why the picture alone cannot prove it.',
  alternates: { canonical: '/guides/how-to-tell-if-your-tv-is-oled' },
  openGraph: {
    type: 'article',
    url: `${BASE}/guides/how-to-tell-if-your-tv-is-oled`,
    title: 'Is your TV actually OLED?',
    description:
      'One reliable method, several unreliable ones, and the naming confusion that causes most wrong answers.',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Is your TV actually OLED?',
    description: 'Find the model number, check the specification. Everything else is a hint.',
  },
};

/** Where the model number physically lives. Generic on purpose — see file header. */
const WHERE = [
  {
    k: 'The label on the back or side',
    v: 'A printed sticker carrying the model number, serial number and power rating. This is the most dependable place because it cannot be changed by a software update, and it is what the manufacturer’s support team will ask you for.',
  },
  {
    k: 'The settings menu',
    v: 'Most televisions list the model somewhere under Support, System, About, or a similarly named screen. The exact path differs by brand and by software version, so look for those words rather than following a memorised route — menu layouts get rearranged with firmware updates.',
  },
  {
    k: 'The box, manual or receipt',
    v: 'The full model number is normally printed on the carton and on the first page of the manual. If you still have the purchase record, that usually carries it too.',
  },
];

/** What the specification page actually has to say for the answer to be yes. */
const SPEC_WORDS = [
  'A panel or display-type line reading OLED, WOLED or QD-OLED',
  'A description of pixels that emit their own light, or self-lit pixels',
  'The absence of any backlight specification — an OLED has no backlight to describe',
  'Wording such as LED, Mini-LED, QLED, Neo QLED, backlight or local dimming, all of which point away from OLED',
];

/** The names that cause most wrong answers. */
const NAMES = [
  {
    k: 'QLED',
    v: 'An LCD television with a quantum-dot layer that improves colour, lit from behind by a backlight. The name rhymes with OLED and shares three letters, which is very nearly the whole reason for the confusion. It is not an OLED and does not have per-pixel light.',
    tone: 'warn',
  },
  {
    k: 'LED / LED-LCD',
    v: 'An LCD panel with an LED backlight — the ordinary flat television of the last fifteen years. The LED in the name describes the lamp behind the picture, not the pixels making it.',
    tone: 'muted',
  },
  {
    k: 'Mini-LED / Neo QLED',
    v: 'Still an LCD, but with a backlight divided into many small zones that can dim independently. It gets closer to OLED-like contrast than older LCDs, which is exactly why it defeats the eyeball test described below.',
    tone: 'warn',
  },
  {
    k: 'OLED / WOLED / QD-OLED',
    v: 'These are the OLED family. Each pixel emits its own light and switches off completely for black. WOLED and QD-OLED differ in how colour is produced, but both are genuinely OLED.',
    tone: 'ok',
  },
];

/** Visual clues — real, but not proof. */
const CLUES = [
  {
    k: 'Black bars that disappear',
    v: 'In a dark room, the letterbox bars on a film look like part of the bezel rather than dark grey stripes. An OLED switches those pixels off entirely.',
  },
  {
    k: 'No halo around bright objects',
    v: 'White subtitles or a bright moon on a black sky show no glow bleeding into the darkness around them. On most LCDs some light escapes from neighbouring backlight zones.',
  },
  {
    k: 'It holds up from the side',
    v: 'Contrast and colour stay close to correct when you walk past the screen instead of washing out. LCDs vary a lot here, and some are very good, so this is the weakest of the three.',
  },
];

const CHECKLIST = [
  'Find the exact model number — back label first, settings screen second',
  'Type that model number into the manufacturer’s own site, not a search engine result page',
  'Look on the specification tab for a panel or display type line',
  'Accept OLED, WOLED or QD-OLED as yes',
  'Treat QLED, Neo QLED, Mini-LED, LED or any mention of a backlight as no',
  'If the specification page is silent, check the manual or ask the manufacturer’s support — do not settle it by eye',
];

const FAQ = [
  {
    q: 'Is QLED the same as OLED?',
    a: 'No, and this is the single most common mix-up. A QLED is an LCD television with a quantum-dot layer for better colour, lit by a backlight behind the panel. An OLED has no backlight at all — each pixel makes its own light and switches off for black. The names look alike; the displays work differently.',
  },
  {
    q: 'Can I identify OLED by the black levels alone?',
    a: 'Not reliably any more. Perfect blacks used to be a giveaway, but a good Mini-LED backlight with many dimming zones reproduces most dark scenes convincingly enough that the difference is a judgement call rather than an observation. Black level is a strong hint and a weak proof.',
  },
  {
    q: 'Do all LG, Sony and Samsung televisions use OLED panels?',
    a: 'No. All three sell OLED and LCD televisions side by side, often in the same year and the same showroom. The brand tells you nothing about the panel — only the specific model does.',
  },
  {
    q: 'Can the model number itself confirm the panel type?',
    a: 'Sometimes directly. LG, for instance, begins its OLED model numbers with the letters OLED — the sets listed on its own site include OLED77C5PUA and OLED77B3PUA. Other manufacturers use series letters that carry no obvious meaning, so treat the model number as the key that unlocks the specification page rather than as the answer itself.',
  },
  {
    q: 'What if the television is too old to find online?',
    a: 'Work backwards. The printed label on the back gives the model and often the year; the manual usually states the display technology in its specification table; and manufacturer support lines can look up discontinued models. If a set is old enough that none of this is findable, it very likely predates consumer OLED televisions altogether.',
  },
];

const BREADCRUMB_LD = {
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: [
    // Two levels, matching /guides/oled-tv: there is no /guides index page, so a
    // third crumb would point nowhere.
    { '@type': 'ListItem', position: 1, name: 'Home', item: `${BASE}/` },
    {
      '@type': 'ListItem',
      position: 2,
      name: 'How to tell if your TV is OLED',
      item: `${BASE}/guides/how-to-tell-if-your-tv-is-oled`,
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

export default function TellIfOledPage() {
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
            <a href="/guides/oled-tv">OLED</a>
            <a className="active" href="/guides/how-to-tell-if-your-tv-is-oled">
              Identify
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
                <span aria-current="page">How to tell if your TV is OLED</span>
              </li>
            </ol>
          </nav>
        </div>

        {/* 1 — hero: answer first */}
        <section className="hero" style={{ borderTop: 0 }}>
          <div className="wrap">
            <span className="pill-eyebrow">
              <span aria-hidden="true">✦</span>
              <p className="eyebrow">Explainer · identifying a panel</p>
            </span>
            <h1 className="hero-h1" style={{ maxWidth: '22ch' }}>
              <span className="h1-underlined">How to tell</span> <em>if your TV is</em> OLED.
            </h1>
            <p className="lede" style={{ marginTop: 24 }}>
              There is one reliable answer: find the exact model number, then look it up on the
              manufacturer’s own specification page. If the panel line says OLED, WOLED or QD-OLED,
              it is an OLED. If it mentions a backlight, LED, Mini-LED or QLED, it is not.
            </p>
            <p className="lede">
              Everything else — how black the blacks look, how thin the panel is, how it holds up
              from an angle — is a hint. Good hints, but modern LCDs imitate all three convincingly
              enough that the picture alone cannot settle it.
            </p>
            <p className="prelaunch" style={{ maxWidth: '58ch' }}>
              <b>This page is about identifying a set you already have or are standing in front
              of.</b>{' '}
              If you are choosing a new one, the{' '}
              <a href="/guides/oled-tv">OLED buying guide</a> is the other half of the subject.
            </p>
          </div>
        </section>

        {/* 2 — the model number */}
        <section id="model-number">
          <div className="wrap">
            <div className="sec-head">
              <p className="eyebrow">01 · The reliable method</p>
              <h2>Start with the exact model number.</h2>
              <p>
                Not the series name, not the marketing name on the box — the full alphanumeric
                string, every character of it.
              </p>
            </div>
            <div className="card rule-card">
              <p className="rule-quote">
                A television’s model number is the only thing that ties the screen in your room to a
                specification the manufacturer will stand behind.
              </p>
              <p className="muted">
                Two sets from the same brand, the same year and the same size can use different
                panel technologies, and the names in the shop rarely make that obvious. One extra
                letter is often the whole difference, which is why partial model numbers produce
                confident wrong answers.
              </p>
            </div>
            <div className="comp-list" style={{ marginTop: 28 }}>
              {WHERE.map((w) => (
                <div className="comp card" key={w.k}>
                  <h3>{w.k}</h3>
                  <p>{w.v}</p>
                </div>
              ))}
            </div>
            <p className="note">
              If the sticker has faded — they often do on sets mounted near a window — the settings
              screen and the manual are the fallbacks, and either is better than guessing from the
              picture.
            </p>
          </div>
        </section>

        {/* 3 — the specification page */}
        <section id="specification">
          <div className="wrap">
            <div className="sec-head">
              <p className="eyebrow">02 · What to look for</p>
              <h2>Read the specification, not the sales page.</h2>
              <p>
                Enter the model number on the manufacturer’s own site and open the full
                specification tab. Retailer listings are often abbreviated or simply wrong.
              </p>
            </div>
            <div className="card blind" style={{ maxWidth: 760 }}>
              <h3>Terms that settle it</h3>
              <ul className="tick-list">
                {SPEC_WORDS.map((s) => (
                  <li key={s}>{s}</li>
                ))}
              </ul>
            </div>
            <p className="note">
              The absence of a backlight specification is a genuinely useful signal. Every LCD has a
              backlight and manufacturers describe it, because it is a selling point. An OLED has
              nothing to describe there, so the row is missing rather than empty.
            </p>
          </div>
        </section>

        {/* 4 — naming confusion */}
        <section id="names">
          <div className="wrap">
            <div className="sec-head">
              <p className="eyebrow">03 · The names that mislead</p>
              <h2>QLED is not OLED.</h2>
              <p>
                Most wrong answers to this question come from four letters arranged similarly. Here
                is what each name actually describes.
              </p>
            </div>
            <div className="fresh-table" role="table" aria-label="Display technology names">
              <div className="fresh-head" role="row">
                <span role="columnheader">Name</span>
                <span role="columnheader">What it actually is</span>
                <span role="columnheader" />
              </div>
              {NAMES.map((n) => (
                <div className="fresh-row" role="row" key={n.k}>
                  <span role="cell">
                    <b className={`fstate f-${n.tone}`}>{n.k}</b>
                  </span>
                  <span role="cell">{n.v}</span>
                  <span role="cell" />
                </div>
              ))}
            </div>
            <p className="note">
              The distinction that matters is not the branding but where the light comes from. In an
              OLED the pixel is the lamp. In everything else on this list there is a separate
              backlight, and the pixels are shutters in front of it.
            </p>
          </div>
        </section>

        {/* 5 — the eyeball test */}
        <section id="by-eye">
          <div className="wrap">
            <div className="sec-head">
              <p className="eyebrow">04 · Can you just look at it?</p>
              <h2>Three real clues, none of them proof.</h2>
              <p>
                These are genuinely characteristic of OLED. They are also increasingly imitable, so
                treat them as evidence pointing somewhere rather than as an answer.
              </p>
            </div>
            <div className="comp-list">
              {CLUES.map((c) => (
                <div className="comp card" key={c.k}>
                  <h3>{c.k}</h3>
                  <p>{c.v}</p>
                </div>
              ))}
            </div>
            <div className="card rule-card" style={{ marginTop: 28 }}>
              <p className="rule-quote">
                A Mini-LED backlight with hundreds of dimming zones can reproduce most of what is
                described above. <b>Seeing these signs makes OLED likely, not certain.</b>
              </p>
              <p className="muted">
                A showroom makes it worse, not better. Sets there run in their brightest mode under
                lighting chosen to flatter them, and the demo footage is picked to hide each
                technology’s weaknesses. If the answer matters — for a warranty claim, a resale
                listing, or deciding whether burn-in advice applies to you — check the
                specification.
              </p>
            </div>
          </div>
        </section>

        {/* 6 — fallbacks */}
        <section id="unclear">
          <div className="wrap">
            <div className="sec-head">
              <p className="eyebrow">05 · When the page is unclear</p>
              <h2>If the specification does not say.</h2>
            </div>
            <div className="card blind" style={{ maxWidth: 760 }}>
              <h3>In order of reliability</h3>
              <ul className="tick-list">
                <li>
                  Check the PDF manual for that model — specification tables in manuals are usually
                  more complete than the product page
                </li>
                <li>
                  Search the manufacturer’s support site by model number rather than the main
                  storefront, which drops discontinued sets
                </li>
                <li>
                  Ask the manufacturer’s support line directly with the model number in hand; panel
                  type is a routine question they can answer
                </li>
                <li>
                  Check whether the model was sold in a region other than yours — the same panel is
                  sometimes sold under a different suffix elsewhere
                </li>
              </ul>
            </div>
            <p className="note">
              What not to do: settle it from a forum post, a marketplace listing, or a review that
              names a series rather than a model. Series names get reused across panel types between
              years, which is precisely how the confusion spreads.
            </p>
          </div>
        </section>

        {/* 7 — checklist */}
        <section id="checklist">
          <div className="wrap">
            <div className="sec-head">
              <p className="eyebrow">06 · The short version</p>
              <h2>Six steps, about two minutes.</h2>
            </div>
            <div className="card blind" style={{ maxWidth: 760 }}>
              <h3>Quick checklist</h3>
              <ul className="tick-list">
                {CHECKLIST.map((c) => (
                  <li key={c}>{c}</li>
                ))}
              </ul>
            </div>
            <p className="note">
              If you now know it is an OLED and want to understand what that means for burn-in,
              brightness and room lighting, that is covered in the{' '}
              <a href="/guides/oled-tv">OLED guide</a>.
            </p>
          </div>
        </section>

        {/* 8 — FAQ */}
        <section id="faq">
          <div className="wrap">
            <div className="sec-head">
              <p className="eyebrow">07 · Questions</p>
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

        {/* 9 — CTA */}
        <section id="cta" style={{ borderTop: 0 }}>
          <div className="wrap">
            <div className="cta-final">
              <h2>Answers first, comparisons when the data is real.</h2>
              <p>
                This page sells nothing and recommends no model. When live offers exist they will be
                ranked by the published method — totals, commission-blind, nothing unverified.
              </p>
              <div className="hero-cta" style={{ justifyContent: 'center', marginTop: 28 }}>
                <a className="btn btn-primary" href="/guides/oled-tv">
                  Choosing an OLED instead? →
                </a>
                <a className="btn btn-ghost" href="/how-we-rank">
                  Read how we rank
                </a>
              </div>
            </div>
          </div>
        </section>
      </main>

      <SiteFooter note={<>No models endorsed · no prices quoted · pre-launch</>} />
    </>
  );
}
