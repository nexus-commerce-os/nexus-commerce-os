import type { Metadata } from 'next';
import { AgentPoint, AgentTerminal, SectionHead } from '@nexus/ui';

import { SiteFooter } from '@/components/SiteFooter';

/*
 * /for-developers — the API-first argument, moved off the home page.
 *
 * It was `#agent`, 970px of developer pitch sitting between a shopper's
 * "verified savings" and "trust" sections. It is a good argument aimed at the
 * wrong reader in that position, and it was a tenth of the home page's height.
 *
 * TRUTH RULE FOR THIS FILE, carried over verbatim in spirit from the section
 * it replaces: the API is DESIGNED, NOT BUILT. There is no agent, no endpoint
 * and no price being served. Every sentence here is future tense on purpose,
 * and the terminal below is labelled as an illustrative exchange because that
 * is exactly what it is — no live data, no real merchant, no real price.
 */

const BASE = 'https://honesttotal.com';

export const metadata: Metadata = {
  title: 'For developers — HonestTotal',
  description:
    'Every capability is designed as an API before it is a screen: structured offers, disclosure carried in the response, and no price served until it is verified. Designed, not yet built.',
  alternates: { canonical: '/for-developers' },
  openGraph: {
    type: 'article',
    url: `${BASE}/for-developers`,
    title: "Every capability is an API before it's a screen.",
    description:
      'The tools the HonestTotal agent will call are designed as a first-class public surface. Designed, not yet built.',
  },
};

const BREADCRUMB_LD = {
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: [
    { '@type': 'ListItem', position: 1, name: 'Home', item: `${BASE}/` },
    { '@type': 'ListItem', position: 2, name: 'For developers', item: `${BASE}/for-developers` },
  ],
};

export default function ForDevelopersPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(BREADCRUMB_LD) }}
      />

      <header className="nav">
        <div className="wrap nav-in">
          <a className="brand" href="/" aria-label="HonestTotal home">
            <span className="mk" aria-hidden="true" />
            HonestTotal
          </a>
          <nav className="nav-links">
            <a href="/">Home</a>
            <a href="/how-we-rank">How we rank</a>
            <a className="active" href="/for-developers">
              For developers
            </a>
          </nav>
          <a className="btn btn-primary" href="/#cta">
            Join the waitlist
          </a>
        </div>
      </header>

      <main id="main-content" tabIndex={-1}>
        <section id="agent" style={{ borderTop: 0 }}>
          <div className="wrap">
            <SectionHead
              eyebrow="Agent-first · built for developers"
              title="Every capability is an API before it's a screen."
            >
              The tools the HonestTotal agent will call are a first-class public surface — the same
              ones a partner&apos;s assistant can call, scope-gated. The web app is just one
              renderer.
            </SectionHead>
            <div className="agent-grid">
              <div>
                <div className="agent-points">
                  <AgentPoint index="01" title="Natural language in, structured deal out">
                    Ask in plain words; get a ranked, machine-readable offer with a signed hand-off
                    link.
                  </AgentPoint>
                  <AgentPoint index="02" title="Disclosure travels with the response">
                    Every API response will carry a <span className="mono">disclosure</span> field,
                    verbalized before any redirect. The API is designed, not yet built.
                  </AgentPoint>
                  <AgentPoint index="03" title="No unverified price, ever">
                    Prices will be deterministically verified before they are shown, so a
                    hallucinated price cannot reach you. No price is served today.
                  </AgentPoint>
                </div>
              </div>
              <AgentTerminal
                session="nexus-agent · session"
                ariaLabel="Illustrative example conversation with the HonestTotal agent"
              >
                <div>
                  <span className="u">you ›</span> find the best price on a pair of over-ear
                  headphones — authorized sellers only
                </div>
                <div style={{ marginTop: '10px' }}>
                  <span className="n">nexus ›</span> Best real price:{' '}
                  <span className="n">$328.00</span> at Merchant A
                </div>
                <div>
                  <span className="muted2">
                    &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;ranked by value, not payout · illustrative
                    exchange, no live data
                  </span>
                </div>
                <div className="disc" style={{ marginTop: '8px' }}>
                  &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;heads up: I may earn a commission — it never
                  changes my pick.
                </div>
                <div>
                  <span className="cta-line">Hand off to Merchant A →</span>
                </div>
              </AgentTerminal>
            </div>

            <div className="hero-cta" style={{ justifyContent: 'center', marginTop: 28 }}>
              <a className="btn btn-primary" href="/#cta">
                Join the waitlist →
              </a>
              <a className="btn btn-ghost" href="/how-we-rank">
                How the ranking works
              </a>
            </div>
          </div>
        </section>
      </main>

      <SiteFooter note={<>API designed, not yet built · pre-launch</>} />
    </>
  );
}
