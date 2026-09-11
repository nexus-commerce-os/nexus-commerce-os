import type { Metadata } from 'next';

import { SiteFooter } from '@/components/SiteFooter';

/*
 * /guides/oled-tv — evergreen explainer.
 *
 * TRUTH RULE FOR THIS FILE: category knowledge only. No prices, no merchants,
 * no model names, no "best" list, and no brand comparisons — describing how
 * WOLED and QD-OLED are constructed is physics; saying which manufacturer does
 * it better would be a product claim we cannot substantiate and are not here to
 * make. Everything stated is checkable against how OLED displays work in
 * general, not against any particular television.
 *
 * This guide carries the breadcrumb + JSON-LD that the two earlier guides
 * predate. Retrofitting those is a separate, deliberate change rather than a
 * silent edit to pages already reviewed and shipped.
 */

const BASE = 'https://honesttotal.com';

export const metadata: Metadata = {
  title: 'How to choose an OLED TV — HonestTotal',
  description:
    'OLED explained without marketing: why the blacks are real, what burn-in actually is, why "peak brightness" numbers mislead, how WOLED and QD-OLED differ, and the questions that matter before you buy.',
  alternates: { canonical: '/guides/oled-tv' },
  openGraph: {
    type: 'article',
    url: `${BASE}/guides/oled-tv`,
    title: 'OLED, without the marketing.',
    description:
      'Why the black is real, what burn-in is and is not, why a 1,500-nit claim describes 2% of the screen, and how to judge a panel before you pay for it.',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'OLED, without the marketing.',
    description: 'The physics, the honest limits, and what to check before you buy.',
  },
};

/** The two panel constructions in current consumer OLED televisions. */
const PANELS = [
  {
    k: 'WOLED (white OLED + colour filters)',
    v: 'A white-emitting OLED layer sits behind red, green and blue filters, with an unfiltered white subpixel added for brightness. The white subpixel is what lets it hit high luminance, and also why very saturated bright colours can lose a little intensity — the extra light arrives uncoloured.',
  },
  {
    k: 'QD-OLED (blue OLED + quantum dots)',
    v: 'A blue-emitting layer excites quantum dots that convert light to red and green. Because colour is converted rather than filtered, less light is thrown away, and highly saturated colours stay bright. The trade is how it behaves in a lit room, below.',
  },
  {
    k: 'Micro-lens arrays',
    v: 'A layer of microscopic lenses over the panel redirects light that would otherwise be trapped inside it. It is an efficiency change, not a new kind of pixel — the same emitter simply gets more of its light out towards you.',
  },
];

/** What OLED genuinely is and is not good at. */
const LIMITS = [
  {
    k: 'Black level: the real advantage',
    v: 'Each pixel makes its own light, so a black pixel is switched off rather than dimmed. There is no backlight leaking around bright objects, which is why starfields and letterboxing look right instead of grey.',
  },
  {
    k: 'Full-screen brightness: the real limit',
    v: 'A quoted peak figure is usually measured on a small bright window — a few per cent of the screen. Light a whole snowfield and the automatic brightness limiter pulls power back to manage heat. This is normal behaviour, not a fault, and it is why OLED and bright-room LCD compare differently than the headline suggests.',
  },
  {
    k: 'Ambient light: where the room decides',
    v: 'Perfect blacks are perfect only in the dark. In a sunlit room, reflections raise the apparent black level of any screen. Panel coatings differ in how they handle this — some scatter light and lift blacks toward grey, others reflect it more narrowly — so the room you will actually watch in matters more than any specification.',
  },
  {
    k: 'Motion: genuinely excellent',
    v: 'Pixels change state in microseconds, so there is essentially no smearing behind moving objects. Some blur remains because your eye tracks motion across a frame that is held on screen, which is a property of how displays work rather than of OLED.',
  },
];

/** Burn-in, stated proportionately. */
const BURNIN = [
  {
    n: 'What it is',
    d: 'Uneven ageing. Subpixels dim slowly with use, and a bright static element — a channel logo, a scoreboard, a taskbar — ages the pixels beneath it faster than their neighbours. The mark is the difference, not a stain.',
    tone: 'warn',
  },
  {
    n: 'What it is not',
    d: 'Temporary image retention, which fades on its own after mixed content. Retention is common and harmless; permanent differential ageing is neither, and the two get called the same thing constantly.',
    tone: 'muted',
  },
  {
    n: 'What raises the risk',
    d: 'Hours per day of the same static bright element at high brightness — a news ticker, a game HUD, a spreadsheet. Varied content at moderate brightness is a materially different pattern of use.',
    tone: 'warn',
  },
  {
    n: 'What the set does about it',
    d: 'Pixel shifting, logo dimming, and compensation cycles that run when it is idle. These help and are not a guarantee; letting the set finish its cycle rather than pulling the plug is the one habit that matters.',
    tone: 'ok',
  },
];

