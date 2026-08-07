import type { Metadata } from 'next';

import { SiteFooter } from '@/components/SiteFooter';

/*
 * /cookies — a cookie policy for a site that sets no cookies.
 *
 * TRUTH RULE FOR THIS FILE: the central claim was verified at runtime, not
 * inferred. `document.cookie` is empty on a loaded page, every script and
 * stylesheet in the build is same-origin /_next/*, and the only browser
 * storage the site writes is a single localStorage key, `nexus-theme`, written
 * by the theme toggle in page.tsx. That key is NOT a cookie and the page says
 * so rather than quietly counting it as one — or quietly omitting it.
 *
 * The page exists despite having almost nothing to declare because reviewers
 * and visitors look for the URL. It is kept short instead of padded: inventing
 * categories ("strictly necessary", "performance", "targeting") for cookies
 * that do not exist would be exactly the box-ticking this site argues against.
 */

const BASE = 'https://honesttotal.com';
const EFFECTIVE = '5 August 2026';

export const metadata: Metadata = {
  title: 'Cookies — HonestTotal',
  description:
    'This site sets no cookies at all — not analytics, not advertising, not "strictly necessary". Here is how to verify that yourself in about ten seconds, and what would have to change for it to stop being true.',
  alternates: { canonical: '/cookies' },
  openGraph: {
    type: 'article',
    url: `${BASE}/cookies`,
    title: 'A cookie policy for a site with no cookies.',
    description:
      'No analytics, no advertising, not even a “strictly necessary” one. Verifiable in your own browser in ten seconds.',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'A cookie policy for a site with no cookies.',
    description: 'Nothing to consent to, so nothing to ask. Check it yourself — here is how.',
  },
};

/** Browser storage this site does and does not use. */
const STORAGE = [
  {
    n: 'Cookies',
    d: 'None. Not analytics, not advertising, not session, not “strictly necessary”. The count is zero, not small.',
    state: 'None',
    tone: 'ok',
  },
  {
    n: 'Local storage',
    d: 'One key, nexus-theme, holding the word “light” or “dark” — and only if you press the theme toggle. It stays in your browser; it is never sent to us and we cannot read it.',
    state: 'One key',
    tone: 'warn',
  },
  {
    n: 'Session storage',
    d: 'Nothing. The site writes no session storage at all.',
    state: 'None',
    tone: 'ok',
  },
  {
    n: 'Third-party storage',
    d: 'Impossible here — there are no third-party scripts, frames or embeds to set anything. No fonts, no CDN, no social widgets, no video players.',
    state: 'None',
    tone: 'ok',
  },
];

/** How a sceptical reader can confirm all of the above without trusting us. */
const VERIFY = [
  'Open your browser’s developer tools — F12 on Windows, ⌥⌘I on a Mac',
  'Go to the Application tab (Chrome, Edge) or Storage tab (Firefox, Safari)',
  'Look under Cookies for honesttotal.com — the list is empty',
  'Look under Local Storage — you will see nexus-theme only if you have used the theme toggle',
  'Open the Network tab and reload: every request goes to honesttotal.com and nowhere else',
];

const FAQ = [
  {
    q: 'Every site needs at least one cookie, surely?',
    a: 'No — that belief comes from sites that need to remember who you are. This one has no accounts to log into, no basket to keep, and no personalisation to restore, so there is nothing a cookie would be for. Even the theme toggle uses local storage instead, because it never needs to be sent to a server.',
  },
  {
    q: 'Is local storage not just a cookie with a different name?',
    a: 'They are genuinely different in the way that matters. A cookie is attached to every request your browser makes to us, so it travels; local storage stays on your device unless a script deliberately reads and sends it, and nothing here does. We mention it anyway rather than hiding behind the distinction — the honest summary is “one word, on your machine, that we never see”.',
  },
  {
    q: 'So why is there no consent banner?',
    a: 'Because there is nothing to consent to. Banners exist because sites set tracking cookies before you have agreed and need permission after the fact. A banner here would ask you to approve something that does not happen, which is theatre — and it would train you to click through the next one without reading it.',
  },
  {
    q: 'What would make this page change?',
    a: 'Adding analytics, embedding anything from another domain, or building a product that needs to remember a session. Any of those would be published here first, named specifically, and dated — and if consent were genuinely required, the banner would arrive with it rather than as an afterthought.',
  },
  {
    q: 'Does your host set anything?',
    a: 'Cloudflare, which serves this site, can set cookies for security features such as bot mitigation on some configurations. None is set on this site as configured today, which is why the check above comes back empty — but our host is infrastructure we do not fully control, so if that ever changes this page will say so.',
  },
];

