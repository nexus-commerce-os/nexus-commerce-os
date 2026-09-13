import type { Metadata } from 'next';

import { SiteFooter } from '@/components/SiteFooter';

/*
 * /guides/over-ear-vs-on-ear-vs-in-ear — the form-factor decision.
 *
 * WHY THIS IS NOT PART OF /guides/over-ear-headphones. That page answers "which
 * over-ear headphones should I choose": five decisions in priority order,
 * spec-sheet traps, longevity, and a deliberate refusal to name models. It was
 * read in full before this file was written. The words "on-ear", "in-ear",
 * "earbud", "IEM" and "form factor" do not appear on it anywhere, and neither
 * do portability, glasses, commuting, travel or exercise. It assumes the
 * category is already settled. This page is the question before that one.
 *
 * DELIBERATE NON-COVERAGE. Choosing a specific pair — comfort criteria within
 * over-ear, battery figures, codecs, driver size, call quality, longevity — is
 * the buying guide's job and is summarised here in a sentence at most, with a
 * link. ANC mechanism belongs to /guides/how-anc-works and measurement to
 * /guides/how-noise-cancelling-is-measured; neither is reproduced.
 *
 * GSC EVIDENCE, STATED HONESTLY. /guides/over-ear-headphones carries roughly 22
 * measured impressions. Visible headphone query evidence is weak and largely
 * truncated. There is NO measured query evidence for "over-ear vs on-ear vs
 * in-ear" or any equivalent, and none is claimed. The rationale is measured
 * page-level headphone interest, a verified form-factor content gap, an
 * underbuilt cluster — /guides/over-ear-headphones had three contextual inbound
 * links and zero outbound, making it a sink rather than a hub — and low
 * expected intent overlap.
 *
 * TRUTH RULE FOR THIS FILE: no models, no brands, no prices, no merchants, no
 * rankings, no invented test data, no fabricated scores. And specifically for
 * this topic: no universal form-factor verdicts. "Over-ear sounds better",
 * "in-ear has better bass", "on-ear is more comfortable", "over-ear ANC is
 * stronger" are all claims this page declines to make. Form factor sets design
 * constraints; implementation and fit decide the result.
 *
 * SOURCES CHECKED BEFORE WRITING:
 *
 *   - Breebaart, "No correlation between headphone frequency response and
 *     retail price", J. Acoust. Soc. Am. 141(6), 2017. 283 headphones measured,
 *     $4 to over $5000, explicitly examining correlations between headphone
 *     TYPE, price and frequency response. Neither the measured response nor an
 *     objective estimate of perceived quality related to price. In-ear models
 *     showed a SLIGHTLY higher measured bass response than other types, and
 *     in-ear and circumaural models deviated SLIGHTLY less from an assumed
 *     target curve than supra-aural models. The word doing the work is
 *     "slightly": this is the source for §06 saying form factor shows a small
 *     systematic tendency and price predicts nothing. It is NOT used to claim
 *     any category sounds better.
 *   - WHO/ITU global standard for safe listening devices and systems, and WHO
 *     "Deafness and hearing loss: Safe listening". 80 dB for up to 40 hours a
 *     week for adults, 75 dB for children; at 90 dB the safe weekly time falls
 *     to about four hours. Risk tracks level, duration and frequency of
 *     exposure. WHO recommends well-fitted and noise-cancelling headphones
 *     specifically because they reduce the need to raise the volume in noisy
 *     places. Source for the hearing-safety note in §05. No form factor is
 *     described as safe or unsafe, and no medical advice is given.
 *   - Audiometric attenuation literature (insert versus supra-aural earphones,
 *     measured under ANSI S12.6 diffuse-field conditions) documents that sealed
 *     insert earphones attenuate more than supra-aural earphones, frequency
 *     dependent. IMPORTANT SCOPE: those are clinical test instruments, not
 *     consumer headphones. §03 therefore uses them only for the MECHANISM —
 *     how each design achieves a seal — and never as a consumer verdict.
 *   - Seal mechanics: an acoustic leak between the device and the ear causes
 *     low-frequency response to fall, and the larger the leak the higher in
 *     frequency the fall begins; the leak also lowers the acoustic impedance
 *     the driver works into, so it must be driven harder for the same bass,
 *     costing headroom and distortion. Source for §04 and §06.
 *   - Active versus passive split: the hearing-protector measurement standards
 *     treat the active contribution and the passive attenuation as separate
 *     quantities that must be combined. Recorded in full in
 *     /guides/how-noise-cancelling-is-measured §04 and not repeated here.
 *
 * SOURCING CONVENTION: follows /guides/ssd-best-practices,
 * /guides/how-noise-cancelling-is-measured and
 * /guides/should-you-switch-to-a-mechanical-keyboard — sources recorded here
 * for reviewers, no visible citations section and no external link on the page,
 * because no guide on this site has one.
 */

