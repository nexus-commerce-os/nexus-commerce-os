import type { Metadata } from 'next';

/*
 * /privacy — what we hold, which today is one email address.
 *
 * TRUTH RULE FOR THIS FILE: every statement was checked against the code
 * before being written, not against a template.
 *   - worker/index.ts is the ONLY thing that touches submitted data. It stores
 *     { email, source: 'web', createdAt } in KV and nothing else — no IP, no
 *     user agent — and deliberately keeps the address out of the error path.
 *   - wrangler.toml binds exactly one KV namespace and enables observability,
 *     so Cloudflare holds request logs. That is disclosed rather than omitted.
 *   - The app source contains no analytics, no tracking pixel and no external
 *     host: the only absolute URLs anywhere are honesttotal.com, w3.org (an SVG
 *     xmlns, not a request) and schema.org (a JSON-LD context, not a request).
 *   - localStorage holds one key, `nexus-theme`, written only by the toggle.
 * No compliance certification is claimed. Rights are described and an actual
 * route to exercise them is given; claiming "GDPR compliant" would be a legal
 * assertion nobody here is in a position to make.
 */

const BASE = 'https://honesttotal.com';
// Was admin@, which is the address used for third-party account signups and
// forwards to a personal mailbox. privacy@ was created as a dedicated route in
// Cloudflare Email Routing and confirmed Active before this changed, so the
// address published here is purpose-built rather than borrowed.
const CONTACT = 'privacy@honesttotal.com';
const EFFECTIVE = '5 August 2026';

export const metadata: Metadata = {
  title: 'Privacy — Honest Total',
  description:
    'What this site collects, which today is a single email address if you join the waitlist. No cookies, no analytics, no trackers, no third-party embeds — stated specifically enough to be checked.',
  alternates: { canonical: '/privacy' },
  openGraph: {
    type: 'article',
    url: `${BASE}/privacy`,
    title: 'We hold one email address, and only if you give it to us.',
    description:
      'No cookies, no analytics, no tracking pixels, no third-party embeds. What we store, where, for how long, and how to make us delete it.',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'We hold one email address, and only if you give it to us.',
    description: 'No cookies, no analytics, no trackers. Written from the code, not a template.',
  },
};

/** Everything this site can end up holding about a visitor. */
const COLLECTED = [
  {
    n: 'Waitlist email',
    d: 'Only if you type it in and submit the form. Stored with the word “web” and the time you submitted, so we know where it came from and when.',
    why: 'To email you once, when your region opens',
    tone: 'warn',
  },
  {
    n: 'Theme choice',
    d: 'If you use the light/dark toggle, your choice is saved in your own browser under the key nexus-theme. It never leaves your device and we cannot read it.',
    why: 'So the site does not flash the wrong colour on every page',
    tone: 'ok',
  },
  {
    n: 'Server request logs',
    d: 'Cloudflare, which serves this site, processes the technical details of each request — including your IP address — as part of delivering the page and blocking abuse.',
    why: 'Unavoidable for any hosted website',
    tone: 'muted',
  },
];

/** Things a visitor might reasonably assume are happening, and are not. */
const NOT_COLLECTED = [
  'Cookies of any kind — this site sets none, which is why you have never seen a consent banner here',
  'Analytics — there is no Google Analytics, no Plausible, no PostHog, no self-hosted alternative',
  'Tracking pixels, advertising tags, session recording, heatmaps or A/B testing scripts',
  'Third-party embeds — no external fonts, no CDN scripts, no social widgets, no comment systems',
  'Your name, location, device fingerprint, browsing history or anything about what you looked at',
  'Purchase data — nobody can buy anything through this site yet, so none exists to hold',
];

const RIGHTS = [
  {
    k: 'Ask what we hold',
    v: 'Email us and we will tell you. For almost everyone the honest answer is “nothing”, because we only hold an address if you submitted one.',
  },
  {
    k: 'Have it deleted',
    v: 'Email us from the address you signed up with and we will remove it. No form, no account, no retention argument — it is one record and we delete it.',
  },
  {
    k: 'Correct it',
    v: 'Tell us the right address and we will replace the wrong one. In practice deleting and re-subscribing is faster and we will do whichever you prefer.',
  },
  {
    k: 'Leave at any time',
    v: 'Unsubscribing removes the address rather than flagging it as unsubscribed. We keep no suppression list, because we keep nothing else either.',
  },
];

