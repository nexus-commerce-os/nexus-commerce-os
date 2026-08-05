import type { Metadata } from 'next';

/*
 * /terms — the terms for a website and a waitlist, because that is all there is.
 *
 * TRUTH RULE FOR THIS FILE: no invented counterparty and no invented service.
 *   - There is NO incorporated entity. Nothing in the app or the docs claims
 *     one, and /about says "founder-built — one person". §02 therefore says the
 *     site is operated by an individual, rather than naming a company that does
 *     not exist.
 *   - There are no accounts, no purchases, no payments and no product, so the
 *     usual clauses about suspending accounts or refunding orders are omitted
 *     rather than copied in. A term describing a service we do not run would be
 *     fiction with a legal veneer.
 *   - Governing law is NOT asserted. Naming a jurisdiction is a legal decision
 *     tied to an entity that does not exist yet; §08 says so plainly instead of
 *     guessing, and says local consumer law wins where it applies.
 * These terms are written in plain language by a non-lawyer, and the page says
 * that rather than implying counsel it has not had.
 */

const BASE = 'https://honesttotal.com';
const CONTACT = 'hello@honesttotal.com';
const EFFECTIVE = '5 August 2026';

export const metadata: Metadata = {
  title: 'Terms — Honest Total',
  description:
    'The terms for using this site: what it is, what it is not, what the waitlist commits you to, and what we do not promise. Short, because the site currently does one thing.',
  alternates: { canonical: '/terms' },
  openGraph: {
    type: 'article',
    url: `${BASE}/terms`,
    title: 'Terms for a website and a waitlist — because that is all there is.',
    description:
      'No accounts, no purchases, no product. What you are agreeing to, who you are agreeing with, and what we deliberately do not claim.',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Terms for a website and a waitlist — because that is all there is.',
    description: 'Plain language, no invented company, no jurisdiction we cannot stand behind.',
  },
};

/** What this site is and is not, so the scope of these terms is unambiguous. */
const SCOPE = [
  {
    n: 'A website',
    d: 'Pages explaining a method we intend to build, plus buying guides written to be useful on their own.',
    state: 'Covered here',
    tone: 'ok',
  },
  {
    n: 'A waitlist',
    d: 'One form. You give an email address; we email you once, when your region opens.',
    state: 'Covered here',
    tone: 'ok',
  },
  {
    n: 'Accounts',
    d: 'There are none. Nothing to register for, log into, or be suspended from.',
    state: 'Does not exist',
    tone: 'muted',
  },
  {
    n: 'Purchases and payments',
    d: 'Nothing can be bought here and no payment is ever taken. We hold no card details and never will — hand-off means you pay the merchant directly.',
    state: 'Does not exist',
    tone: 'muted',
  },
  {
    n: 'A comparison product',
    d: 'Not connected, not running. Every figure shown on this site is illustrative and labelled as such.',
    state: 'Not yet',
    tone: 'warn',
  },
];

const USE_OK = [
  'Read anything here, and quote it with attribution — the methodology is published to be checked',
  'Link to any page, including deep links to specific sections',
  'Use the buying guides to make your own decisions, including buying elsewhere',
  'Join the waitlist, and leave it whenever you like',
];

const USE_NOT = [
  'Attacking the site — automated abuse, attempts to break the waitlist endpoint, or flooding it with addresses',
  'Submitting an email address that is not yours to give',
  'Republishing whole pages as your own work, or as though we endorse you',
  'Presenting our illustrative figures as real prices, or our pre-launch status as a live product',
];

const FAQ = [
  {
    q: 'Why are these terms so short?',
    a: 'Because the site does two things. Most terms of service are long because the service is large — accounts, payments, subscriptions, user content, refunds. None of that exists here, and importing clauses about things we do not do would make the document look thorough while describing a company that is not this one.',
  },
  {
    q: 'Who exactly am I agreeing with?',
    a: 'An individual. There is no incorporated company behind this site yet — it is founder-built and self-funded, as /about says. When a company exists, this page will name it, and the date at the top will change so you can see when that happened.',
  },
  {
    q: 'Which country’s law applies?',
    a: 'We are not asserting one. A governing-law clause is tied to a legal entity, and there is not one yet; picking a jurisdiction now would be a guess dressed up as a term. Where you live gives you consumer rights, those rights apply regardless of what any clause on this page says.',
  },
  {
    q: 'Can I rely on the buying guides?',
    a: 'They are written carefully and describe how the technology actually works, but they are general information, not advice about your situation. We do not know your budget, your ears, or your return policy. Nothing here is financial advice, and no page on this site tells you what to buy.',
  },
  {
    q: 'What happens to these terms when the product launches?',
    a: 'They will be replaced, because a working comparison product introduces hand-offs to merchants, affiliate relationships, and questions about accuracy that a marketing site simply does not raise. The replacement will be published before the product opens, not after.',
  },
  {
    q: 'What if something here contradicts another page?',
    a: 'Tell us and we will fix it. The methodology, disclosure and privacy pages are the detailed statements; this page is the frame around them. A contradiction is a mistake on our part, not a clever reservation of rights, and we will correct the page that is wrong.',
  },
];