const BASE = 'https://honesttotal.com';

export const metadata: Metadata = {
  title: 'Over-ear vs on-ear vs in-ear headphones: which fits you? — HonestTotal',
  description:
    'Not which model — which shape. What genuinely separates over-ear, on-ear and in-ear headphones: seal and isolation, comfort, portability, and why the category tells you about design constraints rather than how good any particular pair will sound.',
  alternates: { canonical: '/guides/over-ear-vs-on-ear-vs-in-ear' },
  openGraph: {
    type: 'article',
    url: `${BASE}/guides/over-ear-vs-on-ear-vs-in-ear`,
    title: 'Over-ear, on-ear or in-ear?',
    description:
      'What the three shapes actually change, what they do not, and how to pick the one that suits where you listen.',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Over-ear, on-ear or in-ear?',
    description: 'The category sets the constraints. It does not set the quality.',
  },
};

/** What each shape physically is. Definitions, not verdicts. */
const SHAPES = [
  {
    k: 'Over-ear (circumaural)',
    v: 'The earcup surrounds the ear and the pad seals against the side of your head. Nothing touches the ear itself if the cup is deep and wide enough — and if it is not, it becomes an on-ear in practice, which is the single most common fit disappointment in this category.',
  },
  {
    k: 'On-ear (supra-aural)',
    v: 'The pad rests on the ear rather than around it. Smaller and lighter than an over-ear of the same design, and the pressure is carried by the ear itself rather than by your skull, which is why clamp force matters more here than anywhere else.',
  },
  {
    k: 'In-ear (earbuds and IEMs)',
    v: 'The unit sits at or in the ear canal, held by an eartip. The smallest of the three by a wide margin, and the only one whose seal depends on matching a tip to the shape of your particular ear canal.',
  },
];

/** The differences that are actually properties of the shape. */
const DIFFERENCES = [
  {
    k: 'Where the seal comes from',
    v: 'This is the real dividing line. An over-ear seals against the side of your head, an in-ear seals inside your ear canal, and an on-ear does neither completely — it rests on the ear, so its seal is the least enclosed of the three by construction. In clinical audiometry, where attenuation is measured to standards, sealed insert earphones are documented as attenuating more than supra-aural ones. Those are test instruments rather than consumer headphones, so read that as a statement about how seals work, not about which shopping category wins.',
  },
  {
    k: 'Size, and what size costs',
    v: 'An over-ear needs somewhere to live when it is not on your head. An in-ear fits in a pocket. An on-ear sits between the two. This is the most reliable difference between the categories and the least dependent on implementation — everything else on this page has exceptions, and this one mostly does not.',
  },
  {
    k: 'What carries the weight',
    v: 'Over-ear weight is carried by the headband and the sides of your head; on-ear weight is carried by your ears; in-ear weight is negligible but the unit has to stay put by grip rather than by mass. Three different comfort problems, not three degrees of the same one.',
  },
  {
    k: 'Heat',
    v: 'Anything that encloses the ear traps warmth, and pad material changes how much. Leather and protein-leather pads insulate more than fabric ones. This is a real over-ear trade-off in a warm room, and it is a property of enclosure rather than of any particular brand.',
  },
];