const JUDGING = [
  'Decide the room first: a dark or dimly-lit room plays to OLED’s strengths; a sunlit one is where the argument gets closer',
  'Ask what screen area a brightness claim was measured on — a figure without a window size describes the best case, not your film',
  'For gaming or PC use, check HDMI 2.1 for 4K at 120Hz, plus variable refresh rate and auto low-latency mode',
  'If it will be a monitor as well, look at text on it in person — subpixel layouts differ and thin text can show colour fringing',
  'Read the warranty on burn-in specifically: coverage varies, and some explicitly exclude it',
  'Check the return window before the delivery date, not after — it is the only spec you can still act on once the box is open',
];

const FAQ = [
  {
    q: 'Will an OLED burn in if I use it normally?',
    a: 'Normal mixed viewing at sensible brightness is a low-risk pattern, and modern sets run compensation routines specifically for this. The honest answer is that risk scales with hours of the same bright static element — so the question is not "is it safe" but "what will actually be on this screen for hundreds of hours".',
  },
  {
    q: 'Is OLED bright enough for a sunny room?',
    a: 'Often yes, but this is the one place where a bright LCD can genuinely be the better choice. The deciding factor is not peak brightness on a small window — it is full-screen brightness and how the panel coating handles reflections. Judge it in a room like the one you have.',
  },
  {
    q: 'Which is better, WOLED or QD-OLED?',
    a: 'Neither, categorically. One reaches high luminance with an unfiltered white subpixel; the other keeps saturated colours brighter by converting rather than filtering light. They trade differently in a lit room and on fine text. Anyone telling you one wins outright is describing a preference as a fact.',
  },
  {
    q: 'Do I need 120Hz if I only watch films?',
    a: 'No. Film is 24 frames per second and every modern set handles it. High refresh rates matter for gaming and fast sport. Buying refresh rate you will not use is one of the most common ways to overspend on a television.',
  },
  {
    q: 'What about 8K?',
    a: 'At normal viewing distances most people cannot resolve 4K detail, let alone 8K, and there is very little 8K content. It is not a scam, but it is a specification bought far more often than it is seen.',
  },
  {
    q: 'Is OLED good as a computer monitor?',
    a: 'The picture is superb and the static-content question is at its sharpest — a taskbar and a code editor are exactly the pattern that ages pixels unevenly. Text rendering also varies with subpixel layout, so this is a case worth seeing in person rather than reading about.',
  },
  {
    q: 'Which OLED should I buy?',
    a: 'We are not answering that, deliberately. Ranking requires data we can verify, and we have no connected data source. This guide gives you the questions; comparisons will follow the published method when real offer data exists.',
  },
];

