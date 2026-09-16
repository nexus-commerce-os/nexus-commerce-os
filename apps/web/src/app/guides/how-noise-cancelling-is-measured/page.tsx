import type { Metadata } from 'next';

import { SiteFooter } from '@/components/SiteFooter';

/*
 * /guides/how-noise-cancelling-is-measured — measurement and interpretation.
 *
 * WHY THIS IS A SEPARATE PAGE. The ANC cluster already answers two questions.
 * /guides/how-anc-works explains the mechanism: microphones, inversion, the
 * three architectures. /guides/anc-on-off-meaning explains the switch: what on
 * and off do and when each is the better setting. Neither answers the third
 * question a reader arrives with once they start comparing products — what the
 * numbers on the box mean and how much weight to put on them. That is this
 * page.
 *
 * GSC EVIDENCE, STATED HONESTLY. ANC is the strongest measured surface on the
 * site: /guides/how-anc-works carried roughly 69 impressions in the observed
 * period, and visible ANC-related queries totalled roughly 35 impressions
 * across variants including "how does anc work", "how anc works", "what is
 * anc", "anc off meaning" and "anc on off meaning". There is NO measured GSC
 * evidence that anyone searched for "how is ANC measured", "ANC dB
 * measurement" or "noise cancelling decibels", and no such claim is made. The
 * rationale for this page is cluster expansion into an adjacent informational
 * intent, not a demonstrated query.
 *
 * TRUTH RULE FOR THIS FILE: acoustics and measurement methodology only. No
 * models, no brands, no prices, no merchants, no test results of any kind. No
 * graph is drawn, because drawing one would require measurement data this site
 * does not have. Every technical claim below was checked against a primary or
 * authoritative source before it was written:
 *
 *   - Insertion loss, and the active/passive split: ANSI/ASA S12.42, "Methods
 *     for the Measurement of Insertion Loss of Hearing Protection Devices in
 *     Continuous or Impulsive Noise Using Microphone-in-Real-Ear or Acoustic
 *     Test Fixture Procedures". Read 2026-09-11 via the ASA/ANSI catalogue
 *     scope text. It defines insertion loss as the difference in sound
 *     pressure level between the test microphones uncovered and covered by the
 *     device; specifies MIRE and ATF methods; states that the MIRE method is
 *     not limited to passive devices and may be used for active noise
 *     reduction circumaural and supra-aural devices; and describes how to
 *     combine the ACTIVE contribution to insertion loss with the PASSIVE
 *     real-ear attenuation measured per ANSI/ASA S12.6. That last point is the
 *     source for §04: the standards themselves treat the two as separate
 *     quantities that have to be combined.
 *   - Fitting procedure: ANSI/ASA S12.6, "Methods for Measuring the Real-Ear
 *     Attenuation of Hearing Protectors". REAT is psychophysical, on human
 *     subjects, comparing occluded and open thresholds. It provides Method A,
 *     trained-subject fit, describing what carefully trained users achieve,
 *     and Method B, inexperienced-subject fit, intended to approximate what
 *     groups of ordinary users achieve. It also carries its own caveat that
 *     attenuation data are valid only to the extent that users wear the device
 *     as they did during the test, and the known limitation that REAT below
 *     500 Hz can read a few decibels high because physiological noise masks
 *     the occluded-ear threshold, with the error growing as frequency falls.
 *     Source for §06.
 *   - Zone of quiet: the diameter of the region of cancellation in active
 *     control is typically about one tenth of an acoustic wavelength; at 1 kHz
 *     one tenth of a wavelength is about 3.4 cm. Taken from peer-reviewed work
 *     on local active control (PMC5876390). IMPORTANT: that work concerns
 *     free-field control with a moving head, NOT headphones, and §03 is worded
 *     so the geometry is used as general reasoning rather than transplanted
 *     onto headphones as if it were a headphone result.
 *   - Headphone control-loop limit: the separation between the microphone and
 *     the driver means the phase difference between the noise at the driver
 *     and at the microphone grows with frequency, which imposes a bandwidth
 *     limit on a feedback system; designs commonly concentrate active
 *     cancellation below roughly 1 kHz for loop stability. Closed earcups
 *     attenuate particularly well at higher frequencies, which is why the two
 *     mechanisms are described here as complementary.
 *   - Decibels: SPL is logarithmic against a 20 micropascal reference; about
 *     3 dB corresponds to a doubling or halving of sound ENERGY, 10 dB to a
 *     factor of ten, 20 dB to a factor of a hundred. Perceived loudness is a
 *     separate psychoacoustic quantity depending on level, frequency content
 *     and duration, so §02 deliberately refuses to publish a universal
 *     "X dB = Y per cent quieter" conversion.
 *
 * SOURCING CONVENTION: this file follows the existing site convention, set by
 * /guides/ssd-best-practices — sources are recorded here for reviewers, and no
 * visible citations section or external link is added to the page, because no
 * guide on this site has one and introducing that would be a site-wide content
 * decision rather than a scoped change.
 */