const FAQ = [
  {
    q: 'Why is there no cookie banner?',
    a: 'Because there are no cookies to consent to. Consent banners exist because sites set tracking cookies before you have agreed; a site that sets none has nothing to ask about. If that ever changes, the banner will appear and this page will say what changed and when.',
  },
  {
    q: 'You really have no analytics? How do you know anyone visits?',
    a: 'Largely, we do not — beyond whatever aggregate figures our host and Google Search Console show, neither of which identifies individuals. That is a genuine cost of this choice and we are accepting it for now. If we add analytics we will pick something that does not profile visitors, and we will name it here before it goes live rather than after.',
  },
  {
    q: 'What exactly is stored when I join the waitlist?',
    a: 'Three fields: the address you typed, the word “web”, and the timestamp. No IP address, no browser details, no referring page. If saving fails, the error we return and anything we log deliberately omit the address, so a failure cannot turn into a leak.',
  },
  {
    q: 'How long do you keep it?',
    a: 'Until you ask us to delete it, or until the waitlist has served its purpose and is deleted wholesale. We have not set an automatic expiry, and rather than invent a retention period we will not honour, we are telling you plainly that it sits there until one of those two things happens.',
  },
  {
    q: 'Who else can see it?',
    a: 'Cloudflare, because the storage is theirs and the site runs on their network. Nobody else — no email marketing platform, no CRM, no advertising network, no data broker. We have never sold or shared an address and there is no arrangement under which we would.',
  },
  {
    q: 'Will this change when the product launches?',
    a: 'Yes, and substantially — a working comparison product will need to handle searches and hand-offs to merchants. This page will be rewritten before that ships, not after, and the change will be dated so you can see what was true when. What will not change is that we do not sell data and do not run advertising.',
  },
];