const BREADCRUMB_LD = {
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: [
    { '@type': 'ListItem', position: 1, name: 'Home', item: `${BASE}/` },
    { '@type': 'ListItem', position: 2, name: 'Cookies', item: `${BASE}/cookies` },
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

export default function CookiesPage() {
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
            <a href="/privacy">Privacy</a>
            <a className="active" href="/cookies">
              Cookies
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
                <span aria-current="page">Cookies</span>
              </li>
            </ol>
          </nav>
        </div>

        {/* 1 — hero */}
        <section className="hero" style={{ borderTop: 0 }}>
          <div className="wrap">
            <span className="pill-eyebrow">
              <span aria-hidden="true">✦</span>
              <p className="eyebrow">Cookies</p>
            </span>
            <h1 className="hero-h1" style={{ maxWidth: '20ch' }}>
              <span className="h1-underlined">There are</span> <em>none.</em>
            </h1>
            <p className="lede" style={{ marginTop: 24 }}>
              Not analytics cookies, not advertising cookies, not even a &ldquo;strictly
              necessary&rdquo; one. This page exists because you looked for it — and because a claim
              this specific ought to be checkable rather than asserted.
            </p>
            <p className="prelaunch" style={{ maxWidth: '58ch' }}>
              <b>Effective {EFFECTIVE}.</b> Kept short on purpose. Inventing categories for cookies
              that do not exist would be the same box-ticking this site was built to argue against.
            </p>
          </div>
        </section>

        {/* 2 — the table */}
        <section id="storage">
          <div className="wrap">
            <div className="sec-head">
              <p className="eyebrow">01 · Browser storage</p>
              <h2>Everything this site puts on your device.</h2>
              <p>One word, and only if you press the theme toggle.</p>
            </div>
            <div className="fresh-table" role="table" aria-label="Browser storage used">
              <div className="fresh-head" role="row">
                <span role="columnheader">Type</span>
                <span role="columnheader">What we use it for</span>
                <span role="columnheader">Count</span>
              </div>
              {STORAGE.map((s) => (
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
              Local storage is listed here even though it is not a cookie, because omitting it on a
              technicality would be the sort of narrow truth this site is supposed to avoid. It
              holds the word <span className="mono">light</span> or{' '}
              <span className="mono">dark</span>. That is the whole of it.
            </p>
          </div>
        </section>

        {/* 3 — verify it yourself */}
        <section id="verify">
          <div className="wrap">
            <div className="sec-head">
              <p className="eyebrow">02 · Do not take our word</p>
              <h2>Check it yourself, in about ten seconds.</h2>
              <p>
                Any claim about cookies can be verified by the person reading it, which makes this
                one of the few promises on the internet you never have to trust.
              </p>
            </div>
            <div className="card blind" style={{ maxWidth: 760 }}>
              <h3>In your own browser</h3>
              <ul className="tick-list">
                {VERIFY.map((v) => (
                  <li key={v}>{v}</li>
                ))}
              </ul>
            </div>
            <p className="note">
              If you find a cookie we have not disclosed, that is a defect and we want to know:
              email <a href="mailto:privacy@honesttotal.com">privacy@honesttotal.com</a> and this
              page gets corrected the same day.
            </p>
          </div>
        </section>

        {/* 4 — no banner */}
        <section id="banner">
          <div className="wrap">
            <div className="sec-head">
              <p className="eyebrow">03 · The missing banner</p>
              <h2>Why nothing pops up.</h2>
            </div>
            <div className="card rule-card">
              <p className="rule-quote">
                A consent banner asks permission for something already happening. Nothing is
                happening — so a banner here would ask you to approve{' '}
                <b>an event that does not occur</b>.
              </p>
              <p className="muted">
                There is a second reason. Every unnecessary banner teaches people to dismiss the
                next one without reading it, including the ones that genuinely matter. Adding one
                for appearances would make the web very slightly worse in exchange for looking
                compliant.
              </p>
            </div>
          </div>
        </section>

        {/* 5 — what would change */}
        <section id="changes">
          <div className="wrap">
            <div className="sec-head">
              <p className="eyebrow">04 · When this changes</p>
              <h2>What would have to happen.</h2>
            </div>
            <div className="two-col">
              <div className="card blind">
                <h3>Would require an update here</h3>
                <ul className="tick-list">
                  <li>Adding analytics of any kind, cookie-based or not</li>
                  <li>Embedding anything served from another domain</li>
                  <li>A product feature that needs to remember a session</li>
                  <li>Our host beginning to set a cookie on this configuration</li>
                </ul>
              </div>
              <div className="card blind blind-out">
                <h3>Would not change regardless</h3>
                <ul className="cross-list">
                  <li>No advertising cookies — there is no advertising on this site</li>
                  <li>No third-party tracking or data-broker tags, ever</li>
                  <li>No selling or sharing of anything about you</li>
                  <li>No silent change: this page is updated before, not after</li>
                </ul>
              </div>
            </div>
            <p className="note">
              The full picture of what we hold — which is one email address, if you gave us one — is
              on the <a href="/privacy">privacy page</a>. This page covers only what lands in your
              browser.
            </p>
          </div>
        </section>

        {/* 6 — FAQ */}
        <section id="faq">
          <div className="wrap">
            <div className="sec-head">
              <p className="eyebrow">05 · Questions</p>
              <h2>Fair scepticism.</h2>
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

        {/* 7 — CTA */}
        <section id="cta" style={{ borderTop: 0 }}>
          <div className="wrap">
            <div className="cta-final">
              <h2>The shortest policy on the site.</h2>
              <p>
                It stays short for as long as the answer stays zero — and it changes before the
                answer does.
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

      <SiteFooter note={<>Cookies set: 0 · effective {EFFECTIVE}</>} />
    </>
  );
}
