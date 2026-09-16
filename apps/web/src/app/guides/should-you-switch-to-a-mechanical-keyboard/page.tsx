import type { Metadata } from 'next';

import { SiteFooter } from '@/components/SiteFooter';

/*
 * /guides/should-you-switch-to-a-mechanical-keyboard — the decision, not the choice.
 *
 * WHY THIS IS NOT PART OF /guides/mechanical-keyboard. That page assumes the
 * decision is already made and answers "which one": switch families, what
 * separates boards, layout, and seven purchase checks. It never addresses the
 * question that comes before it — whether someone typing happily on a laptop
 * or a membrane keyboard should move at all, and what they would actually
 * notice if they did. The word "membrane" does not appear on that page, nor
 * does key travel, keyboard height, desk depth, or the adaptation period of
 * moving between keyboard types.
 *
 * DELIBERATE NON-COVERAGE. Switch families, layout sizes, stabilisers,
 * mounting and the buying checklist belong to the existing guide and are
 * summarised here in a sentence at most, with a link. This page does not
 * re-teach any of them. If a section here starts to read like switch
 * selection, it has drifted and should be cut rather than expanded.
 *
 * GSC EVIDENCE, STATED HONESTLY. /guides/mechanical-keyboard carries 38
 * measured impressions with roughly 16 visible query impressions, all of them
 * "how to choose"-shaped: "how to pick a mechanical keyboard", "how to choose
 * a keyboard", "how to choose a mechanical keyboard", "what to look for when
 * buying a mechanical keyboard", "mechanical keyboard how to choose". There is
 * NO measured query evidence for "should I switch to a mechanical keyboard" or
 * any equivalent, and none is claimed. The rationale is proven page-level
 * interest in the category, an orphaned single-page cluster, and a distinct
 * adjacent decision intent — not demonstrated keyword demand.
 *
 * TRUTH RULE FOR THIS FILE: no models, no brands, no prices, no merchants, no
 * rankings, and — most importantly for this topic — no promises. The category
 * is full of claims that a mechanical keyboard makes people type faster, more
 * accurately, or more comfortably. Those are outcome claims, and the measured
 * evidence does not support stating them as general results:
 *
 *   - Travel distances: scissor switches used in laptops run roughly 1–2.5 mm
 *     total travel (around 1 mm actuation); full-travel membrane and mechanical
 *     keyboards are around 4 mm. Short-travel keyboards make it difficult to
 *     avoid bottoming out on every keystroke, where full travel leaves some
 *     buffer. Source for §02 and §04.
 *   - The closest thing to a direct measurement of this page's question is a
 *     19-subject study comparing a virtual keyboard (0 mm travel), a notebook
 *     keyboard (1.8 mm) and a desktop keyboard (4 mm). Accuracy was 95 per cent
 *     on BOTH the notebook and desktop keyboards; the virtual keyboard was the
 *     outlier at 84 per cent. On self-reported comfort, productivity and
 *     preference there were NO differences between the notebook and desktop
 *     keyboards — the notebook rated best for arm and shoulder comfort, the
 *     desktop best for ease of use, speed, accuracy and adaptation time.
 *     ("Differences in typing forces, muscle activity, comfort, and typing
 *     performance among virtual, notebook, and desktop keyboards", Applied
 *     Ergonomics.) This is the source for §03 and §04. IMPORTANT: the 4 mm
 *     "desktop keyboard" is a full-travel desktop board, not necessarily a
 *     mechanical one, so it is described here as a travel-and-form-factor
 *     comparison and never as a mechanical-versus-membrane result.
 *   - A 20-subject study of four micro-travel devices (0.55, 1.3 and 1.6 mm;
 *     dome, scissor and butterfly mechanisms) concluded that key travel alone
 *     does not predict typing force or muscle activity — the switch mechanism
 *     matters too. ("Going Short: The Effects of Short-Travel Key Switches on
 *     Typing Performance, Typing Force, Forearm Muscle Activity, and User
 *     Experience", Journal of Applied Biomechanics.) Source for the refusal in
 *     §03 and §06 to turn "more travel" into an ergonomic promise.
 *
 * No ergonomic or medical benefit is asserted anywhere on this page. Nothing is
 * said about wrist pain, injury or prevention, because that is a clinical claim
 * and nothing here supports one.
 *
 * SOURCING CONVENTION: follows /guides/ssd-best-practices and
 * /guides/how-noise-cancelling-is-measured — sources recorded here for
 * reviewers, no visible citations section and no external link on the page,
 * because no guide on this site has one.
 */