const BASE = 'https://honesttotal.com';

export const metadata: Metadata = {
  title: 'How noise cancelling is measured: what a dB number leaves out — HonestTotal',
  description:
    'A single "up to X dB" figure cannot describe noise cancellation on its own. What insertion loss and real-ear attenuation actually measure, why the frequency band matters, why active cancellation and passive isolation are separate quantities, and what to ask of any ANC claim.',
  alternates: { canonical: '/guides/how-noise-cancelling-is-measured' },
  openGraph: {
    type: 'article',
    url: `${BASE}/guides/how-noise-cancelling-is-measured`,
    title: 'One number cannot describe noise cancellation.',
    description:
      'How ANC is actually measured, why the frequency matters, and why "blocks X dB" and "the ANC reduces X dB" are not the same claim.',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'One number cannot describe noise cancellation.',
    description: 'What a dB claim measures, what it leaves out, and what to ask before believing it.',
  },
};

/** What a decibel figure is, and what it is not. */
const DB_FACTS = [
  {
    k: 'A ratio, not a quantity',
    v: 'A decibel is not a unit of loudness you can count out. It expresses a ratio on a logarithmic scale — for sound pressure level, a measured pressure compared against a fixed reference of 20 micropascals. Every decibel figure is therefore a comparison, and it means nothing until you know what it was compared against.',
  },
  {
    k: 'Equal steps mean equal ratios',
    v: 'Because the scale is logarithmic, the same number of decibels means the same proportional change wherever you are on it. Roughly 3 dB corresponds to halving the sound energy, 10 dB to a tenth of it, and 20 dB to a hundredth. The steps are not additive amounts of quietness.',
  },
  {
    k: 'Physical level is not perceived loudness',
    v: 'How much quieter something sounds is a separate, psychoacoustic question that depends on the level, the frequency content and the duration of the sound. A rule of thumb puts a 10 dB reduction at roughly half as loud, but that is an approximation for particular conditions, not a conversion factor to apply to any figure you see.',
  },
  {
    k: 'The common mistake',
    v: 'Treating decibels as linear. "20 dB is twice as quiet as 10 dB" is the version you will see most often, and it is wrong in both directions at once: it misreads the physical ratio, and it assumes perceived loudness tracks that ratio proportionally. Neither holds.',
  },
];

