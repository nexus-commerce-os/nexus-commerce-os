import type { Metadata } from 'next';

import { SiteFooter } from '@/components/SiteFooter';

/*
 * /guides/anc-on-off-meaning — a decision guide, not an explainer.
 *
 * WHY THIS IS NOT PART OF /guides/how-anc-works. Search Console shows a
 * separate intent behind "anc off meaning" and "anc on off meaning": the reader
 * is holding a pair of headphones with a button on them and wants to know what
 * the setting does and which one to pick. That is a different question from
 * "how does ANC work", which the existing guide answers, and a different reader
 * — one who already owns the thing.
 *
 * The division of labour is deliberate and must be preserved: mechanism lives
 * in how-anc-works, choice lives here. Where this page brushes against
 * mechanism — pressure, voices — it says the minimum and links across rather
 * than restating the physics.
 *
 * TRUTH RULE FOR THIS FILE: category knowledge only, and no absolutes. ANC
 * behaviour varies with implementation, fit, noise type and environment, so
 * every claim is written to hold across headphones rather than describe a
 * particular pair. No models, no measurements, no invented battery percentages,
 * no prices, no merchants.
 */

const BASE = 'https://honesttotal.com';

export const metadata: Metadata = {
  title: 'What does ANC on/off mean — HonestTotal',
  description:
    'ANC on means active noise cancellation is running; ANC off means it is switched off, though the physical seal still blocks some sound. When each setting helps, and why off is not the same as transparency mode.',
  alternates: { canonical: '/guides/anc-on-off-meaning' },
  openGraph: {
    type: 'article',
    url: `${BASE}/guides/anc-on-off-meaning`,
    title: 'ANC on, ANC off — and when to use each.',
    description:
      'What the setting actually changes, when cancellation earns its battery, and why switching ANC off is not the same as switching transparency on.',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'ANC on, ANC off — and when to use each.',
    description: 'What the switch does, and which setting fits the room you are in.',
  },
};

/** The two states, side by side. */
const STATES = [
  {
    n: 'ANC on',
    d: 'Microphones and processing are running, working against the noise around you. Most effective on steady low-frequency sound — engine drone, air conditioning, road rumble. It draws additional power the whole time it is on.',
    state: 'Cancelling',
    tone: 'ok',
  },
  {
    n: 'ANC off',
    d: 'The cancellation processing stops. The headphones keep working normally — audio still plays, and the physical seal still blocks some sound on its own. What you lose is the electronic part, not the headphone.',
    state: 'Passive only',
    tone: 'muted',
  },
];

/** Situations where cancellation earns what it costs. */
const TURN_ON = [
  'Aircraft, trains and coaches — sustained engine and cabin drone is the noise ANC handles best',
  'An office with air conditioning, ventilation or fan hum in the background',
  'Commuting, where road and rail noise is constant rather than sudden',
  'Anywhere a low, unchanging sound is wearing you down more than you had noticed',
  'When you find yourself turning the volume up to cover the room — lowering the noise is the better fix',
];

/** Situations where it may be doing little for you. */
const TURN_OFF = [
  'A quiet room, where there is little steady noise left to cancel',
  'When battery matters more than the last few decibels — cancellation runs continuously and costs power',
  'If you notice the pressure sensation or a faint hiss and find it uncomfortable',
  'When you want the headphone to behave as simply as possible, with no processing in the path',
  'If you want to hear what is around you — though transparency mode, where it exists, is built for that and off is not',
];

const CHECKLIST = [
  'Plane, train or bus → ANC on',
  'Open-plan office with constant fan or HVAC hum → ANC on',
  'Quiet room → optional; try both and keep whichever you stop noticing',
  'You need to hear your surroundings → transparency or ambient mode if your headphones have it',
  'Battery running low → switching ANC off is one of the few things that reliably helps',
  'Pressure or hiss bothers you → off, or transparency, or a different pair — it varies by person',
];