const BASE = 'https://honesttotal.com';

export const metadata: Metadata = {
  title: 'Should you switch to a mechanical keyboard? What actually changes — HonestTotal',
  description:
    'Not a buying guide: the decision before it. What genuinely feels different coming from a laptop or membrane keyboard, what a mechanical board does not automatically improve, whether it has to be loud, and who is better off keeping what they have.',
  alternates: { canonical: '/guides/should-you-switch-to-a-mechanical-keyboard' },
  openGraph: {
    type: 'article',
    url: `${BASE}/guides/should-you-switch-to-a-mechanical-keyboard`,
    title: 'Should you switch to a mechanical keyboard?',
    description:
      'What actually changes, what does not, and who is genuinely better off staying with the keyboard they already have.',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Should you switch to a mechanical keyboard?',
    description: 'What changes, what does not, and who should not bother.',
  },
};

/** The differences that are real and that people actually report noticing. */
const DIFFERENCES = [
  {
    k: 'Consistency across the board',
    v: 'Every key has its own switch, so the key under your little finger behaves like the one under your index finger. On cheaper membrane boards the edges of the keyboard can feel mushier than the middle, and that unevenness is the thing people most often notice disappearing.',
  },
  {
    k: 'Travel, and what it buys',
    v: 'Laptop-style scissor switches run roughly 1 to 2.5 mm of total travel; a full-travel keyboard is around 4 mm. The practical consequence is not speed — it is that a short-travel key is almost impossible to press without bottoming out, while longer travel leaves a margin where the key has registered and you have not yet hit the bottom.',
  },
  {
    k: 'A defined actuation point',
    v: 'Many switches tell you, through a bump or a sound, that the key has registered. Whether you want that is genuinely a preference: some typists use it to press more lightly, others never notice it and press to the floor regardless.',
  },
  {
    k: 'Repairability',
    v: 'A failed key on a membrane board usually means a new keyboard. On a mechanical board it means one switch, and on a hot-swap board it means one switch and no soldering iron. This is the least glamorous difference and, over years, often the most valuable one.',
  },
];

/** The honest myth section. Outcome claims the evidence does not support. */
const NOT_IMPROVED = [
  {
    n: 'Typing speed',
    d: 'There is no general result showing that a mechanical keyboard makes people type faster. Where full-travel and laptop-style keyboards have been compared directly, the gap in measured performance was small, and long-term speed tracks practice and technique rather than hardware.',
    state: 'Not a general outcome',
    tone: 'warn',
  },
  {
    n: 'Accuracy',
    d: 'In the clearest measured comparison of a notebook keyboard against a full-travel desktop keyboard, accuracy was 95 per cent on both. Typists who feel more accurate on a new board are describing a real experience; it is not the same as a measured accuracy gain.',
    state: 'Measured as equal',
    tone: 'warn',
  },
  {
    n: 'Gaming performance',
    d: 'Input latency at this end of the chain is far below what the display, the engine and human reaction time contribute. A keyboard can absolutely feel better to game on. That is a different claim from playing better.',
    state: 'Feel, not results',
    tone: 'muted',
  },
  {
    n: 'Comfort and ergonomics',
    d: 'We do not make this claim. Studies of short-travel keyboards found that travel distance alone did not predict typing force or muscle activity — the switch mechanism mattered too — and in the notebook-versus-desktop comparison the notebook board actually rated best for arm and shoulder comfort. Posture, desk height and how you rest your hands dominate anything the keyboard contributes.',
    state: 'No claim made',
    tone: 'danger',
  },
  {
    n: 'Productivity',
    d: 'A keyboard you enjoy using is a pleasant thing to own and may well make a working day feel better. Nothing measured supports turning that into an output claim, and this page will not pretend otherwise.',
    state: 'Not a general outcome',
    tone: 'muted',
  },
];