/** Why the frequency band is part of the claim. */
const FREQ = [
  {
    k: 'Attenuation is a curve, not a number',
    v: 'Measurement standards do not produce a single figure; they produce attenuation band by band across the frequency range. Any single headline number is a summary of that curve — a peak, an average over some range, or a figure at one band — and the summary method changes the number.',
  },
  {
    k: 'Geometry works against the active system as frequency rises',
    v: 'Active cancellation creates a limited region in which the sound fields subtract. In the general active-control literature that region is typically about one tenth of an acoustic wavelength across, which at 1 kHz is a few centimetres and shrinks from there. A headphone puts the driver at the ear, so it is far less exposed to this than a loudspeaker system in a room, but the same geometry becomes less forgiving as wavelengths shorten.',
  },
  {
    k: 'The control loop has a bandwidth',
    v: 'The microphone and the driver are not in the same place, so the phase difference between the noise arriving at each of them grows with frequency. That imposes a bandwidth limit on a feedback system, and designs commonly concentrate active cancellation below roughly 1 kHz to keep the loop stable rather than let it turn into audible artefacts.',
  },
  {
    k: 'What that does not mean',
    v: 'It does not mean active cancellation stops working above some line. Implementations differ, hybrid designs and better processing extend what is practical, and higher up the range the physical earcup is doing more of the work. The honest statement is that performance varies across frequency and that the shape of that variation is the thing a single number hides.',
  },
];

/** Active and passive are different quantities and get measured differently. */
const SPLIT = [
  {
    n: 'Total insertion loss',
    d: 'The difference in sound pressure level between the measurement microphones uncovered and covered by the headphone. It is the whole effect of putting the device on — earcup, pad, seal and electronics together.',
    state: 'Everything at once',
    tone: 'warn',
  },
  {
    n: 'Passive attenuation',
    d: 'What the physical device does with the electronics doing nothing: the cup, the pad and the seal. Measured on human subjects as real-ear attenuation at threshold, by comparing occluded and open hearing thresholds.',
    state: 'The earcup alone',
    tone: 'muted',
  },
  {
    n: 'The active contribution',
    d: 'What the cancellation system adds on top of the passive attenuation. Measured with microphones in the ear, and — in the standards — combined with the separately measured passive attenuation rather than assumed to be the whole of it.',
    state: 'The electronics alone',
    tone: 'ok',
  },
  {
    n: 'Why it matters to a reader',
    d: 'Because "this headphone blocks X dB" and "the ANC reduces X dB" are different claims about different quantities. A figure quoted without saying which one it is cannot be compared with a figure that means the other.',
    state: 'Not interchangeable',
    tone: 'warn',
  },
];

/** What can move the number without the headphone changing at all. */
const VARIABLES = [
  {
    k: 'The fit, and whose fit',
    v: 'Standards take this seriously enough to standardise it. One fitting procedure uses carefully trained subjects and describes what the device can do when fitted well; another deliberately uses inexperienced subjects to approximate what ordinary users actually achieve. The same headphone measured under both does not have to give the same answer.',
  },
  {
    k: 'The seal, in ordinary life',
    v: 'Pad shape and condition, the arms of glasses, hair, and simply taking the headphones off and putting them back on all change the seal. The standards carry their own version of this caveat: the attenuation figures hold only to the extent that the device is worn the way it was worn during the test.',
  },
  {
    k: 'The method itself',
    v: 'Fixtures, couplers and human-subject procedures do not all answer the same question. Even the reference threshold method has a known frequency-dependent limit — below about 500 Hz it can read a few decibels high, because the body’s own physiological noise masks the threshold being measured, and the error grows as frequency falls.',
  },
  {
    k: 'What was played, and for how long',
    v: 'The test signal is part of the result. Systems that adapt to what they are hearing can settle differently on steady noise than on noise that keeps changing, so a figure measured on one signal is not automatically a figure for another.',
  },
];

/** The central section: what a headline figure does not say. */
const ASK = [
  'At what frequency, or over what range of frequencies, was the figure measured?',
  'Is it a peak reduction or an average — and if an average, across what?',
  'Is it the active contribution only, or the total insertion loss including the earcup?',
  'What was the baseline the reduction is measured against?',
  'What method and fixture produced it, and was the fit controlled and repeated?',
  'Is it a best case — an "up to" figure — or a typical one?',
  'Is the methodology disclosed anywhere at all, or only the conclusion?',
];

