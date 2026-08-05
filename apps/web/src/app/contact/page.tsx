import type { Metadata } from 'next';

/*
 * /contact — two addresses, and honesty about what happens after you write.
 *
 * TRUTH RULE FOR THIS FILE: both addresses were created in Cloudflare Email
 * Routing before this page shipped, and both are Active — hello@ and privacy@,
 * forwarding to a real mailbox. A contact page listing an address that bounces
 * is worse than no contact page.
 *
 * WHY MAILTO AND NOT A FORM. A form needs an endpoint. The only endpoint this
 * site has is POST /api/waitlist; adding a second one is real backend work, and
 * a form that silently drops messages is exactly the failure this project
 * refuses to ship. Mailto is honest, works offline from our infrastructure, and
 * leaves the sender holding a copy of what they sent. §04 says so plainly
 * rather than leaving the absence to look like an oversight.
 *
 * No response-time promise is made. There is one person; committing to
 * "within 24 hours" would be a claim we could not keep and nobody could hold
 * us to.
 */

const BASE = 'https://honesttotal.com';
const HELLO = 'hello@honesttotal.com';
const PRIVACY = 'privacy@honesttotal.com';

export const metadata: Metadata = {
  title: 'Contact — Honest Total',
  description:
    'Two addresses, both real and both read by a person: hello@honesttotal.com for anything, privacy@honesttotal.com for data requests. What we can and cannot help with, stated plainly.',
  alternates: { canonical: '/contact' },
  openGraph: {
    type: 'article',
    url: `${BASE}/contact`,
    title: 'Two addresses, read by one person.',
    description:
      'No ticket system, no chatbot, no response-time promise we could not keep. Just where to write and what happens next.',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Two addresses, read by one person.',
    description: 'Where to write, what we can help with, and what we honestly cannot.',
  },
};

/** Where to write, and what each address is for. */
const ADDRESSES = [
  {
    n: 'General',
    addr: HELLO,
    d: 'Anything at all — a question about the method, a mistake you spotted, a merchant who wants to be listed, or a journalist with a deadline.',
    tone: 'ok',
  },
  {
    n: 'Data requests',
    addr: PRIVACY,
    d: 'Asking what we hold about you, or asking us to delete it. Write from the address you signed up with and it is a two-minute job on our side.',
    tone: 'warn',
  },
];

const CAN_HELP = [
  'Questions about how the ranking method works, or where a figure came from',
  'Corrections — if a sentence on this site is wrong, this is the fastest way to get it fixed',
  'Deleting your waitlist email, or telling you whether we hold one at all',
  'Merchants and brands who want to be considered when the product opens',
  'Press and research enquiries, including sceptical ones',
];

const CANNOT_HELP = [
  'Orders, deliveries or refunds — nothing can be bought here, so there is no order to look up',
  'Merchant customer service — if you bought from a retailer, they hold the order, not us',
  'Early access or queue-jumping — there is no queue, and the waitlist is not ordered',
  'Price predictions or “should I buy now?” — we have no live prices and give no advice',
];

const FAQ = [
  {
    q: 'How quickly will you reply?',
    a: 'We are not promising a time, because there is one person reading and a promise of “within 24 hours” would be broken the first week someone is ill. Expect days rather than minutes. Corrections to something factually wrong on the site get looked at first, because those matter more than our convenience.',
  },
  {
    q: 'Why is there no contact form?',
    a: 'A form needs somewhere to send the message, and the only endpoint on this site is the waitlist. Adding a second one is real work, and a form that silently drops what you wrote is worse than no form — you would think you had reached us. Email also leaves you holding a copy of what you sent, which a form does not.',
  },
  {
    q: 'Is there a phone number or an address?',
    a: 'No. There is no office and no phone line, because this is one person building in the open rather than a company presenting itself as larger than it is. A number that reaches an unattended voicemail would be decoration.',
  },
  {
    q: 'I represent a merchant. Is it worth writing?',
    a: 'Yes, and it is genuinely useful — but read /commission-blind first so there are no surprises. Commission cannot buy position, sponsored placement cannot reorder results, and we will not agree otherwise. If those terms are acceptable, write to hello@ and we will keep your details for when the product opens.',
  },
  {
    q: 'What if I found a security problem?',
    a: 'Write to hello@honesttotal.com and say so in the subject line. The site is a static export plus one Worker endpoint, so the surface is small, but reports are welcome and we will not be difficult about them. Please do not test destructively against the live site.',
  },
  {
    q: 'Can I write in a language other than English?',
    a: 'Yes. The site is in English because that is where the first market is, but we read what arrives and will do our best with a translation rather than ignore you.',
  },
];