const BREADCRUMB_LD = {
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: [
    { '@type': 'ListItem', position: 1, name: 'Home', item: `${BASE}/` },
    { '@type': 'ListItem', position: 2, name: 'Privacy', item: `${BASE}/privacy` },
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

export default function PrivacyPage() {
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
            <a href="/disclosure">Disclosure</a>
            <a className="active" href="/privacy">
              Privacy
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
                <span aria-current="page">Privacy</span>
              </li>
            </ol>
          </nav>
        </div>

        {/* 1 — hero */}
        <section className="hero" style={{ borderTop: 0 }}>
          <div className="wrap">
            <span className="pill-eyebrow">
              <span aria-hidden="true">✦</span>
              <p className="eyebrow">Privacy</p>
            </span>
            <h1 className="hero-h1" style={{ maxWidth: '20ch' }}>
              <span className="h1-underlined">We hold</span> <em>one email address.</em>
            </h1>
            <p className="lede" style={{ marginTop: 24 }}>
              And only if you typed it into the waitlist form yourself. This page is short because
              there is very little to describe — and specific, because a privacy policy written in
              generalities is one nobody can hold you to.
            </p>
            <p className="prelaunch" style={{ maxWidth: '58ch' }}>
              <b>Effective {EFFECTIVE}.</b> Every statement here was checked against the code that
              runs this site, not adapted from a template. Where a claim would need a lawyer to
              make, we describe what we actually do instead.
            </p>
          </div>
        </section>

        {/* 2 — the short version */}
        <section id="summary">
          <div className="wrap">
            <div className="sec-head">
              <p className="eyebrow">01 · The short version</p>
              <h2>No cookies, no analytics, no trackers.</h2>
            </div>
            <div className="rule-card card">
              <p className="rule-quote">
                This site sets <b>no cookies</b>, runs <b>no analytics</b>, embeds{' '}
                <b>no third-party scripts</b>, and stores <b>nothing about you</b> unless you submit
                the waitlist form.
              </p>
              <p className="muted">
                That is why you have never seen a consent banner here. It is not a privacy feature
                we are marketing — it is what a site looks like before anyone has added the usual
                machinery, and we would rather justify each addition than start with all of it.
              </p>
            </div>
          </div>
        </section>

        {/* 3 — what is collected */}
        <section id="collected">
          <div className="wrap">
            <div className="sec-head">
              <p className="eyebrow">02 · What exists</p>
              <h2>Everything this site can hold about you.</h2>
              <p>Three items, and only the first involves a decision on your part.</p>
            </div>
            <div className="fresh-table" role="table" aria-label="Data collected">
              <div className="fresh-head" role="row">
                <span role="columnheader">What</span>
                <span role="columnheader">Detail</span>
                <span role="columnheader">Why</span>
              </div>
              {COLLECTED.map((c) => (
                <div className="fresh-row" role="row" key={c.n}>
                  <span role="cell">
                    <b className={`fstate f-${c.tone}`}>{c.n}</b>
                  </span>
                  <span role="cell">{c.d}</span>
                  <span role="cell">{c.why}</span>
                </div>
              ))}
            </div>
            <p className="note">
              The waitlist record is exactly three fields — the address, the word{' '}
              <span className="mono">web</span>, and a timestamp. Not your IP, not your browser, not
              the page you came from. If the save fails, the error and any log line omit the address
              deliberately, so a failure cannot become a leak.
            </p>
          </div>
        </section>

        {/* 4 — what is not collected */}
        <section id="not-collected">
          <div className="wrap">
            <div className="sec-head">
              <p className="eyebrow">03 · What does not exist</p>
              <h2>Named specifically, so it can be checked.</h2>
              <p>
                &ldquo;We respect your privacy&rdquo; is unfalsifiable. A list of named absences is
                not — open the page source or your browser&rsquo;s network tab and see.
              </p>
            </div>
            <div className="card blind blind-out" style={{ maxWidth: 760 }}>
              <h3>Not present on this site</h3>
              <ul className="cross-list">
                {NOT_COLLECTED.map((x) => (
                  <li key={x}>{x}</li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        {/* 5 — who touches it */}
        <section id="processors">
          <div className="wrap">
            <div className="sec-head">
              <p className="eyebrow">04 · Who else is involved</p>
              <h2>One company, because the site runs on their network.</h2>
            </div>
            <div className="two-col">
              <div className="card blind">
                <h3>Cloudflare</h3>
                <ul className="tick-list">
                  <li>Serves every page and handles the waitlist request</li>
                  <li>Stores the waitlist entries themselves</li>
                  <li>
                    Processes request details, including your IP, to deliver and protect the site
                  </li>
                  <li>Forwards mail sent to our domain address</li>
                </ul>
              </div>
              <div className="card blind blind-out">
                <h3>Nobody else</h3>
                <ul className="cross-list">
                  <li>No email marketing platform or CRM</li>
                  <li>No advertising network or data broker</li>
                  <li>No merchant or affiliate network — none is connected</li>
                  <li>No sale or sharing of any address, ever, under any arrangement</li>
                </ul>
              </div>
            </div>
            <p className="note">
              We also enable our host&rsquo;s request logging, which is how we would diagnose an
              outage. It is disclosed here rather than left out because it is the one place where
              technical data about your visit is retained by someone other than you.
            </p>
          </div>
        </section>

        {/* 6 — rights */}
        <section id="rights">
          <div className="wrap">
            <div className="sec-head">
              <p className="eyebrow">05 · What you can ask for</p>
              <h2>And how to actually get it.</h2>
              <p>
                Email <a href={`mailto:${CONTACT}`}>{CONTACT}</a>. A person reads it. There is no
                form to fill in and no account to create — creating an account to delete data you
                never knowingly gave is the sort of thing this page exists to avoid.
              </p>
            </div>
            <div className="comp-list">
              {RIGHTS.map((r) => (
                <div className="comp card" key={r.k}>
                  <h3>{r.k}</h3>
                  <p>{r.v}</p>
                </div>
              ))}
            </div>
            <p className="note">
              Depending on where you live you may have these rights in law rather than by our
              goodwill. We are not claiming a compliance certification we have not been audited for
              — we are telling you that the request works, and that with one record per person it is
              not a difficult promise to keep.
            </p>
          </div>
        </section>

        {/* 7 — FAQ */}
        <section id="faq">
          <div className="wrap">
            <div className="sec-head">
              <p className="eyebrow">06 · Questions</p>
              <h2>The ones a careful reader would ask.</h2>
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

        {/* 8 — changes */}
        <section id="changes">
          <div className="wrap">
            <div className="sec-head">
              <p className="eyebrow">07 · When this changes</p>
              <h2>Before, not after.</h2>
            </div>
            <div className="card rule-card">
              <p className="rule-quote">
                If we start collecting something new, this page changes <b>before</b> the collection
                starts, and the date at the top changes with it.
              </p>
              <p className="muted">
                Updating a privacy policy after the fact is technically compliant and practically
                dishonest: it tells you what already happened. The launch of the comparison product
                will require a real rewrite of this page, and that rewrite will land first.
              </p>
            </div>
          </div>
        </section>

        {/* 9 — CTA */}
        <section id="cta" style={{ borderTop: 0 }}>
          <div className="wrap">
            <div className="cta-final">
              <h2>Short policy, small promise, kept.</h2>
              <p>
                One email if your region opens, and nothing else — from a site that currently cannot
                track you even if it wanted to.
              </p>
              <div className="hero-cta" style={{ justifyContent: 'center', marginTop: 28 }}>
                <a className="btn btn-primary" href="/#cta">
                  Join the waitlist →
                </a>
                <a className="btn btn-ghost" href="/disclosure">
                  Read the disclosure
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
            <span className="mono">No cookies · no analytics · effective {EFFECTIVE}</span>
          </div>
        </div>
      </footer>
    </>
  );
}