/** For the reader most likely to be asking: someone on a laptop. */
const FROM_LAPTOP = [
  {
    k: 'The adaptation fortnight',
    v: 'Moving between keyboard types costs accuracy for a while, in both directions. Fingers trained on 1.5 mm of travel will bottom out hard on 4 mm at first. It passes, but judge a new keyboard after two weeks rather than two hours — and buy somewhere with a return window that outlasts the adjustment.',
  },
  {
    k: 'Height is the real change',
    v: 'A standard mechanical keyboard is considerably taller than a laptop deck, which raises your hands. Whether that is better, worse or irrelevant depends on your desk and chair, not on the keyboard. Some people add a wrist rest; others lower the desk; some notice nothing at all.',
  },
  {
    k: 'Low profile exists',
    v: 'Low-profile mechanical switches have shorter travel than the roughly 4 mm standard and sit much closer to the desk. If the appeal is per-key switches and repairability rather than deep travel, this is the option most people do not know they have — and it removes most of the height objection.',
  },
  {
    k: 'Desk depth and portability',
    v: 'An external keyboard needs somewhere to live, and the laptop then needs raising if you want the screen at a sensible height. On a small desk this is a real constraint. If you work in several places each week, it is a bag item you will carry or a keyboard you will only sometimes use.',
  },
];

/** Sound, without re-teaching the switch taxonomy from the buying guide. */
const SOUND = [
  'Mechanical does not mean loud — one switch family is built to click and the others are not',
  'The case, plate and internal foam shape the sound more than the switch does',
  'Keycap plastic and thickness change the pitch of every keystroke',
  'Stabilisers under the long keys are what rattle, and rattle is what carries across a room',
  'How hard you type is a genuine variable, and the one nobody accounts for',
  'A shared office is a real constraint — judge it from a sound test of the exact board, not the switch name',
];

/** What hot-swap actually means, at consumer level. */
const CUSTOM = [
  {
    k: 'Hot-swap is not universal',
    v: 'Plenty of mechanical keyboards have their switches soldered in. Hot-swap sockets are a specific feature to look for, not something the category guarantees, and a board without them makes the switch choice effectively permanent.',
  },
  {
    k: 'Switches are not all interchangeable',
    v: 'Pin layouts and stem designs differ, and a socket that takes one style may not take another. It is worth checking what a specific board accepts before assuming any switch will drop in.',
  },
  {
    k: 'Keycaps are the easy change',
    v: 'Changing keycaps needs no tools beyond a puller and alters both look and sound. It is the lowest-effort customisation and the one most owners actually do.',
  },
  {
    k: 'Remapping matters more than it sounds',
    v: 'Moving keys around in software is free, reversible, and fixes more daily irritations than any hardware change. Whether the settings live on the board or in an app that must be running is worth knowing before you buy.',
  },
];

const BENEFITS = [
  'You type for hours a day and have started noticing the keyboard rather than the work',
  'Your current board feels uneven — some keys mushy, some not — and that unevenness bothers you',
  'You want to repair rather than replace, and expect to keep the thing for years',
  'You want to remap keys, change keycaps, or tune the feel over time',
  'You already know you dislike something specific about your current keyboard and can name it',
];

const STAY_PUT = [
  'Your current keyboard is not bothering you — that is a complete answer, not a lack of one',
  'You share a room or an office and cannot easily test how the board will sound in it',
  'You want faster typing or better gaming results, because that is not what this buys',
  'Desk space is tight, or you move between locations often enough that portability wins',
  'You are hoping it will fix discomfort — desk height, chair and posture are the larger variables, and a keyboard is an expensive way to test a guess',
];