/** Comfort, treated as individual. */
const COMFORT = [
  {
    k: 'Over-ear: depth is the variable',
    v: 'Comfortable for long sessions when the cup genuinely clears your ear and the clamp is moderate. When the cup is too shallow your ear touches the driver baffle, and when it is too narrow the pad lands on your ear — both of which turn a long session into a short one. Pad dimensions matter more than the headline design.',
  },
  {
    k: 'On-ear: pressure is the variable',
    v: 'Lighter and cooler than an over-ear, and the pressure is concentrated on the ear itself. Some people are untroubled by that for hours; others find it uncomfortable within twenty minutes. It varies between people more than the other two, which makes trying them the only real test.',
  },
  {
    k: 'In-ear: the canal is the variable',
    v: 'Essentially weightless and invisible under a hat, but the sensation of something in the ear canal is not universally tolerated. Tip size and material change both comfort and seal, and a pair that comes with several tip sizes is doing something genuinely useful rather than padding the box.',
  },
  {
    k: 'Glasses, hair and hats',
    v: 'Glasses arms pass under an over-ear pad and can break the seal where they cross; a softer pad closes around the arm better than a firm one. On-ear pads press the arm against your head, which some people feel quickly. In-ear designs avoid the interaction entirely, which is a genuine practical advantage rather than a marketing one.',
  },
];

/** Where each shape tends to fit. Tendencies, with the caveat stated. */
const SITUATIONS = [
  {
    n: 'Long desk sessions',
    d: 'Over-ear tends to suit this best — weight is spread, nothing presses on the ear, and there is no canal sensation to tire of. Heat is the counterweight in a warm room.',
    state: 'Often a good fit',
    tone: 'ok',
  },
  {
    n: 'Commuting',
    d: 'All three are used for this and all three work. In-ear wins on bulk, over-ear on comfort over a long journey, on-ear on the compromise between them. Isolation depends on the specific pair rather than the shape.',
    state: 'Depends heavily on design',
    tone: 'warn',
  },
  {
    n: 'Flights',
    d: 'Over-ear and in-ear are both common here and both can be excellent. The deciding factors are usually whether you want to sleep in them and how much bag space you are willing to give up.',
    state: 'Depends heavily on design',
    tone: 'warn',
  },
  {
    n: 'Exercise and movement',
    d: 'In-ear tends to suit this: light, stable when the tip fits, and unaffected by a headband shifting. Over-ear and on-ear move as you do and trap heat while you generate it.',
    state: 'Often a good fit',
    tone: 'ok',
  },
  {
    n: 'Compact carry',
    d: 'In-ear, with very little argument. This is the one dimension where the category genuinely decides the answer and implementation barely matters.',
    state: 'Often a good fit',
    tone: 'ok',
  },
  {
    n: 'A shared office',
    d: 'Leakage is about the seal and the volume, not about the shape. A poorly sealed in-ear at high volume leaks to your neighbour as surely as an open-backed over-ear does. Judge the specific pair.',
    state: 'Depends heavily on design',
    tone: 'warn',
  },
  {
    n: 'Hot environments',
    d: 'Anything enclosing the ear traps heat. In-ear avoids the problem; on-ear reduces it relative to over-ear; fabric pads help more than leather ones.',
    state: 'Usually less convenient for over-ear',
    tone: 'muted',
  },
  {
    n: 'You dislike things in your ear',
    d: 'A completely sufficient reason to rule out in-ear, and it does not need justifying. Comfort you will not tolerate is not comfort, whatever a measurement says.',
    state: 'Rule it out and move on',
    tone: 'muted',
  },
];

const CHOOSE_OVER_EAR = [
  'You listen for hours at a time in one place and comfort over a long session matters most',
  'You want the weight carried by your head rather than by your ears or your ear canals',
  'You dislike the sensation of anything inside the ear',
  'You have somewhere to put them, and the room is not usually hot',
  'You wear glasses and want a pad that can close around the arm rather than press it in',
];

const CHOOSE_ON_EAR = [
  'You want something smaller and cooler than an over-ear without going into the ear canal',
  'You have tried them and know your ears tolerate pressure resting on them',
  'You want to stay partly aware of the room without relying on a transparency mode',
  'Portability matters, but not enough to accept eartips',
];

const CHOOSE_IN_EAR = [
  'Carrying size is a real constraint — a pocket rather than a bag',
  'You move while listening: exercise, commuting on foot, working around a building',
  'You wear glasses, hats or helmets and want no interaction with any of them',
  'You have found a tip that seals comfortably, which is the thing to establish first',
];