/** What a measurement has to contain to be useful rather than decorative. */
const USEFUL = [
  'Attenuation reported across frequency bands rather than reduced to one headline figure',
  'A stated method, so a reader knows whether it is a fixture measurement or a human-subject one',
  'A clear statement of whether the figure is the active contribution or total isolation',
  'The baseline the reduction is measured against',
  'The fitting procedure, and whether the device was refitted and remeasured more than once',
  'The noise signal used, since adaptive systems respond differently to different signals',
  'Enough of the above that another product measured the same way could be compared with it',
];

const FAQ = [
  {
    q: 'How is noise cancelling measured?',
    a: 'By comparing sound levels with and without the headphone in the sound path. Published standards define the methods: insertion loss, measured with microphones in the ear or on an acoustic test fixture, and real-ear attenuation at threshold, measured psychophysically on human subjects by comparing occluded and open hearing thresholds. All of them produce attenuation across frequency bands rather than a single number.',
  },
  {
    q: 'What does dB mean for noise cancelling?',
    a: 'It expresses a ratio on a logarithmic scale, not an amount of quietness. Roughly 3 dB corresponds to halving the sound energy, 10 dB to a tenth of it, 20 dB to a hundredth. How much quieter that sounds is a separate question that depends on the level, the frequency content and the duration of the sound.',
  },
  {
    q: 'Is more dB always better for ANC?',
    a: 'Not on its own. A larger figure at one frequency says nothing about the rest of the range, and nothing about whether the reduction is smooth or lumpy, whether the system stays stable as the noise changes, or whether it introduces audible artefacts. A headphone you stop noticing is not the same thing as the headphone with the largest number.',
  },
  {
    q: 'Why does ANC work better on some sounds than others?',
    a: 'Steady low-frequency sound is predictable, and both the geometry and the control loop are on the system’s side down there. As frequency rises the wavelengths shorten and the phase difference between the microphone and the driver grows, which limits how much a feedback system can safely do. Higher up the range the physical earcup contributes more of the reduction.',
  },
  {
    q: 'Does passive isolation count as noise cancellation?',
    a: 'It reduces what reaches your ear, so it counts towards how quiet the headphone is — but it is not what the cancellation system is doing. The measurement standards keep them apart deliberately: the active contribution is measured and then combined with separately measured passive attenuation. A total figure and an ANC-only figure are different claims.',
  },
  {
    q: 'Can two ANC tests give different results for the same headphone?',
    a: 'Yes, without either being wrong. Different methods, fixtures, fitting procedures, test signals and summary conventions all move the number. That is why comparing two figures is only meaningful when they were produced the same way.',
  },
  {
    q: 'Does headphone fit affect ANC measurements?',
    a: 'Substantially. Standards define separate fitting procedures precisely because a carefully fitted device and a casually fitted one measure differently, and they state that the results hold only insofar as the device is worn as it was during the test. Glasses, hair, pad condition and simply refitting the headphones all change the seal.',
  },
  {
    q: 'Can one dB number tell me which headphone has better ANC?',
    a: 'No, and that is the honest answer rather than a cautious one. One number is a summary of a curve, produced by a method that is usually not stated, describing a quantity that may or may not include the earcup, achieved with a fit that may not resemble yours. It can be a useful signal alongside the methodology. It cannot settle the question by itself.',
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
      name: 'How noise cancelling is measured',
      item: `${BASE}/guides/how-noise-cancelling-is-measured`,
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

export default function AncMeasurementGuidePage() {
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
            <a href="/guides/how-anc-works">How ANC works</a>
            <a className="active" href="/guides/how-noise-cancelling-is-measured">
              How it is measured
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
                <span aria-current="page">How noise cancelling is measured</span>
              </li>
            </ol>
          </nav>
        </div>

        {/* 1 — hero: the answer, immediately */}
        <section className="hero" style={{ borderTop: 0 }}>
          <div className="wrap">
            <span className="pill-eyebrow">
              <span aria-hidden="true">✦</span>
              <p className="eyebrow">Explainer · measurement</p>
            </span>
            <h1 className="hero-h1" style={{ maxWidth: '26ch' }}>
              <span className="h1-underlined">How noise cancelling is measured</span>{' '}
              <em>— and why</em> dB claims can mislead.
            </h1>
            <p className="lede" style={{ marginTop: 24 }}>
              A single figure cannot describe noise cancellation, because the same headphone
              produces different numbers depending on which frequencies were tested, how the
              measurement was made, whether the earcup&rsquo;s own isolation was counted, how the
              fit was controlled, and what the reduction was measured against.
            </p>
            <p className="lede">
              None of that makes decibel figures meaningless. It makes them incomplete on their
              own. This page explains what the measurements actually are, so that a claim can be
              read for what it says rather than taken at the size of its number.
            </p>
            <p className="prelaunch" style={{ maxWidth: '58ch' }}>
              <b>No models named, no measurements published.</b> This is methodology — true of how
              the quantity is defined, not of any particular pair. If you want the mechanism
              instead, that is <a href="/guides/how-anc-works">how noise cancelling works</a>.
            </p>
          </div>
        </section>

        {/* 2 — the short answer */}
        <section id="short-answer">
          <div className="wrap">
            <div className="sec-head">
              <p className="eyebrow">01 · The short answer</p>
              <h2>The number is a summary. The method is the claim.</h2>
            </div>
            <div className="card rule-card">
              <p className="rule-quote">
                Noise reduction is measured as a <b>difference</b> — the level reaching the ear with
                the headphone in the way, against the level without it. Everything contentious about
                ANC figures follows from the fact that both halves of that difference can be set up
                in more than one legitimate way.
              </p>
              <p className="muted">
                Which frequencies. Which fit. Whether the earcup counts. What the baseline was.
                Change any of those and the number changes while the headphone does not.
              </p>
            </div>
            <p className="note">
              This is not an accusation. Standardised methods for exactly this problem exist and are
              used; the gap is usually between what a laboratory measures and what a single line of
              packaging copy can carry.
            </p>
          </div>
        </section>

        {/* 3 — what a dB actually is */}
        <section id="decibels">
          <div className="wrap">
            <div className="sec-head">
              <p className="eyebrow">02 · What &ldquo;dB of noise reduction&rdquo; means</p>
              <h2>Decibels are ratios, and ratios need a reference.</h2>
              <p>
                The scale is the first place intuition goes wrong, and it goes wrong in a way that
                makes every later comparison worse.
              </p>
            </div>
            <div className="comp-list">
              {DB_FACTS.map((d) => (
                <div className="comp card" key={d.k}>
                  <h3>{d.k}</h3>
                  <p>{d.v}</p>
                </div>
              ))}
            </div>
            <p className="note">
              There is deliberately no &ldquo;X dB equals Y per cent quieter&rdquo; table on this
              page. Such a conversion only holds for a particular quantity under particular
              conditions, and printing one as though it were general would be the same kind of
              shortcut this page is about.
            </p>
          </div>
        </section>

        {/* 4 — frequency */}
        <section id="frequency">
          <div className="wrap">
            <div className="sec-head">
              <p className="eyebrow">03 · Why frequency matters</p>
              <h2>One number flattens a curve.</h2>
              <p>
                Attenuation is not constant across the range, and the shape of the variation is
                exactly what a headline figure cannot carry.
              </p>
            </div>
            <div className="comp-list">
              {FREQ.map((f) => (
                <div className="comp card" key={f.k}>
                  <h3>{f.k}</h3>
                  <p>{f.v}</p>
                </div>
              ))}
            </div>
            <p className="note">
              In practice this is why steady engine drone and air conditioning are the sounds people
              notice ANC working on, while conversation nearby is softened rather than removed —
              the mechanism behind that is covered in{' '}
              <a href="/guides/how-anc-works">how noise cancelling actually works</a>.
            </p>
          </div>
        </section>

        {/* 5 — active vs passive */}
        <section id="active-vs-passive">
          <div className="wrap">
            <div className="sec-head">
              <p className="eyebrow">04 · Active cancellation vs passive isolation</p>
              <h2>Two different quantities, routinely quoted as one.</h2>
              <p>
                This is the distinction that does the most damage when it is skipped, and the
                measurement standards are unambiguous about it.
              </p>
            </div>
            <div className="fresh-table" role="table" aria-label="What each measured quantity covers">
              <div className="fresh-head" role="row">
                <span role="columnheader">Quantity</span>
                <span role="columnheader">What it covers</span>
                <span role="columnheader">Scope</span>
              </div>
              {SPLIT.map((s) => (
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
              The standards do not merge these by accident of convenience — they specify how the
              active contribution is to be combined with separately measured passive attenuation.
              If the people who wrote the methods keep the two apart, a claim that does not say
              which one it means is not ready to be compared with anything.
            </p>
          </div>
        </section>

        {/* 6 — on vs off */}
        <section id="on-vs-off">
          <div className="wrap">
            <div className="sec-head">
              <p className="eyebrow">05 · How ANC measurements are compared</p>
              <h2>Measure with it on, measure with it off, subtract — nearly.</h2>
            </div>
            <div className="card rule-card">
              <p className="rule-quote">
                The intuitive comparison is the right starting point: the difference between the two
                states is a reasonable picture of what the cancellation system is contributing.
              </p>
              <p className="muted">
                What it is not is a guarantee that subtraction isolates every effect. The headphone
                has to be in the same position for both runs, because lifting and refitting changes
                the seal. Fixtures and couplers differ. Adaptive systems settle differently
                depending on the signal and how long it ran. And some designs alter their own
                frequency response when cancellation is engaged, which turns up in the difference
                alongside the cancellation itself.
              </p>
            </div>
            <p className="note">
              If what you actually want is the practical version of this — when the switch is worth
              using and when it is not — that is answered separately in{' '}
              <a href="/guides/anc-on-off-meaning">what ANC on and off mean</a>.
            </p>
          </div>
        </section>

        {/* 7 — fit and seal */}
        <section id="fit">
          <div className="wrap">
            <div className="sec-head">
              <p className="eyebrow">06 · Why fit and seal change the result</p>
              <h2>The same headphone, measured twice, honestly.</h2>
              <p>
                Four things that move a measured figure without anything about the product being
                different.
              </p>
            </div>
            <div className="comp-list">
              {VARIABLES.map((v) => (
                <div className="comp card" key={v.k}>
                  <h3>{v.k}</h3>
                  <p>{v.v}</p>
                </div>
              ))}
            </div>
            <p className="note">
              The takeaway is narrower than &ldquo;laboratory numbers are useless&rdquo;. A
              controlled measurement is what makes two products comparable at all. It simply does
              not promise that any individual&rsquo;s ears, head and glasses will reproduce it.
            </p>
          </div>
        </section>

        {/* 8 — the central section */}
        <section id="up-to">
          <div className="wrap">
            <div className="sec-head">
              <p className="eyebrow">07 · Why &ldquo;up to X dB&rdquo; needs context</p>
              <h2>Seven questions a headline figure usually does not answer.</h2>
              <p>
                None of these are gotchas. Each one is a choice a laboratory has to make before a
                number exists at all.
              </p>
            </div>
            <div className="card blind" style={{ maxWidth: 760 }}>
              <h3>What to ask of any reduction claim</h3>
              <ul className="tick-list">
                {ASK.map((a) => (
                  <li key={a}>{a}</li>
                ))}
              </ul>
            </div>
            <p className="note">
              The phrase <b>up to</b> is doing particular work. It describes a best case, and a best
              case is a legitimate thing to measure — but it is the ceiling of the curve, not a
              figure anyone should expect to experience across the range or on an ordinary head.
            </p>
          </div>
        </section>

        {/* 9 — what a useful measurement contains */}
        <section id="useful">
          <div className="wrap">
            <div className="sec-head">
              <p className="eyebrow">08 · What a useful measurement shows</p>
              <h2>The methodology is the part worth reading.</h2>
            </div>
            <div className="card blind" style={{ maxWidth: 760 }}>
              <h3>Present in a measurement you can actually use</h3>
              <ul className="tick-list">
                {USEFUL.map((u) => (
                  <li key={u}>{u}</li>
                ))}
              </ul>
            </div>
            <p className="note">
              A manufacturer that does not publish a laboratory graph is not thereby selling a worse
              headphone. Most do not publish one. It means the claim has to be weighed as marketing
              rather than as data — which is a statement about the claim, not about the product.
            </p>
          </div>
        </section>

        {/* 10 — comparing claims */}
        <section id="comparing">
          <div className="wrap">
            <div className="sec-head">
              <p className="eyebrow">09 · How to compare ANC claims</p>
              <h2>Compare methods first, numbers second.</h2>
            </div>
            <div className="card rule-card">
              <p className="rule-quote">
                Two figures are comparable when they were produced the same way. A manufacturer&rsquo;s
                headline and an independent laboratory&rsquo;s band data are not two measurements of
                the same thing, and putting them side by side produces a conclusion neither of them
                supports.
              </p>
              <p className="muted">
                Attenuation magnitude is also not the whole of what makes cancellation good to live
                with. Consistency across the range, behaviour when the noise keeps changing, comfort
                and seal, and whether the system introduces hiss or pressure all matter to the
                experience and none of them are in the headline number. Transparency mode is a
                separate capability again, and any change in how music sounds with cancellation
                engaged is a further dimension rather than part of the reduction figure.
              </p>
            </div>
          </div>
        </section>

        {/* 11 — checklist */}
        <section id="checklist">
          <div className="wrap">
            <div className="sec-head">
              <p className="eyebrow">10 · The short version</p>
              <h2>Reading an ANC claim, in seven lines.</h2>
            </div>
            <div className="card blind" style={{ maxWidth: 760 }}>
              <h3>Look for</h3>
              <ul className="tick-list">
                <li>Frequency-dependent data rather than only one headline figure</li>
                <li>A clearly stated measurement method</li>
                <li>ANC-on against ANC-off context where the distinction is being drawn</li>
                <li>An explicit split between active contribution and passive isolation</li>
                <li>A controlled, repeatable test setup with the fit described</li>
                <li>Disclosed test conditions, including the noise signal used</li>
                <li>The same methodology on both sides before comparing two products</li>
              </ul>
            </div>
            <p className="note">
              And one thing not to conclude: an absent laboratory graph is not evidence of a bad
              product. It is an absent laboratory graph.
            </p>
          </div>
        </section>

        {/* 12 — FAQ */}
        <section id="faq">
          <div className="wrap">
            <div className="sec-head">
              <p className="eyebrow">11 · Questions</p>
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
              <h2>Methodology now, comparisons when the data is real.</h2>
              <p>
                We are not ranking noise cancellation, because ranking it would require measurements
                we can verify and do not have. When live data exists it will be ranked by the
                published method — totals, commission-blind, nothing unverified.
              </p>
              <div className="hero-cta" style={{ justifyContent: 'center', marginTop: 28 }}>
                <a className="btn btn-primary" href="/#cta">
                  Join the waitlist →
                </a>
                <a className="btn btn-ghost" href="/guides/how-anc-works">
                  How ANC works
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