const FAQ = [
  {
    q: 'Is a mechanical keyboard actually worth switching to?',
    a: 'It is worth it if you want consistency, repairability and the ability to change how the keyboard feels over time, and if you type enough for those to matter. It is not worth it if you are expecting measurable gains in speed, accuracy or comfort, because the evidence does not support promising those. A keyboard that is not bothering you is a legitimate reason to keep it.',
  },
  {
    q: 'Will I type faster on a mechanical keyboard?',
    a: 'Probably not because of the keyboard. There is no general result showing a speed gain from switching, and where full-travel and laptop-style keyboards have been compared the measured difference was small. Typing speed is mostly technique and practice. You may well type faster after a year — that will be the practice.',
  },
  {
    q: 'Will my typing be more accurate?',
    a: 'In the clearest direct comparison, accuracy was 95 per cent on both a notebook keyboard and a full-travel desktop keyboard. Expect a temporary dip while you adapt to the new travel, then a return to roughly where you were. Feeling more precise is real and worth something; it is not the same as measuring more precise.',
  },
  {
    q: 'Are mechanical keyboards always loud?',
    a: 'No. One switch family is designed to click and is genuinely disruptive in a shared room; the others are not. Beyond that the case, plate, keycaps, stabilisers and how hard you type shape the sound far more than the switch name does, which is why a sound test of the specific board is worth more than any general answer.',
  },
  {
    q: 'I use a laptop — is a mechanical keyboard better for me?',
    a: 'It is different rather than automatically better. You gain travel, consistency and repairability; you take on height, desk space and a couple of weeks of adjustment. In the one careful comparison of a notebook keyboard against a full-travel desktop one, the notebook actually rated best for arm and shoulder comfort while the desktop rated best for ease of use. Low-profile mechanical boards sit between the two if the height is the sticking point.',
  },
  {
    q: 'Will it help with wrist discomfort?',
    a: 'We are not going to tell you it will. That is a clinical question and nothing here supports an answer to it. What can be said is that studies of key travel found travel alone did not predict typing force or muscle activity, and that desk height, chair and hand position are larger variables than which keyboard is on the desk. If discomfort is the reason you are shopping, that is worth addressing directly rather than by buying hardware.',
  },
  {
    q: 'How long does it take to get used to one?',
    a: 'Give it two weeks of normal use before judging. The first days after any change in key travel feel clumsy in both directions, and a compact layout adds its own adjustment on top. This is the main reason a generous return window is worth more than most specifications.',
  },
  {
    q: 'If I switch, what should I actually look for?',
    a: 'That is a different question, and it has its own page. Briefly: the parts that decide the experience are the ones nobody advertises — stabilisers, mounting and keycap plastic — while the switch, on a hot-swap board, is the decision you can reverse in an afternoon. Our mechanical keyboard buying guide covers the criteria in order.',
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
      name: 'Should you switch to a mechanical keyboard?',
      item: `${BASE}/guides/should-you-switch-to-a-mechanical-keyboard`,
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

export default function ShouldYouSwitchKeyboardPage() {
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
            <a href="/guides/mechanical-keyboard">Buying guide</a>
            <a className="active" href="/guides/should-you-switch-to-a-mechanical-keyboard">
              Should you switch?
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
                <span aria-current="page">Should you switch to a mechanical keyboard?</span>
              </li>
            </ol>
          </nav>
        </div>

        {/* 1 — hero: answer in the first sentence */}
        <section className="hero" style={{ borderTop: 0 }}>
          <div className="wrap">
            <span className="pill-eyebrow">
              <span aria-hidden="true">✦</span>
              <p className="eyebrow">Decision guide · keyboards</p>
            </span>
            <h1 className="hero-h1" style={{ maxWidth: '24ch' }}>
              <span className="h1-underlined">Should you switch</span> to a{' '}
              <em>mechanical</em> keyboard?
            </h1>
            <p className="lede" style={{ marginTop: 24 }}>
              If your current keyboard is not bothering you, no. That is the honest answer and it
              is not a cautious one — switching buys consistency, repairability and the ability to
              change how the thing feels, and it does not reliably buy speed, accuracy or comfort.
            </p>
            <p className="lede">
              If you type for hours a day, have started noticing the keyboard rather than the work,
              or want to keep and repair one thing for years, it is a genuinely good change. This
              page is about telling those two situations apart.
            </p>
            <p className="prelaunch" style={{ maxWidth: '58ch' }}>
              <b>This is the decision, not the choice.</b> Once you have decided, which switches,
              which layout and what actually separates boards are covered in the{' '}
              <a href="/guides/mechanical-keyboard">mechanical keyboard buying guide</a>.
            </p>
          </div>
        </section>

        {/* 2 — the short answer */}
        <section id="short-answer">
          <div className="wrap">
            <div className="sec-head">
              <p className="eyebrow">01 · The short answer</p>
              <h2>A better object, not a better outcome.</h2>
            </div>
            <div className="card rule-card">
              <p className="rule-quote">
                What you are buying is a keyboard that is <b>more consistent</b>, <b>repairable</b>{' '}
                and <b>changeable</b>. What you are not buying is a measurable improvement in how
                fast or how accurately you type.
              </p>
              <p className="muted">
                Both halves of that sentence matter. The first is why people who switch rarely go
                back. The second is why the category&rsquo;s marketing is worth reading sceptically
                — and why someone perfectly happy with the keyboard in front of them is not missing
                anything they can measure.
              </p>
            </div>
          </div>
        </section>

        {/* 3 — what actually feels different */}
        <section id="different">
          <div className="wrap">
            <div className="sec-head">
              <p className="eyebrow">02 · What actually feels different</p>
              <h2>Four changes that are real.</h2>
              <p>
                These are properties of the hardware rather than promises about what you will
                achieve with it.
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
            <p className="note">
              Note what is absent from that list: which switch to pick. It is the famous decision
              and, on a hot-swap board, the one you can reverse in an afternoon — the{' '}
              <a href="/guides/mechanical-keyboard">buying guide</a> makes the case for why the
              unadvertised parts matter more.
            </p>
          </div>
        </section>

        {/* 4 — the myth section */}
        <section id="not-improved">
          <div className="wrap">
            <div className="sec-head">
              <p className="eyebrow">03 · What does not automatically improve</p>
              <h2>Preference and performance are not the same thing.</h2>
              <p>
                A keyboard can be more pleasant to use and change nothing you could measure. Most
                of this category&rsquo;s overclaiming lives in the gap between those two ideas.
              </p>
            </div>
            <div
              className="fresh-table"
              role="table"
              aria-label="What a mechanical keyboard does not automatically improve"
            >
              <div className="fresh-head" role="row">
                <span role="columnheader">Claim</span>
                <span role="columnheader">What can honestly be said</span>
                <span role="columnheader">Status</span>
              </div>
              {NOT_IMPROVED.map((m) => (
                <div className="fresh-row" role="row" key={m.n}>
                  <span role="cell">
                    <b className={`fstate f-${m.tone}`}>{m.n}</b>
                  </span>
                  <span role="cell">{m.d}</span>
                  <span role="cell" className={`frank fr-${m.tone}`}>
                    {m.state}
                  </span>
                </div>
              ))}
            </div>
            <p className="note">
              None of this is an argument against mechanical keyboards. Liking the thing you touch
              for six hours a day is a perfectly good reason to buy it. It stops being a good
              reason the moment it is sold as something else.
            </p>
          </div>
        </section>

        {/* 5 — coming from a laptop */}
        <section id="from-laptop">
          <div className="wrap">
            <div className="sec-head">
              <p className="eyebrow">04 · Coming from a laptop keyboard</p>
              <h2>The largest change is not the switches.</h2>
              <p>
                Most people asking this question are typing on a laptop now. That move has its own
                set of consequences, and they are mostly physical rather than tactile.
              </p>
            </div>
            <div className="comp-list">
              {FROM_LAPTOP.map((f) => (
                <div className="comp card" key={f.k}>
                  <h3>{f.k}</h3>
                  <p>{f.v}</p>
                </div>
              ))}
            </div>
            <p className="note">
              Worth knowing before you spend: in the clearest study comparing a notebook keyboard
              with a full-travel desktop one, typing accuracy was <b>95 per cent on both</b>, and
              self-reported comfort, productivity and preference showed no difference between them.
              The desktop board rated better for ease of use and adaptation; the notebook rated
              better for arm and shoulder comfort. The gap is smaller than the category implies.
            </p>
          </div>
        </section>

        {/* 6 — sound */}
        <section id="sound">
          <div className="wrap">
            <div className="sec-head">
              <p className="eyebrow">05 · Is it necessarily louder?</p>
              <h2>No — but it can be, and that is on you to check.</h2>
            </div>
            <div className="card blind" style={{ maxWidth: 760 }}>
              <h3>What actually decides how a keyboard sounds</h3>
              <ul className="tick-list">
                {SOUND.map((s) => (
                  <li key={s}>{s}</li>
                ))}
              </ul>
            </div>
            <p className="note">
              If you share a room, this is the single constraint most likely to turn a good purchase
              into a regretted one. It is also the most fixable, since it is decided before you buy
              rather than after.
            </p>
          </div>
        </section>

        {/* 7 — height and desk */}
        <section id="desk">
          <div className="wrap">
            <div className="sec-head">
              <p className="eyebrow">06 · Height, comfort and the desk</p>
              <h2>The keyboard is one variable among several.</h2>
            </div>
            <div className="card rule-card">
              <p className="rule-quote">
                A standard mechanical keyboard raises your hands relative to a laptop deck. Whether
                that helps, hurts or changes nothing depends on <b>desk height, chair height and
                how you hold your hands</b> — none of which are properties of the keyboard.
              </p>
              <p className="muted">
                Research on short-travel keyboards found that travel distance alone did not predict
                typing force or muscle activity; the switch mechanism mattered too. That is a useful
                corrective in both directions: it means neither &ldquo;more travel is better for
                you&rdquo; nor &ldquo;flat is better for you&rdquo; survives as a general rule, and
                it is why this page makes no ergonomic promise at all. If something already hurts,
                that deserves attention on its own terms rather than a hardware purchase.
              </p>
            </div>
          </div>
        </section>

        {/* 8 — customisation */}
        <section id="customisation">
          <div className="wrap">
            <div className="sec-head">
              <p className="eyebrow">07 · What customisation actually gives you</p>
              <h2>Less exotic, and more useful, than it sounds.</h2>
            </div>
            <div className="comp-list">
              {CUSTOM.map((c) => (
                <div className="comp card" key={c.k}>
                  <h3>{c.k}</h3>
                  <p>{c.v}</p>
                </div>
              ))}
            </div>
            <p className="note">
              You do not have to become a hobbyist. The genuine everyday benefit is that a keyboard
              which is slightly wrong can usually be made right, rather than replaced — which is a
              different relationship with an object than most peripherals allow.
            </p>
          </div>
        </section>

        {/* 9 — who benefits */}
        <section id="who-benefits">
          <div className="wrap">
            <div className="sec-head">
              <p className="eyebrow">08 · Who probably benefits most</p>
              <h2>Five situations where the answer is yes.</h2>
            </div>
            <div className="card blind" style={{ maxWidth: 760 }}>
              <h3>Switching is likely to be worth it if</h3>
              <ul className="tick-list">
                {BENEFITS.map((b) => (
                  <li key={b}>{b}</li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        {/* 10 — who should stay */}
        <section id="stay-put">
          <div className="wrap">
            <div className="sec-head">
              <p className="eyebrow">09 · Who may be happier staying put</p>
              <h2>Five situations where the answer is no.</h2>
              <p>
                This half of the page is the reason it exists. Most buying advice is written as
                though the purchase is inevitable.
              </p>
            </div>
            <div className="card blind" style={{ maxWidth: 760 }}>
              <h3>Keeping what you have makes sense if</h3>
              <ul className="tick-list">
                {STAY_PUT.map((s) => (
                  <li key={s}>{s}</li>
                ))}
              </ul>
            </div>
            <p className="note">
              The last one is worth repeating plainly: a keyboard is not a treatment. If you are
              shopping because something hurts, the keyboard is the smallest variable in the setup
              and the most expensive one to guess at.
            </p>
          </div>
        </section>

        {/* 11 — checklist */}
        <section id="checklist">
          <div className="wrap">
            <div className="sec-head">
              <p className="eyebrow">10 · Before you switch</p>
              <h2>Six things to settle first.</h2>
            </div>
            <div className="card blind" style={{ maxWidth: 760 }}>
              <h3>Answer these and the decision makes itself</h3>
              <ul className="tick-list">
                <li>Name what is wrong with your current keyboard — if nothing is, stop here</li>
                <li>Decide whether the room you work in can tolerate the sound</li>
                <li>Measure the desk: an external keyboard needs space, and the laptop needs raising</li>
                <li>Check the return window outlasts a two-week adaptation period</li>
                <li>Consider low profile if the height rather than the feel is your concern</li>
                <li>Be clear that you are buying a better object, not a measurable improvement</li>
              </ul>
            </div>
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
              <h2>Decided? The next question has its own page.</h2>
              <p>
                We are not recommending models, because ranking requires data we can verify and do
                not have. When live offers exist they will be ranked by the published method —
                totals, commission-blind, nothing unverified.
              </p>
              <div className="hero-cta" style={{ justifyContent: 'center', marginTop: 28 }}>
                <a className="btn btn-primary" href="/#cta">
                  Join the waitlist →
                </a>
                <a className="btn btn-ghost" href="/guides/mechanical-keyboard">
                  How to choose one
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