const BREADCRUMB_LD = {
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: [
    { '@type': 'ListItem', position: 1, name: 'Home', item: `${BASE}/` },
    { '@type': 'ListItem', position: 2, name: 'Terms', item: `${BASE}/terms` },
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

export default function TermsPage() {
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
            <a href="/privacy">Privacy</a>
            <a className="active" href="/terms">
              Terms
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
                <span aria-current="page">Terms</span>
              </li>
            </ol>
          </nav>
        </div>

        {/* 1 — hero */}
        <section className="hero" style={{ borderTop: 0 }}>
          <div className="wrap">
            <span className="pill-eyebrow">
              <span aria-hidden="true">✦</span>
              <p className="eyebrow">Terms</p>
            </span>
            <h1 className="hero-h1" style={{ maxWidth: '21ch' }}>
              <span className="h1-underlined">Terms for</span> <em>a site and a list.</em>
            </h1>
            <p className="lede" style={{ marginTop: 24 }}>
              There are no accounts, no purchases and no product yet, so this page covers what
              actually exists rather than importing clauses about things we do not do.
            </p>
            <p className="prelaunch" style={{ maxWidth: '58ch' }}>
              <b>Effective {EFFECTIVE}.</b> Written in plain language by the founder, not by a
              lawyer — which is why it does not claim a jurisdiction, a company, or a service that
              does not exist. Where your local consumer law gives you more, that law wins.
            </p>
          </div>
        </section>

        {/* 2 — scope */}
        <section id="scope">
          <div className="wrap">
            <div className="sec-head">
              <p className="eyebrow">01 · Scope</p>
              <h2>What these terms are about.</h2>
              <p>Two things exist. Three commonly-assumed things do not.</p>
            </div>
            <div className="fresh-table" role="table" aria-label="What these terms cover">
              <div className="fresh-head" role="row">
                <span role="columnheader">Thing</span>
                <span role="columnheader">Detail</span>
                <span role="columnheader">Status</span>
              </div>
              {SCOPE.map((s) => (
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

        {/* 3 — counterparty */}
        <section id="who">
          <div className="wrap">
            <div className="sec-head">
              <p className="eyebrow">02 · The other party</p>
              <h2>Who you are agreeing with.</h2>
            </div>
            <div className="card rule-card">
              <p className="rule-quote">
                This site is operated by <b>an individual</b>. There is no incorporated company
                behind it yet — it is founder-built and self-funded.
              </p>
              <p className="muted">
                Most terms open by naming a company, a registration number and a registered office.
                Writing one here would be the easiest sentence on the page to fabricate and the
                least excusable. When an entity exists it will be named here and the date at the top
                will change — see <a href="/about">About</a> for the current position.
              </p>
            </div>
          </div>
        </section>

        {/* 4 — acceptable use */}
        <section id="use">
          <div className="wrap">
            <div className="sec-head">
              <p className="eyebrow">03 · Using the site</p>
              <h2>Broadly, please do.</h2>
              <p>
                The methodology is published so it can be checked, which does not work if reading it
                is restricted.
              </p>
            </div>
            <div className="blind-grid">
              <div className="card blind">
                <h3>Welcome</h3>
                <ul className="tick-list">
                  {USE_OK.map((x) => (
                    <li key={x}>{x}</li>
                  ))}
                </ul>
              </div>
              <div className="card blind blind-out">
                <h3>Not welcome</h3>
                <ul className="cross-list">
                  {USE_NOT.map((x) => (
                    <li key={x}>{x}</li>
                  ))}
                </ul>
              </div>
            </div>
            <p className="note">
              The last one matters more than it sounds. Every figure on this site is labelled
              illustrative because none of it is real yet — repeating those numbers as though they
              were live prices would mislead someone about money, which is the specific harm this
              whole project exists to avoid.
            </p>
          </div>
        </section>

        {/* 5 — the waitlist */}
        <section id="waitlist">
          <div className="wrap">
            <div className="sec-head">
              <p className="eyebrow">04 · The waitlist</p>
              <h2>What joining commits either of us to.</h2>
            </div>
            <div className="two-col">
              <div className="card blind">
                <h3>What we owe you</h3>
                <ul className="tick-list">
                  <li>One email, when the product opens in your region</li>
                  <li>No marketing sequence, no newsletter, no partner offers</li>
                  <li>Removal on request, from the address you signed up with</li>
                  <li>
                    Your address is never sold, shared or rented — see{' '}
                    <a href="/privacy">Privacy</a>
                  </li>
                </ul>
              </div>
              <div className="card blind blind-out">
                <h3>What you owe us</h3>
                <ul className="cross-list">
                  <li>Nothing. There is no fee, no commitment and no obligation to use anything</li>
                  <li>You are not promised early access, a discount, or a place in a queue</li>
                  <li>Joining is not a contract to buy anything, ever</li>
                </ul>
              </div>
            </div>
            <p className="note">
              We may never send that email — the product may not launch, or may not launch where you
              are. Saying so is more useful than a clause reserving the right to discontinue the
              service, which is the same admission written to sound like a right.
            </p>
          </div>
        </section>

        {/* 6 — content and IP */}
        <section id="content">
          <div className="wrap">
            <div className="sec-head">
              <p className="eyebrow">05 · Words and design</p>
              <h2>Ours, but quotable.</h2>
            </div>
            <div className="comp-list">
              <div className="comp card">
                <h3>What we own</h3>
                <p>
                  The writing, the design and the code of this site. Copying a page wholesale and
                  presenting it as your own is not on; quoting it with attribution and a link is
                  actively welcome.
                </p>
              </div>
              <div className="comp card">
                <h3>What we do not own</h3>
                <p>
                  Any merchant or brand name mentioned belongs to its owner. We use no merchant
                  logos anywhere on this site, and no mention implies a relationship — we have none.
                </p>
              </div>
              <div className="comp card">
                <h3>What we ask</h3>
                <p>
                  If you quote the ranking method, quote its limits too. A method described without
                  the cases where it refuses to rank is a different method from the one we
                  published.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* 7 — no warranty */}
        <section id="warranty">
          <div className="wrap">
            <div className="sec-head">
              <p className="eyebrow">06 · What we do not promise</p>
              <h2>The honest disclaimers.</h2>
            </div>
            <div className="card blind blind-out" style={{ maxWidth: 760 }}>
              <h3>Please do not rely on this site for</h3>
              <ul className="cross-list">
                <li>
                  Current prices — there are none here, and the illustrative figures are invented
                </li>
                <li>
                  Financial or purchasing advice — the guides are general information about a
                  category, not a recommendation for you
                </li>
                <li>
                  Uninterrupted availability — this is a small self-funded site and it may go down
                </li>
                <li>
                  Guaranteed accuracy of every sentence — we correct mistakes publicly rather than
                  claiming there will be none
                </li>
              </ul>
            </div>
            <p className="note">
              If something here is wrong, email <a href={`mailto:${CONTACT}`}>{CONTACT}</a> and it
              gets fixed. That is a more useful remedy than a liability cap, and it is the one we
              can actually offer at this size.
            </p>
          </div>
        </section>

        {/* 8 — changes and law */}
        <section id="changes">
          <div className="wrap">
            <div className="sec-head">
              <p className="eyebrow">07 · Changes, and the law</p>
              <h2>What we will not pretend to know.</h2>
            </div>
            <div className="two-col">
              <div className="card blind">
                <h3>Changes</h3>
                <ul className="tick-list">
                  <li>Material changes are published before they take effect, not after</li>
                  <li>The effective date at the top changes with them</li>
                  <li>
                    The launch of a comparison product will require a full rewrite of this page
                  </li>
                </ul>
              </div>
              <div className="card blind blind-out">
                <h3>Governing law</h3>
                <ul className="cross-list">
                  <li>
                    Not asserted — a jurisdiction clause belongs to an entity, and there is none
                  </li>
                  <li>Your local consumer-protection law applies regardless of anything here</li>
                  <li>
                    A clause naming a convenient jurisdiction would be a guess with a legal
                    appearance
                  </li>
                </ul>
              </div>
            </div>
            <p className="note">
              This is the section most sites get wrong in the opposite direction — asserting a
              forum, a waiver and an arbitration clause copied from a template, none of which was
              considered for the actual business. We would rather have a gap we can name than a
              clause we cannot defend.
            </p>
          </div>
        </section>

        {/* 9 — FAQ */}
        <section id="faq">
          <div className="wrap">
            <div className="sec-head">
              <p className="eyebrow">08 · Questions</p>
              <h2>Reasonable ones about an unusual document.</h2>
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
              <h2>Short terms for a small thing.</h2>
              <p>
                They will grow when there is something to govern. Until then, this is the whole
                agreement.
              </p>
              <div className="hero-cta" style={{ justifyContent: 'center', marginTop: 28 }}>
                <a className="btn btn-primary" href="/#cta">
                  Join the waitlist →
                </a>
                <a className="btn btn-ghost" href="/privacy">
                  Read the privacy page
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
            <span className="mono">No accounts · no payments · effective {EFFECTIVE}</span>
          </div>
        </div>
      </footer>
    </>
  );
}