const FAQ = [
  {
    q: 'Does ANC work without music playing?',
    a: 'On most headphones, yes — cancellation is a separate function from playback, so you can switch it on with nothing playing and simply hear less of the room. A few designs tie it to power or pairing behaviour, so if silence-only use matters to you it is worth checking that specific model before buying.',
  },
  {
    q: 'Is ANC off the same as transparency mode?',
    a: 'No, and this is the most common mix-up. ANC off means no processing in either direction — you hear whatever the physical seal lets through, which is usually muffled. Transparency deliberately uses the microphones to pass outside sound in, so the room sounds closer to normal. Off is neutral; transparency is active.',
  },
  {
    q: 'Does ANC use more battery?',
    a: 'Yes. The microphones and the processing run continuously while it is on, so it draws power the whole time rather than only when something noisy happens. How much depends entirely on the design, which is why manufacturers usually quote two runtime figures. Compare the one with ANC on — that is the number that describes how you will actually use them.',
  },
  {
    q: 'Does ANC block all noise?',
    a: 'No. It is strongest against steady, low-frequency sound and much weaker against speech and sudden noises like a door closing. Effectiveness also depends heavily on fit — a poor seal undermines the electronics before they start. Expect a quieter room, not a silent one.',
  },
  {
    q: 'Does ANC block voices?',
    a: 'It softens them rather than removing them. Speech sits in the mid-range and changes constantly, which is exactly the kind of sound that is hard to predict and cancel. Some of what does get blocked is the physical seal doing the work rather than the electronics.',
  },
  {
    q: 'Why does ANC make my ears feel pressed?',
    a: 'Some people perceive a pressure sensation when low-frequency sound is removed from a room. It varies between people and often fades with use. It is a reason to buy somewhere with a generous return window rather than a reason to avoid ANC — and the mechanism is explained in the ANC guide.',
  },
  {
    q: 'If I turn ANC off, do the headphones stop working?',
    a: 'No. They play audio exactly as before. All that changes is that the cancellation processing stops; the earcups or tips still block some sound simply by being in the way.',
  },
];