const BREADCRUMB_LD = {
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: [
    { '@type': 'ListItem', position: 1, name: 'Home', item: `${BASE}/` },
    { '@type': 'ListItem', position: 2, name: 'Contact', item: `${BASE}/contact` },
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

export default function ContactPage() {
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
            <a href="/about">About</a>
            <a className="active" href="/contact">
              Contact
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
                <span aria-current="page">Contact</span>
              </li>
            </ol>
          </nav>
        </div>

        {/* 1 — hero */}
        <section className="hero" style={{ borderTop: 0 }}>
          <div className="wrap">
            <span className="pill-eyebrow">
              <span aria-hidden="true">✦</span>
              <p className="eyebrow">Contact</p>
            </span>
            <h1 className="hero-h1" style={{ maxWidth: '21ch' }}>
              <span className="h1-underlined">Two addresses,</span> <em>one person reading.</em>
            </h1>
            <p className="lede" style={{ marginTop: 24 }}>
              No ticket system, no chatbot, and no promise about response times that could not be
              kept. Just where to write, what we can actually help with, and what we cannot.
            </p>
            <p className="prelaunch" style={{ maxWidth: '58ch' }}>
              <b>Both addresses are live.</b> They were created and confirmed active before this
              page was published — a contact page listing an address that bounces is worse than no
              contact page at all.
            </p>
          </div>
        </section>

        {/* 2 — addresses */}
        <section id="addresses">
          <div className="wrap">
            <div className="sec-head">
              <p className="eyebrow">01 · Where to write</p>
              <h2>Pick whichever fits.</h2>
              <p>Both reach the same person. The split exists so data requests are easy to spot.</p>
            </div>
            <div className="comp-list">
              {ADDRESSES.map((a) => (
                <div className="comp card" key={a.addr}>
                  <h3>{a.n}</h3>
                  <p>
                    <a className="mono" href={`mailto:${a.addr}`}>
                      {a.addr}
                    </a>
                  </p>
                  <p className="comp-src">{a.d}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* 3 — scope */}
        <section id="scope">
          <div className="wrap">
            <div className="sec-head">
              <p className="eyebrow">02 · What we can do</p>
              <h2>Useful, and not useful.</h2>
              <p>
                Saying what we cannot help with saves you the wait for a reply that would have
                disappointed you.
              </p>
            </div>
            <div className="blind-grid">
              <div className="card blind">
                <h3>Worth writing about</h3>
                <ul className="tick-list">
                  {CAN_HELP.map((x) => (
                    <li key={x}>{x}</li>
                  ))}
                </ul>
              </div>
              <div className="card blind blind-out">
                <h3>We genuinely cannot help</h3>
                <ul className="cross-list">
                  {CANNOT_HELP.map((x) => (
                    <li key={x}>{x}</li>
                  ))}
                </ul>
              </div>
            </div>
            <p className="note">
              The second column is short only because the product is not open yet. Once people are
              being handed off to merchants, the boundary between our responsibility and a
              retailer&rsquo;s becomes the most important thing on this page, and it will be
              rewritten to say so.
            </p>
          </div>
        </section>

        {/* 4 — no form, no SLA */}
        <section id="expectations">
          <div className="wrap">
            <div className="sec-head">
              <p className="eyebrow">03 · What happens next</p>
              <h2>The unglamorous truth.</h2>
            </div>
            <div className="card rule-card">
              <p className="rule-quote">
                One person reads it. Expect <b>days rather than minutes</b> — and if something on
                this site is factually wrong, say so and it goes to the front of the queue.
              </p>
              <p className="muted">
                There is no contact form because a form needs an endpoint, and a form that silently
                drops your message is worse than none — you would believe you had reached us. Email
                also leaves you holding a copy of what you sent, which a form never does.
              </p>
            </div>
          </div>
        </section>

        {/* 5 — for merchants */}
        <section id="merchants">
          <div className="wrap">
            <div className="sec-head">
              <p className="eyebrow">04 · For merchants and brands</p>
              <h2>Read the terms first, then write.</h2>
            </div>
            <div className="two-col">
              <div className="card blind">
                <h3>What we can offer</h3>
                <ul className="tick-list">
                  <li>Consideration when the product opens in your category</li>
                  <li>A ranking that judges your offer on the total a buyer pays</li>
                  <li>Disclosure of any commercial relationship, stated before anyone clicks</li>
                </ul>
              </div>
              <div className="card blind blind-out">
                <h3>What is not negotiable</h3>
                <ul className="cross-list">
                  <li>
                    Commission cannot buy position — see <a href="/commission-blind">why</a>
                  </li>
                  <li>Sponsored placement cannot reorder organic results</li>
                  <li>We will not present an estimate as a verified saving</li>
                </ul>
              </div>
            </div>
            <p className="note">
              Nobody has approached us yet and no partnership exists, so this section is an
              invitation rather than a description. Writing the terms down before the first
              conversation is the point — they are much harder to hold once a deal is on the table.
            </p>
          </div>
        </section>

        {/* 6 — FAQ */}
        <section id="faq">
          <div className="wrap">
            <div className="sec-head">
              <p className="eyebrow">05 · Questions</p>
              <h2>Before you write.</h2>
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
              <h2>Say something true and we will listen.</h2>
              <p>
                Especially if it is that we got something wrong. This site is built to be corrected.
              </p>
              <div className="hero-cta" style={{ justifyContent: 'center', marginTop: 28 }}>
                <a className="btn btn-primary" href={`mailto:${HELLO}`}>
                  Email {HELLO} →
                </a>
                <a className="btn btn-ghost" href="/about">
                  Read about the project
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
            <span className="mono">No ticket system · no chatbot · read by a person</span>
          </div>
        </div>
      </footer>
    </>
  );
}