const CHECKLIST = [
  'Decide where you will actually listen, not where you imagine listening',
  'Settle the physical objections first — canal sensation, pressure on the ear, bag space',
  'For over-ear, check the pad opening against your own ear rather than trusting the category name',
  'For in-ear, treat the supplied tip range as a feature, because the seal is the whole product',
  'Separate isolation from noise cancelling before comparing any two pairs',
  'Ignore price as a quality signal — across 283 measured headphones it predicted nothing',
  'Buy where the return window outlasts a genuine week of use',
];

const FAQ = [
  {
    q: 'Are over-ear headphones better than in-ear headphones?',
    a: 'Not as a category. They are better at some things — carrying weight on your head rather than in your ear, staying comfortable through a long seated session — and worse at others, chiefly size, heat and movement. The largest study to measure this compared 283 headphones across all three shapes and found the differences between categories slight next to the differences within them. Choose the shape that suits where you listen, then judge the pair.',
  },
  {
    q: 'Are on-ear headphones more comfortable than over-ear?',
    a: 'They are lighter and cooler, and they put the pressure on your ear instead of around it. Whether that is more comfortable depends on you, and it varies between people more than the other two shapes do. Anyone who tells you on-ear is comfortable or uncomfortable in general is describing their own ears.',
  },
  {
    q: 'Which type is better for travel?',
    a: 'In-ear if bag space is the constraint; over-ear if comfort across several hours matters more than volume in your luggage. Both are used constantly for this and both work. The honest tiebreaker is usually whether you want to sleep in them.',
  },
  {
    q: 'Which type blocks more noise?',
    a: 'The seal blocks noise, not the shape. An over-ear seals against your head, an in-ear seals in your ear canal, and an on-ear does neither completely because it rests on the ear. That gives on-ear the least enclosed seal by construction, but a well-fitted in-ear and a well-fitted over-ear are both capable of a great deal, and either one with a broken seal is capable of very little.',
  },
  {
    q: 'Do over-ear headphones have better noise cancelling?',
    a: 'Not automatically, and the question hides a common confusion. What you experience is the total of the physical seal plus whatever the electronics remove, and the measurement standards treat those as two separate quantities. A large earcup can be doing most of the work while the cancellation system does relatively little. How much of a figure belongs to which is covered on our page about how noise cancelling is measured.',
  },
  {
    q: 'Are in-ear headphones better for exercise?',
    a: 'They tend to suit it, for physical rather than acoustic reasons: they are light, they do not trap heat against your head, and a tip that fits stays put while you move. The condition is the tip. An in-ear that works loose during a run is worse for exercise than anything else on this page.',
  },
  {
    q: 'Which type is better if I wear glasses?',
    a: 'In-ear avoids the interaction completely. Among the others, an over-ear with a soft pad that can close around the arm of the glasses generally handles it better than an on-ear, which presses the arm against your head. This is a fit question, and it is worth testing with your own frames rather than reading about.',
  },
  {
    q: 'Does headphone type determine sound quality?',
    a: 'No. A study measuring 283 headphones from about four dollars to over five thousand looked specifically for correlations between type, price and frequency response. In-ear models measured slightly more bass than other types, and in-ear and over-ear models sat slightly closer to a reference curve than on-ear ones — but those effects were slight, and price correlated with nothing at all. Tuning, acoustic design and how well the thing seals on your head dominate the category it belongs to.',
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
      name: 'Over-ear vs on-ear vs in-ear',
      item: `${BASE}/guides/over-ear-vs-on-ear-vs-in-ear`,
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

export default function FormFactorGuidePage() {
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
            <a href="/guides/over-ear-headphones">Buying guide</a>
            <a className="active" href="/guides/over-ear-vs-on-ear-vs-in-ear">
              Which shape?
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
                <span aria-current="page">Over-ear vs on-ear vs in-ear</span>
              </li>
            </ol>
          </nav>
        </div>

        {/* 1 — hero: answer immediately */}
        <section className="hero" style={{ borderTop: 0 }}>
          <div className="wrap">
            <span className="pill-eyebrow">
              <span aria-hidden="true">✦</span>
              <p className="eyebrow">Decision guide · headphone shapes</p>
            </span>
            <h1 className="hero-h1" style={{ maxWidth: '24ch' }}>
              <span className="h1-underlined">Over-ear, on-ear</span> <em>or</em> in-ear:
              which fits you?
            </h1>
            <p className="lede" style={{ marginTop: 24 }}>
              There is no winner, and anyone who names one is describing their own ears. What the
              three shapes reliably differ on is <b>size</b>, <b>where the weight sits</b> and{' '}
              <b>how the seal is made</b> — so the useful question is not which is best but which
              set of trade-offs matches where you actually listen.
            </p>
            <p className="lede">
              Over-ear for long sessions in one place. In-ear when carrying size or movement is the
              constraint. On-ear when you want something between the two and your ears tolerate
              pressure resting on them. The rest of this page is the reasoning, and the exceptions.
            </p>
            <p className="prelaunch" style={{ maxWidth: '58ch' }}>
              <b>This page picks a shape, not a product.</b> If you have already settled on over-ear
              and want to know what separates one pair from another, that is the{' '}
              <a href="/guides/over-ear-headphones">over-ear buying guide</a>.
            </p>
          </div>
        </section>

        {/* 2 — the short answer */}
        <section id="short-answer">
          <div className="wrap">
            <div className="sec-head">
              <p className="eyebrow">01 · The short answer</p>
              <h2>The shape decides the constraints. It does not decide the quality.</h2>
            </div>
            <div className="card rule-card">
              <p className="rule-quote">
                Choosing a category tells you <b>how big the thing will be</b>, <b>what part of you
                carries it</b> and <b>how it will try to seal</b>. It does not tell you how good any
                particular pair is going to be.
              </p>
              <p className="muted">
                That is not a hedge, it is the finding. When 283 headphones from about four dollars
                to over five thousand were measured together, the differences between the three
                categories turned out to be slight next to the differences within them — and retail
                price predicted neither the measured response nor an objective estimate of quality.
                So settle the shape on practical grounds, then judge the pair on its own.
              </p>
            </div>
          </div>
        </section>

        {/* 3 — definitions */}
        <section id="shapes">
          <div className="wrap">
            <div className="sec-head">
              <p className="eyebrow">02 · What the three actually mean</p>
              <h2>Defined by what they touch.</h2>
              <p>
                The names describe geometry, and the geometry is where every later difference comes
                from.
              </p>
            </div>
            <div className="comp-list">
              {SHAPES.map((s) => (
                <div className="comp card" key={s.k}>
                  <h3>{s.k}</h3>
                  <p>{s.v}</p>
                </div>
              ))}
            </div>
            <p className="note">
              Worth noticing in the first definition: an over-ear whose cups are not deep or wide
              enough for your ears behaves like an on-ear, with none of the on-ear&rsquo;s
              compensating lightness. The category on the box is a claim about design intent, not a
              measurement of your head.
            </p>
          </div>
        </section>

        {/* 4 — the real differences */}
        <section id="differences">
          <div className="wrap">
            <div className="sec-head">
              <p className="eyebrow">03 · The differences that matter most</p>
              <h2>Four that are genuinely properties of the shape.</h2>
              <p>
                Everything else you will read compared between these categories is mostly a
                comparison of particular products.
              </p>
            </div>
            <div className="comp-list">
              {DIFFERENCES.map((d) => (
                <div className="comp card" key={d.k}>
                  <h3>{d.k}</h3>
                  <p>{d.v}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* 5 — comfort */}
        <section id="comfort">
          <div className="wrap">
            <div className="sec-head">
              <p className="eyebrow">04 · Comfort and physical fit</p>
              <h2>Three different problems, not three degrees of one.</h2>
              <p>
                Comfort is the most individual thing on this page and the least predictable from a
                specification.
              </p>
            </div>
            <div className="comp-list">
              {COMFORT.map((c) => (
                <div className="comp card" key={c.k}>
                  <h3>{c.k}</h3>
                  <p>{c.v}</p>
                </div>
              ))}
            </div>
            <p className="note">
              Fit is not only a comfort question. A leak between the device and your ear makes the
              low frequencies fall away, and the bigger the leak the higher up the range that fall
              begins — which is why the same pair can sound thin on one person and full on another,
              with nothing wrong with either of them.
            </p>
          </div>
        </section>

        {/* 6 — isolation vs ANC */}
        <section id="isolation">
          <div className="wrap">
            <div className="sec-head">
              <p className="eyebrow">05 · Isolation is not the same thing as ANC</p>
              <h2>Two mechanisms, routinely discussed as one.</h2>
            </div>
            <div className="card rule-card">
              <p className="rule-quote">
                <b>Passive isolation</b> is the physical seal keeping sound out. <b>Active noise
                cancellation</b> is electronics removing what gets through. What you experience is
                the total, and the measurement standards treat the two as separate quantities that
                have to be combined.
              </p>
              <p className="muted">
                Two consequences worth carrying into a shop. Over-ear does not imply ANC, and in-ear
                does not imply passive-only — all three shapes exist in both forms. And a headline
                figure quoted for a pair may be describing the total, not the part the electronics
                contribute, which is why two numbers from two manufacturers often are not comparing
                the same thing.
              </p>
            </div>
            <p className="note">
              How the cancellation itself works is explained in{' '}
              <a href="/guides/how-anc-works">how noise cancelling actually works</a>, and what a
              &ldquo;-XX dB&rdquo; claim does and does not measure is covered in{' '}
              <a href="/guides/how-noise-cancelling-is-measured">
                how noise cancelling is measured
              </a>
              . Neither is repeated here.
            </p>
            <p className="note">
              One safety point, because it is often attached to the wrong variable. Hearing risk
              tracks how loud you listen and for how long, not which shape you chose: the WHO and
              ITU safe-listening standard puts the adult reference at 80 dB for up to 40 hours a
              week, and around 90 dB that weekly allowance falls to roughly four hours. The reason
              WHO mentions well-fitting and noise-cancelling headphones at all is indirect — by
              lowering the background, they remove the reason to turn the volume up. No form factor
              is inherently safe or unsafe.
            </p>
          </div>
        </section>

        {/* 7 — sound */}
        <section id="sound">
          <div className="wrap">
            <div className="sec-head">
              <p className="eyebrow">06 · Sound quality: form factor is not destiny</p>
              <h2>The category is a weak predictor. Price is a worse one.</h2>
            </div>
            <div className="card rule-card">
              <p className="rule-quote">
                Across 283 measured headphones the categories did differ a little: in-ear models
                measured <b>slightly</b> more bass than the others, and in-ear and over-ear models
                sat <b>slightly</b> closer to a reference curve than on-ear ones. The word doing the
                work in both cases is <b>slightly</b>.
              </p>
              <p className="muted">
                &ldquo;Slightly more measured bass&rdquo; is also not the same statement as
                &ldquo;better bass&rdquo; — one is a measurement, the other is a preference. What
                dominates instead is tuning, acoustic design and how well the thing happens to seal
                on your particular head. And the proxy most people reach for does not help: in the
                same measurements, retail price correlated with neither the response nor an
                objective estimate of quality, across a range from about four dollars to over five
                thousand.
              </p>
            </div>
          </div>
        </section>

        {/* 8 — portability */}
        <section id="portability">
          <div className="wrap">
            <div className="sec-head">
              <p className="eyebrow">07 · Portability and daily carry</p>
              <h2>The one dimension the category really does decide.</h2>
            </div>
            <div className="card blind" style={{ maxWidth: 760 }}>
              <h3>What carrying each one is actually like</h3>
              <ul className="tick-list">
                <li>In-ear goes in a pocket, and the case is usually smaller than a wallet</li>
                <li>On-ear folds smaller than an over-ear and is lighter to carry all day</li>
                <li>
                  Over-ear needs bag space; folding designs reduce it but the hinge is also the most
                  common mechanical failure point
                </li>
                <li>
                  Exceptions exist in both directions — unusually large earbud cases, unusually flat
                  over-ears — so check dimensions rather than assuming the category
                </li>
                <li>
                  If it is inconvenient to carry, you will leave it at home, and the best headphone
                  is the one you have with you
                </li>
              </ul>
            </div>
          </div>
        </section>

        {/* 9 — situations */}
        <section id="situations">
          <div className="wrap">
            <div className="sec-head">
              <p className="eyebrow">08 · Where each one tends to fit</p>
              <h2>Tendencies, with the caveat attached.</h2>
              <p>
                No scores, because a score would imply a precision none of this has. Where the
                honest answer is &ldquo;it depends on the pair&rdquo;, the table says so.
              </p>
            </div>
            <div className="fresh-table" role="table" aria-label="Which shape tends to suit which situation">
              <div className="fresh-head" role="row">
                <span role="columnheader">Situation</span>
                <span role="columnheader">What tends to suit it</span>
                <span role="columnheader">Confidence</span>
              </div>
              {SITUATIONS.map((s) => (
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
          </div>
        </section>

        {/* 10 — who should choose what */}
        <section id="choose">
          <div className="wrap">
            <div className="sec-head">
              <p className="eyebrow">09 · Which should you choose?</p>
              <h2>Read the list that describes your week.</h2>
            </div>
            <div className="card blind" style={{ maxWidth: 760 }}>
              <h3>Choose over-ear if</h3>
              <ul className="tick-list">
                {CHOOSE_OVER_EAR.map((c) => (
                  <li key={c}>{c}</li>
                ))}
              </ul>
            </div>
            <div className="card blind" style={{ maxWidth: 760, marginTop: 20 }}>
              <h3>Choose on-ear if</h3>
              <ul className="tick-list">
                {CHOOSE_ON_EAR.map((c) => (
                  <li key={c}>{c}</li>
                ))}
              </ul>
            </div>
            <div className="card blind" style={{ maxWidth: 760, marginTop: 20 }}>
              <h3>Choose in-ear if</h3>
              <ul className="tick-list">
                {CHOOSE_IN_EAR.map((c) => (
                  <li key={c}>{c}</li>
                ))}
              </ul>
            </div>
            <p className="note">
              If you land on over-ear, the next question is which one — and what separates them is
              mostly not what the box advertises. That is the{' '}
              <a href="/guides/over-ear-headphones">over-ear buying guide</a>.
            </p>
          </div>
        </section>

        {/* 11 — limits of the category label */}
        <section id="limits">
          <div className="wrap">
            <div className="sec-head">
              <p className="eyebrow">10 · When the category label tells you too little</p>
              <h2>The shape is a constraint, not a promise.</h2>
            </div>
            <div className="card rule-card">
              <p className="rule-quote">
                Every claim on this page describes a <b>tendency of a design</b>. None of them
                describes a guarantee about a product, and the gap between those two things is where
                most disappointment lives.
              </p>
              <p className="muted">
                A shallow over-ear presses on your ears. An in-ear with no tip that fits you seals
                badly and sounds thin. An on-ear with gentle clamp and soft pads can be comfortable
                for hours while another is unbearable in twenty minutes. A cheap pair can measure
                well and an expensive one badly — that was the whole finding of the 283-headphone
                measurement. Pick the shape on the practical grounds above, then judge the specific
                pair on evidence, and keep a return window long enough to be wrong.
              </p>
            </div>
          </div>
        </section>

        {/* 12 — checklist */}
        <section id="checklist">
          <div className="wrap">
            <div className="sec-head">
              <p className="eyebrow">11 · The short version</p>
              <h2>Seven things to settle before buying.</h2>
            </div>
            <div className="card blind" style={{ maxWidth: 760 }}>
              <h3>In roughly this order</h3>
              <ul className="tick-list">
                {CHECKLIST.map((c) => (
                  <li key={c}>{c}</li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        {/* 13 — FAQ */}
        <section id="faq">
          <div className="wrap">
            <div className="sec-head">
              <p className="eyebrow">12 · Questions</p>
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
              <h2>Shape now, comparisons when the data is real.</h2>
              <p>
                We are not naming models, because ranking requires data we can verify and do not
                have. When live offers exist they will be ranked by the published method — totals,
                commission-blind, nothing unverified.
              </p>
              <div className="hero-cta" style={{ justifyContent: 'center', marginTop: 28 }}>
                <a className="btn btn-primary" href="/#cta">
                  Join the waitlist →
                </a>
                <a className="btn btn-ghost" href="/guides/over-ear-headphones">
                  Choosing over-ears
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