const BREADCRUMB_LD = {
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: [
    // Two levels, matching the other guides: there is no /guides index page.
    { '@type': 'ListItem', position: 1, name: 'Home', item: `${BASE}/` },
    {
      '@type': 'ListItem',
      position: 2,
      name: 'What does ANC on/off mean',
      item: `${BASE}/guides/anc-on-off-meaning`,
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

export default function AncOnOffPage() {
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
            <a href="/guides/how-anc-works">ANC explained</a>
            <a className="active" href="/guides/anc-on-off-meaning">
              On or off
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
                <span aria-current="page">What does ANC on/off mean</span>
              </li>
            </ol>
          </nav>
        </div>

        {/* 1 — hero: answer in the first paragraph */}
        <section className="hero" style={{ borderTop: 0 }}>
          <div className="wrap">
            <span className="pill-eyebrow">
              <span aria-hidden="true">✦</span>
              <p className="eyebrow">Explainer · using noise cancelling</p>
            </span>
            <h1 className="hero-h1" style={{ maxWidth: '22ch' }}>
              <span className="h1-underlined">ANC on, ANC off</span> — <em>and when to use</em>{' '}
              each.
            </h1>
            <p className="lede" style={{ marginTop: 24 }}>
              <b>ANC on</b> means active noise cancellation is running: microphones and processing
              are working against the sound around you. <b>ANC off</b> means that processing is
              switched off — the headphones still play audio, and the physical seal still blocks
              some sound on its own.
            </p>
            <p className="lede">
              The setting is worth thinking about rather than leaving on by default. Cancellation
              helps most in steady noise and does least in a quiet room, and it draws power the
              whole time it is running.
            </p>
            <p className="prelaunch" style={{ maxWidth: '58ch' }}>
              <b>This page is about choosing a setting.</b> If you want to know how the
              cancellation itself works — feedforward, feedback, why voices get through — that is
              the <a href="/guides/how-anc-works">ANC explainer</a>.
            </p>
          </div>
        </section>

        {/* 2 — quick answer table */}
        <section id="states">
          <div className="wrap">
            <div className="sec-head">
              <p className="eyebrow">01 · The quick answer</p>
              <h2>What the switch actually changes.</h2>
              <p>Less than people expect in one direction, more in the other.</p>
            </div>
            <div className="fresh-table" role="table" aria-label="ANC on compared with ANC off">
              <div className="fresh-head" role="row">
                <span role="columnheader">Setting</span>
                <span role="columnheader">What is happening</span>
                <span role="columnheader">State</span>
              </div>
              {STATES.map((s) => (
                <div className="fresh-row" role="row" key={s.n}>
                  <span role="cell">
                    <b className={`fstate f-${s.tone}`}>{s.n}</b>
                  </span>
                  <span role="cell">{s.d}</span>
                  <span role="cell" className={`frank fr-${s.tone}`}>
                    {s.state}
                  </span>
                </div>
              ))}
            </div>
            <p className="note">
              The part most people miss: switching ANC off does not make headphones transparent. It
              removes the electronics from the path and leaves the physical seal, which on over-ears
              and sealed earbuds still muffles a fair amount.
            </p>
          </div>
        </section>

        {/* 3 — when on */}
        <section id="when-on">
          <div className="wrap">
            <div className="sec-head">
              <p className="eyebrow">02 · When to turn it on</p>
              <h2>Steady noise is where it earns its battery.</h2>
              <p>
                Cancellation works by predicting a wave and playing its opposite, so the more
                predictable the noise, the better it does.
              </p>
            </div>
            <div className="card blind" style={{ maxWidth: 760 }}>
              <h3>Good conditions for ANC</h3>
              <ul className="tick-list">
                {TURN_ON.map((t) => (
                  <li key={t}>{t}</li>
                ))}
              </ul>
            </div>
            <p className="note">
              The last one is the one worth internalising. If a room is pushing your volume up,
              lowering the noise does more for your ears than raising the music — and that is the
              case where ANC is genuinely doing something for you.
            </p>
          </div>
        </section>

        {/* 4 — when off */}
        <section id="when-off">
          <div className="wrap">
            <div className="sec-head">
              <p className="eyebrow">03 · When to turn it off</p>
              <h2>Quiet rooms, low battery, and personal comfort.</h2>
              <p>
                None of these are faults. They are situations where the processing is spending
                power for very little return, or where you simply prefer it off.
              </p>
            </div>
            <div className="card blind blind-out" style={{ maxWidth: 760 }}>
              <h3>Reasonable reasons to switch it off</h3>
              <ul className="cross-list">
                {TURN_OFF.map((t) => (
                  <li key={t}>{t}</li>
                ))}
              </ul>
            </div>
            <p className="note">
              Comfort is a legitimate reason on its own. The pressure sensation some people notice
              is real, varies between people, and is not something to push through if it bothers
              you — the{' '}
              <a href="/guides/how-anc-works">ANC explainer</a> covers why it happens.
            </p>
          </div>
        </section>

        {/* 5 — off vs transparency */}
        <section id="transparency">
          <div className="wrap">
            <div className="sec-head">
              <p className="eyebrow">04 · The distinction that matters</p>
              <h2>Off is not transparency.</h2>
            </div>
            <div className="card rule-card">
              <p className="rule-quote">
                <b>ANC off</b> stops the headphone cancelling. <b>Transparency</b> makes it pass the
                outside world through. One is neutral; the other is active in the opposite
                direction.
              </p>
              <p className="muted">
                With cancellation off you hear whatever gets past the seal, which on a well-fitting
                over-ear is muffled and indistinct. Transparency — also called ambient or
                pass-through, depending on the manufacturer — uses the same microphones to feed
                outside sound into the earcup deliberately, so a conversation or an announcement
                sounds much closer to normal. If your headphones have it and you want to hear the
                room, that is the mode designed for it.
              </p>
            </div>
            <p className="note">
              Not every pair offers transparency, and quality varies a great deal between those that
              do. It is worth trying in a shop rather than reading about: poor implementations sound
              thin and hollow in a way no specification communicates.
            </p>
          </div>
        </section>

        {/* 6 — checklist */}
        <section id="checklist">
          <div className="wrap">
            <div className="sec-head">
              <p className="eyebrow">05 · The short version</p>
              <h2>Which setting, in which situation.</h2>
            </div>
            <div className="card blind" style={{ maxWidth: 760 }}>
              <h3>Quick decision checklist</h3>
              <ul className="tick-list">
                {CHECKLIST.map((c) => (
                  <li key={c}>{c}</li>
                ))}
              </ul>
            </div>
            <p className="note">
              There is no universally correct setting. Cancellation quality, transparency quality
              and how the pressure sensation feels all vary between models and between people, so
              the honest advice is to try both in the places you actually listen.
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
              <h2>Answers first, comparisons when the data is real.</h2>
              <p>
                This page recommends no model and quotes no price. When live offers exist they will
                be ranked by the published method — totals, commission-blind, nothing unverified.
              </p>
              <div className="hero-cta" style={{ justifyContent: 'center', marginTop: 28 }}>
                <a className="btn btn-primary" href="/guides/how-anc-works">
                  How ANC actually works →
                </a>
                <a className="btn btn-ghost" href="/guides/over-ear-headphones">
                  Choosing headphones
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