const BREADCRUMB_LD = {
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: [
    // Two levels, not three. There is no /guides index page, so a "Guides"
    // crumb would either point nowhere or — as it did in the first draft —
    // duplicate this page's own URL. The structured data mirrors the visible
    // breadcrumb exactly; inventing a level Google could not follow is the
    // kind of markup-only claim this site does not make.
    { '@type': 'ListItem', position: 1, name: 'Home', item: `${BASE}/` },
    {
      '@type': 'ListItem',
      position: 2,
      name: 'How to choose an OLED TV',
      item: `${BASE}/guides/oled-tv`,
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

export default function OledGuidePage() {
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
            <a href="/guides/over-ear-headphones">Headphones</a>
            <a className="active" href="/guides/oled-tv">
              OLED
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
                <span aria-current="page">How to choose an OLED TV</span>
              </li>
            </ol>
          </nav>
        </div>

        {/* 1 — hero */}
        <section className="hero" style={{ borderTop: 0 }}>
          <div className="wrap">
            <span className="pill-eyebrow">
              <span aria-hidden="true">✦</span>
              <p className="eyebrow">Explainer · OLED televisions</p>
            </span>
            <h1 className="hero-h1" style={{ maxWidth: '20ch' }}>
              <span className="h1-underlined">OLED,</span> <em>without the</em> marketing.
            </h1>
            <p className="lede" style={{ marginTop: 24 }}>
              The black really is black — that part of the story is true and it is why OLED looks
              the way it does. Almost everything else in the marketing needs a caveat, and the
              caveats are what decide whether it is the right screen for your room.
            </p>
            <p className="prelaunch" style={{ maxWidth: '58ch' }}>
              <b>No models named, no prices quoted, no brand declared the winner.</b> This is
              category knowledge — true of OLED as a technology, checkable anywhere, owned by no
              manufacturer.
            </p>
          </div>
        </section>

        {/* 2 — the principle */}
        <section id="principle">
          <div className="wrap">
            <div className="sec-head">
              <p className="eyebrow">01 · The principle</p>
              <h2>Every pixel is its own lamp.</h2>
            </div>
            <div className="card rule-card">
              <p className="rule-quote">
                An LCD blocks light from a backlight. An OLED pixel <b>emits its own</b> — so black
                is not a very dark grey, it is a pixel that is switched off.
              </p>
              <p className="muted">
                Everything good about OLED follows from that sentence, and so does the main limit. A
                pixel that makes its own light can be perfectly dark; it also has to produce every
                photon itself, which is why a whole screen of white is harder work than a single
                bright star on black.
              </p>
            </div>
            <p className="note">
              Working out whether a set you already own is one of these is a different question with
              a different answer — see{' '}
              <a href="/guides/how-to-tell-if-your-tv-is-oled">how to tell if your TV is OLED</a>.
            </p>
          </div>
        </section>

        {/* 3 — panel types */}
        <section id="panels">
          <div className="wrap">
            <div className="sec-head">
              <p className="eyebrow">02 · How the colour is made</p>
              <h2>Two constructions, different trade-offs.</h2>
              <p>
                Both are OLED. They differ in how white light becomes red, green and blue — which is
                where their advantages and compromises come from.
              </p>
            </div>
            <div className="comp-list">
              {PANELS.map((p) => (
                <div className="comp card" key={p.k}>
                  <h3>{p.k}</h3>
                  <p>{p.v}</p>
                </div>
              ))}
            </div>
            <p className="note">
              We are not naming a winner, because there is not one. These are engineering trades:
              one keeps saturated colour brighter, the other reaches high luminance more easily, and
              they behave differently in a lit room. Which matters depends entirely on your room and
              what you watch.
            </p>
          </div>
        </section>

        {/* 4 — honest limits */}
        <section id="limits">
          <div className="wrap">
            <div className="sec-head">
              <p className="eyebrow">03 · Honest limits</p>
              <h2>What it does brilliantly, and where it gives ground.</h2>
              <p>
                None of this is a defect of any particular set — it is the physics every OLED
                negotiates with.
              </p>
            </div>
            <div className="comp-list">
              {LIMITS.map((l) => (
                <div className="comp card" key={l.k}>
                  <h3>{l.k}</h3>
                  <p>{l.v}</p>
                </div>
              ))}
            </div>
            <p className="note">
              The brightness point is the one most often misread. A specification like &ldquo;1,500
              nits peak&rdquo; is typically measured on a window covering a few per cent of the
              screen. It is a real number describing a real capability — just not the one you
              experience during a bright daytime scene.
            </p>
          </div>
        </section>

        {/* 5 — burn-in */}
        <section id="burn-in">
          <div className="wrap">
            <div className="sec-head">
              <p className="eyebrow">04 · Burn-in, proportionately</p>
              <h2>Neither a myth nor a certainty.</h2>
              <p>
                The subject where marketing and forum panic are both unhelpful. Here is what it
                actually is.
              </p>
            </div>
            <div className="fresh-table" role="table" aria-label="Burn-in explained">
              <div className="fresh-head" role="row">
                <span role="columnheader">Aspect</span>
                <span role="columnheader">The reality</span>
                <span role="columnheader" />
              </div>
              {BURNIN.map((b) => (
                <div className="fresh-row" role="row" key={b.n}>
                  <span role="cell">
                    <b className={`fstate f-${b.tone}`}>{b.n}</b>
                  </span>
                  <span role="cell">{b.d}</span>
                  <span role="cell" />
                </div>
              ))}
            </div>
            <p className="note">
              The useful question is not whether burn-in is possible but what will be on this screen
              for hundreds of hours. A television showing varied content is a different risk profile
              from a monitor showing the same taskbar every working day.
            </p>
          </div>
        </section>

        {/* 6 — judging */}
        <section id="judging">
          <div className="wrap">
            <div className="sec-head">
              <p className="eyebrow">05 · Before you buy</p>
              <h2>Six checks that beat the spec sheet.</h2>
            </div>
            <div className="card blind" style={{ maxWidth: 760 }}>
              <h3>Worth doing in this order</h3>
              <ul className="tick-list">
                {JUDGING.map((j) => (
                  <li key={j}>{j}</li>
                ))}
              </ul>
            </div>
            <p className="note">
              The last one is the only item on any spec sheet you can still act on after delivery,
              and it is the one nobody reads. A generous return window is worth more than a
              specification you cannot evaluate in a shop.
            </p>
          </div>
        </section>

        {/* 7 — FAQ */}
        <section id="faq">
          <div className="wrap">
            <div className="sec-head">
              <p className="eyebrow">06 · Questions</p>
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

        {/* 8 — CTA */}
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
