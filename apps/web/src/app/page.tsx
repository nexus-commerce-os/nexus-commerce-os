'use client';

import React, { useEffect, useRef, useState } from 'react';
import {
  AgentPoint,
  AgentTerminal,
  Brand,
  Button,
  Card,
  Eyebrow,
  FeatureCard,
  Footer,
  MetricStat,
  PhaseTag,
  SectionHead,
  StatePill,
  Step,
} from '@nexus/ui';

const DEFAULT_NOTE = 'No spam — just one email the moment NEXUS opens in your region.';
const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

/** The one figure the receipt shows; the count-up animates to exactly this. */
const VERIFIED_SAVINGS = 47.12;

/**
 * Where the chosen theme is remembered. Must match the key the inline script in
 * `layout.tsx` reads before first paint — that script is what stops a saved
 * dark theme flashing white on load.
 */
const THEME_KEY = 'nexus-theme';

export default function NexusLanding() {
  const countRef = useRef<HTMLSpanElement>(null);
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [who, setWho] = useState('you');
  const [note, setNote] = useState(DEFAULT_NOTE);
  const [noteErr, setNoteErr] = useState(false);

  const toggleTheme = () => {
    const root = document.documentElement;
    const cur = root.getAttribute('data-theme');
    const dark = cur ? cur === 'dark' : window.matchMedia('(prefers-color-scheme:dark)').matches;
    const next = dark ? 'light' : 'dark';
    root.setAttribute('data-theme', next);
    // Remember the choice. Without this the toggle was forgotten on every
    // navigation, so `/` → `/ui` snapped back to the OS preference. Wrapped
    // because storage throws in private mode on some browsers, and a failed
    // preference must never break the page.
    try {
      window.localStorage.setItem(THEME_KEY, next);
    } catch {
      /* preference not persisted; the page still works */
    }
  };

  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const v = email.trim();
    if (!EMAIL_RE.test(v)) {
      setNote('Please enter a valid email address.');
      setNoteErr(true);
      return;
    }
    setBusy(true);
    try {
      const res = await fetch('/api/waitlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: v }),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (res.ok && data.ok) {
        const local = v.split('@')[0] ?? 'you';
        setWho(local.length > 18 ? 'you' : local);
        setSubmitted(true);
      } else {
        setNote(data.error ?? 'Something went wrong — please try again.');
        setNoteErr(true);
      }
    } catch {
      setNote('Network error — please try again.');
      setNoteErr(true);
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    const root = document.documentElement;
    const reduce = window.matchMedia('(prefers-reduced-motion:reduce)').matches;
    const cleanups: Array<() => void> = [];

    // --- Verified-savings count-up (with resilience if the observer is throttled) ---
    const el = countRef.current;
    if (el) {
      const targetVal = VERIFIED_SAVINGS;
      const fmt = (n: number) => n.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
      if (reduce) {
        el.textContent = fmt(targetVal);
      } else {
        let startT: number | null = null;
        let started = false;
        const step = (t: number) => {
          if (startT === null) startT = t;
          const p = Math.min((t - startT) / 1400, 1);
          const eased = 1 - Math.pow(1 - p, 3);
          el.textContent = fmt(targetVal * eased);
          if (p < 1) requestAnimationFrame(step);
        };
        const go = () => {
          if (started) return;
          started = true;
          requestAnimationFrame(step);
        };
        const rc = el.closest('[data-countup-root]');
        if (rc) {
          const io = new IntersectionObserver(
            (entries, ob) => {
              entries.forEach((x) => {
                if (x.isIntersecting) {
                  go();
                  ob.disconnect();
                }
              });
            },
            { threshold: 0.35 },
          );
          io.observe(rc);
          cleanups.push(() => io.disconnect());
          const timer = window.setTimeout(() => {
            const r = rc.getBoundingClientRect();
            if (r.top < window.innerHeight && r.bottom > 0) go();
          }, 700);
          cleanups.push(() => window.clearTimeout(timer));
        }
      }
    }

    // --- Scroll reveal (progressive enhancement: content is visible without `.anim`) ---
    const reveals = Array.from(document.querySelectorAll<HTMLElement>('.reveal'));
    if (reduce) {
      reveals.forEach((n) => n.classList.add('in'));
    } else {
      root.classList.add('anim');
      const revealIO = new IntersectionObserver(
        (entries) => {
          entries.forEach((x) => {
            if (x.isIntersecting) {
              x.target.classList.add('in');
              revealIO.unobserve(x.target);
            }
          });
        },
        { threshold: 0.15 },
      );
      reveals.forEach((n) => revealIO.observe(n));
      cleanups.push(() => {
        revealIO.disconnect();
        root.classList.remove('anim');
      });
    }

    // --- Active-nav highlight on scroll ---
    const links = Array.from(document.querySelectorAll<HTMLAnchorElement>('#navlinks a'));
    const map = new Map<string, HTMLAnchorElement>();
    links.forEach((a) => {
      const id = (a.getAttribute('href') ?? '').slice(1);
      if (id && document.getElementById(id)) map.set(id, a);
    });
    const spy = new IntersectionObserver(
      (entries) => {
        entries.forEach((x) => {
          if (x.isIntersecting) {
            links.forEach((a) => a.classList.remove('active'));
            map.get(x.target.id)?.classList.add('active');
          }
        });
      },
      { rootMargin: '-45% 0px -50% 0px' },
    );
    map.forEach((_a, id) => {
      const s = document.getElementById(id);
      if (s) spy.observe(s);
    });
    cleanups.push(() => spy.disconnect());

    return () => cleanups.forEach((fn) => fn());
  }, []);

  return (
    <>
      <header className="nav">
        <div className="wrap nav-in">
          <Brand href="#top" />
          <nav className="nav-links" id="navlinks">
            <a href="#how">How it works</a>
            <a href="#ranking">Commission-blind</a>
            <a href="#savings">Verified savings</a>
            <a href="#agent">For developers</a>
            <a href="#faq">FAQ</a>
          </nav>
          <button
            className="theme-toggle"
            onClick={toggleTheme}
            aria-label="Toggle colour theme"
            type="button"
          >
            ◐
          </button>
          <Button href="#cta">Join the waitlist</Button>
        </div>
      </header>

      <main id="top">
        <section className="hero" style={{ borderTop: 0 }}>
          <div className="wrap hero-grid">
            <div>
              <span className="pill-eyebrow">
                <span aria-hidden="true">✦</span>
                <Eyebrow>AI shopping · pure referral · zero custody</Eyebrow>
              </span>
              <h1 className="hero-h1">
                <span className="h1-underlined">Save first.</span>
                <br />
                <em>We earn</em> later.
              </h1>
              <p className="lede">
                NEXUS is an AI buying agent that finds the genuinely best price across authorized
                merchants, hands you off to check out directly, and counts a saving only once
                it&apos;s <b>verified</b>. Ranking is by value — never by who pays us most.
              </p>
              <ul className="hero-chips">
                <li>
                  <span className="chip-ic" aria-hidden="true">
                    ✓
                  </span>
                  Commission-blind ranking
                </li>
                <li>
                  <span className="chip-ic" aria-hidden="true">
                    ✓
                  </span>
                  No payment custody
                </li>
                <li>
                  <span className="chip-ic" aria-hidden="true">
                    ✓
                  </span>
                  Disclosed, always
                </li>
              </ul>
              <div className="hero-cta">
                <Button href="#cta">Join the waitlist →</Button>
                <Button variant="ghost" href="#how">
                  See how it works
                </Button>
              </div>
              {/*
               * Where a launched product would put "4.9 from 1,200+ users", this
               * says the opposite, because the alternative is inventing people.
               * On a site whose entire argument is that it only claims what it
               * can prove, borrowed social proof would be the first lie told.
               */}
              <p className="prelaunch">
                <b>Pre-launch.</b> No users yet, and no merchant partnerships yet — we will not
                invent either. Every figure on this page is one we can defend.
              </p>
            </div>

            {/*
             * The demo panel. Every merchant is "Merchant A/B/C" and the header
             * says ILLUSTRATION, because naming Amazon or Best Buy beside a price
             * we invented would be a fabricated claim attributed to a real
             * company — and we have no relationship with any of them to invoke.
             */}
            <div
              className="demo-panel reveal"
              data-countup-root
              role="img"
              aria-label="Illustration of a price comparison: five merchants checked, best price 328 dollars, 47 dollars 12 cents below the typical price"
            >
              <div className="dp-glow" aria-hidden="true" />
              <div className="dp-head">
                <div>
                  <b>NEXUS AI</b>
                  <span className="dp-sub">Illustrative example — not live data</span>
                </div>
                <span className="dp-badge">ILLUSTRATION</span>
              </div>

              <div className="dp-product">
                <div className="dp-thumb" aria-hidden="true">
                  <svg viewBox="0 0 64 64" width="100%" height="100%">
                    <path
                      d="M14 38V32a18 18 0 0 1 36 0v6"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="3.5"
                      strokeLinecap="round"
                    />
                    <rect x="8" y="36" width="12" height="18" rx="5" fill="currentColor" />
                    <rect x="44" y="36" width="12" height="18" rx="5" fill="currentColor" />
                  </svg>
                </div>
                <div className="dp-facts">
                  <h3>Over-ear headphones</h3>
                  <p className="dp-sub">One product, five merchants, one honest total</p>
                  <div className="dp-price-row">
                    <div>
                      <span className="dp-label">Best price found</span>
                      <div className="dp-price mono">$328.00</div>
                    </div>
                    <div className="dp-save">
                      <span className="dp-label">You save</span>
                      <div className="dp-save-v mono">
                        {/* Rendered with the real figure so a crawler, a social-preview
                            bot, a throttled tab or JS-off never shows the headline proof
                            as "$0.00"; the count-up overwrites it from ~0 once it runs. */}
                        $<span ref={countRef}>{VERIFIED_SAVINGS.toFixed(2)}</span>
                      </div>
                      <span className="dp-vs mono">vs typical $375.12</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="dp-lower">
                <div className="dp-stores">
                  <div className="dp-stores-h">Merchants checked</div>
                  {[
                    { m: 'Merchant A', p: '$328.00', best: true },
                    { m: 'Merchant B', p: '$341.99' },
                    { m: 'Merchant C', p: '$348.00' },
                    { m: 'Merchant D', p: '$349.99' },
                    { m: 'Merchant E', p: '$352.98' },
                  ].map((r) => (
                    <div className="dp-store" key={r.m}>
                      <span>{r.m}</span>
                      <span className="mono">{r.p}</span>
                      {r.best ? (
                        <span className="dp-best">BEST</span>
                      ) : (
                        <span className="dp-ok" aria-hidden="true">
                          ✓
                        </span>
                      )}
                    </div>
                  ))}
                </div>

                {/*
                 * The rings depict what the ranker does, not a live scan — the
                 * three lines under them are the actual rules, so the ornament
                 * and the claim say the same thing.
                 */}
                <div className="dp-scan">
                  <div className="dp-stores-h">Ranking rules</div>
                  <div className="dp-rings" aria-hidden="true">
                    <span className="ring r1" />
                    <span className="ring r2" />
                    <span className="ring r3" />
                    <span className="core" />
                  </div>
                  <ul className="dp-rules">
                    <li>Price and shipping normalised</li>
                    <li>Commission not in the input</li>
                    <li>Unverified offers excluded</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/*
         * Where the reference design puts usage counts — merchants, users, star
         * ratings — these are guarantees instead. A pre-launch product has no
         * usage to report, but it can state exactly what it will and will not do,
         * and every one of these is checkable against the code.
         */}
        <section className="proof-strip" aria-label="What we guarantee">
          <div className="wrap proof-grid">
            {[
              { n: '0', t: 'Commission signals', s: 'visible to the ranker' },
              { n: '$0', t: 'Of your money', s: 'we ever hold' },
              { n: '100%', t: 'Affiliate links', s: 'disclosed, always' },
              { n: '0', t: 'Prices shown', s: 'without a source' },
            ].map((s) => (
              <div className="proof-item" key={s.t}>
                <div className="proof-n mono">{s.n}</div>
                <div className="proof-t">{s.t}</div>
                <div className="proof-s">{s.s}</div>
              </div>
            ))}
          </div>
        </section>

        <div className="promise-band">
          <div className="wrap">
            <Eyebrow>Our promise</Eyebrow>
            <p className="q reveal">
              NEXUS works for the <em>buyer</em> — never for whoever pays us most.
            </p>
            <p className="sub reveal">
              Everything below is engineered, tested, and auditable, not marketing. Our
              recommendation function literally cannot see commission, and we count a saving as real
              only after the merchant confirms it. If we can&apos;t prove it, we don&apos;t claim
              it.
            </p>
          </div>
        </div>

        <section id="how">
          <div className="wrap">
            <SectionHead eyebrow="The model" title="A referral layer, not a checkout.">
              NEXUS never holds your money, your order, or your inventory. It does one thing
              extremely well: find the best legitimate deal and get out of the way.
            </SectionHead>
            <div className="steps">
              <Step index="01" title="Ask" className="reveal">
                Tell the agent what you want — in words. It&apos;s an API before it&apos;s a screen,
                so it works in chat, on the web, or inside your own assistant.
              </Step>
              <Step index="02" title="Find the real price" className="reveal">
                It searches only authorized feeds and affiliate networks — never scraping — and
                ranks purely by your value, blind to commission.
              </Step>
              <Step index="03" title="Signed hand-off" className="reveal">
                You&apos;re handed to the merchant&apos;s own checkout via a signed, allow-listed
                deep link. You pay them directly. NEXUS takes no custody.
              </Step>
              <Step index="04" title="Verify the saving" className="reveal">
                The network confirms the purchase asynchronously. Only a confirmed, past-the-window
                saving is counted as real.
              </Step>
            </div>
          </div>
        </section>

        <section id="ranking">
          <div className="wrap">
            <SectionHead
              eyebrow="Commission-blind by design"
              title="The result that's best for you sits on top."
            >
              Most &quot;deal&quot; sites quietly sort by what pays them. NEXUS&apos;s ranking
              function cannot see commission at all — it&apos;s a fitness test enforced in CI, not a
              promise on a page.
            </SectionHead>
            <div className="rank">
              <Card className="rank-card reveal">
                <h3>
                  <span className="dot" style={{ background: 'var(--accent)' }} /> NEXUS — ranked by
                  your value
                </h3>
                <div className="row">
                  <span>Merchant A</span>
                  <span className="price">$328.00</span>
                  <span className="tagpill win">Top pick</span>
                </div>
                <div className="row">
                  <span>Merchant B</span>
                  <span className="price">$339.50</span>
                  <span className="tagpill">2nd</span>
                </div>
                <div className="row">
                  <span>Merchant C</span>
                  <span className="price">$351.00</span>
                  <span className="tagpill">3rd</span>
                </div>
              </Card>
              <Card className="rank-card reveal">
                <h3>
                  <span className="dot" style={{ background: 'var(--amber)' }} /> Typical
                  &quot;deal&quot; site — ranked by payout
                </h3>
                <div className="row">
                  <span>Merchant C</span>
                  <span className="price">$351.00</span>
                  <span className="tagpill paid">Pays most</span>
                </div>
                <div className="row">
                  <span>Merchant B</span>
                  <span className="price">$339.50</span>
                  <span className="tagpill">2nd</span>
                </div>
                <div className="row">
                  <span>Merchant A</span>
                  <span className="price">$328.00</span>
                  <span className="tagpill">Buried</span>
                </div>
              </Card>
            </div>
          </div>
        </section>

        <section id="savings">
          <div className="wrap">
            <SectionHead
              eyebrow="Verified Money Saved · the north star"
              title="Every saving has an honest state."
            >
              We won&apos;t show you money you might not keep. A figure moves through four states,
              and only <b>Confirmed</b> counts toward your Verified Money Saved.
            </SectionHead>
            <div className="life">
              <Card className="life-card reveal">
                <StatePill state="estimated">Estimated</StatePill>
                <h3>Projected</h3>
                <p>Before you buy — clearly labelled an estimate, never a guarantee.</p>
                <span className="arrow">→</span>
              </Card>
              <Card className="life-card reveal">
                <StatePill state="pending">Pending</StatePill>
                <h3>Awaiting confirm</h3>
                <p>
                  You bought; we&apos;re waiting on the network&apos;s confirmation and the return
                  window.
                </p>
                <span className="arrow">→</span>
              </Card>
              <Card className="life-card reveal">
                <StatePill state="confirmed">Confirmed</StatePill>
                <h3>Counts toward VMS</h3>
                <p>
                  Network-confirmed and past the hold period. The only state that&apos;s truly
                  yours.
                </p>
                <span className="arrow">→</span>
              </Card>
              <Card className="life-card reveal">
                <StatePill state="reversed">Reversed</StatePill>
                <h3>Returned</h3>
                <p>A cancellation or return reverses it — transparently, per published terms.</p>
              </Card>
            </div>
          </div>
        </section>

        <section id="agent">
          <div className="wrap">
            <SectionHead
              eyebrow="Agent-first · built for developers"
              title="Every capability is an API before it's a screen."
            >
              The tools the NEXUS agent calls are a first-class public surface — the same ones a
              partner&apos;s assistant can call, scope-gated. The web app is just one renderer.
            </SectionHead>
            <div className="agent-grid">
              <div>
                <div className="agent-points">
                  <AgentPoint
                    index="01"
                    title="Natural language in, structured deal out"
                    className="reveal"
                  >
                    Ask in plain words; get a ranked, machine-readable offer with a signed hand-off
                    link.
                  </AgentPoint>
                  <AgentPoint
                    index="02"
                    title="Disclosure travels with the response"
                    className="reveal"
                  >
                    Every API response carries a <span className="mono">disclosure</span> field; the
                    agent verbalizes it before any redirect.
                  </AgentPoint>
                  <AgentPoint index="03" title="No unverified price, ever" className="reveal">
                    Prices are deterministically verified before they&apos;re shown — a hallucinated
                    price can&apos;t reach you.
                  </AgentPoint>
                </div>
              </div>
              <AgentTerminal
                session="nexus-agent · session"
                className="reveal"
                ariaLabel="Example conversation with the NEXUS agent"
              >
                <div>
                  <span className="u">you ›</span> find the best price on the Sony XM5 — authorized
                  sellers only
                </div>
                <div style={{ marginTop: '10px' }}>
                  <span className="n">nexus ›</span> Best real price:{' '}
                  <span className="n">$328.00</span> at Merchant A
                </div>
                <div>
                  <span className="muted2">
                    &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;ranked by value, not payout · verified just
                    now
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
          </div>
        </section>

        <section id="trust">
          <div className="wrap">
            <SectionHead
              eyebrow="Trust & transparency"
              title="Promises we engineered, not just wrote."
            />
            <div className="trust">
              <FeatureCard icon="%" title="Disclosed, every time" className="reveal">
                Before any affiliate link, the agent tells you it may earn a commission — and that
                it never changes the recommendation (FTC-aligned).
              </FeatureCard>
              <FeatureCard icon="⌘" title="Authorized data only" className="reveal">
                Official APIs, licensed feeds, and affiliate networks. No scraping, no copyright
                shortcuts — legitimacy is built in.
              </FeatureCard>
              <FeatureCard icon="=" title="Un-buyable ranking" className="reveal">
                Sponsored placements are always labelled and visually distinct. Commission can never
                raise a product&apos;s rank.
              </FeatureCard>
              <FeatureCard icon="↔" title="No custody" className="reveal">
                NEXUS never becomes merchant of record. You pay the merchant directly through a
                signed hand-off.
              </FeatureCard>
              <FeatureCard icon="◈" title="Your data stays yours" className="reveal">
                Personalization is a feature, not surveillance — you can see and reset what drives
                your recommendations.
              </FeatureCard>
              <FeatureCard icon="✓" title="Honest by metric" className="reveal">
                Our north star is Verified Money Saved. It counts only confirmed savings — so
                it&apos;s falsifiable, not marketing.
              </FeatureCard>
            </div>
          </div>
        </section>

        <section>
          <div className="wrap">
            <div className="band reveal">
              <MetricStat value={<em>$0.00</em>} label="Taken from your wallet — ever" />
              <MetricStat
                value={
                  <>
                    ≤ <em>1¢</em>
                  </>
                }
                label="AI cost per request, by design"
              />
              <MetricStat value={<em>100%</em>} label="Disclosed affiliate relationships" />
              <MetricStat value={<em>0</em>} label="Scraped data sources" />
            </div>
            <div style={{ marginTop: '34px' }}>
              <Eyebrow>Phased, region-before-market</Eyebrow>
              <div className="rollout">
                <PhaseTag code="P1" live>
                  United States
                </PhaseTag>
                <PhaseTag code="P2">CA · UK · AU</PhaseTag>
                <PhaseTag code="P3">EU</PhaseTag>
                <PhaseTag code="P4">BD · IN · PK · ME</PhaseTag>
              </div>
            </div>
          </div>
        </section>

        <section id="faq">
          <div className="wrap">
            <SectionHead eyebrow="Questions, answered plainly" title="The honest FAQ." />
            <div className="faq">
              <details className="reveal">
                <summary>How does NEXUS actually make money?</summary>
                <p>
                  Affiliate commissions the merchant pays when you buy through our hand-off link.
                  Crucially, commission is invisible to our ranking — we&apos;re paid the same
                  regardless of which result you pick, so our incentive is simply to make you save
                  and buy.
                </p>
              </details>
              <details className="reveal">
                <summary>Do you sell my data or track me around the web?</summary>
                <p>
                  No. Personalization is a feature you control, not surveillance. You can see
                  exactly what drives your recommendations and reset it. We take no payment custody
                  and store only what a referral needs.
                </p>
              </details>
              <details className="reveal">
                <summary>Is this just another cashback or coupon app?</summary>
                <p>
                  No. Cashback (where legal) is one feature, not the point. NEXUS is an AI agent
                  that finds the best real price and proves the saving — coupons and cashback are
                  inputs to &quot;best price&quot;, not the product.
                </p>
              </details>
              <details className="reveal">
                <summary>What does &quot;verified&quot; actually mean?</summary>
                <p>
                  A saving only counts once the merchant network confirms the purchase and it clears
                  the return window. Until then it&apos;s shown as <b>Pending</b>, never as money
                  you&apos;ve banked. Returns reverse it, transparently.
                </p>
              </details>
              <details className="reveal">
                <summary>Where is NEXUS available?</summary>
                <p>
                  Rolling out region-before-market: United States first, then Canada / UK /
                  Australia, then the EU, then Bangladesh / India / Pakistan / the Middle East —
                  each only after its data-residency and legal review passes.
                </p>
              </details>
            </div>
          </div>
        </section>

        <section id="cta" style={{ borderTop: 0 }}>
          <div className="wrap">
            <div className="cta-final reveal">
              <h2>Shopping that&apos;s finally on your side.</h2>
              <p>
                Be first to try the AI agent that&apos;s paid to save you money — and proves it, one
                verified receipt at a time.
              </p>
              {submitted ? (
                <p className="wl-ok">
                  <span className="chk">✓</span> You&apos;re on the list. We&apos;ll email{' '}
                  <b>{who}</b> the moment your region opens.
                </p>
              ) : (
                <>
                  <form className="wl" onSubmit={onSubmit} noValidate>
                    <input
                      className="wl-input"
                      type="email"
                      required
                      placeholder="you@email.com"
                      aria-label="Email address"
                      autoComplete="email"
                      value={email}
                      disabled={busy}
                      onChange={(e) => {
                        setEmail(e.target.value);
                        setNote(DEFAULT_NOTE);
                        setNoteErr(false);
                      }}
                    />
                    <Button type="submit" disabled={busy}>
                      {busy ? 'Joining…' : 'Join the waitlist →'}
                    </Button>
                  </form>
                  <p className="wl-note" style={noteErr ? { color: 'var(--amber)' } : undefined}>
                    {note}
                  </p>
                </>
              )}
            </div>
          </div>
        </section>
      </main>

      <Footer
        note="A pure referral + affiliate intelligence layer. Codename NEXUS — consumer brand deferred. Illustrative figures shown."
        columns={[
          {
            heading: 'Product',
            links: [
              { label: 'How it works', href: '#how' },
              { label: 'How we rank', href: '/how-we-rank' },
              { label: 'Buying guide: over-ears', href: '/guides/over-ear-headphones' },
              { label: 'ANC explained', href: '/guides/how-anc-works' },
              { label: 'Commission-blind', href: '/commission-blind' },
              { label: 'Verified savings', href: '/verified-savings' },
              { label: 'For developers', href: '#agent' },
            ],
          },
          {
            heading: 'Company',
            links: [
              { label: 'About', href: '/about' },
              { label: 'Trust & transparency', href: '#trust' },
              { label: 'FAQ', href: '#faq' },
              { label: 'Waitlist', href: '#cta' },
            ],
          },
          {
            heading: 'Legal',
            links: [
              { label: 'Affiliate disclosure', href: '/disclosure' },
              { label: 'Savings terms', href: '/verified-savings' },
              { label: 'Privacy', href: '/disclosure' },
            ],
          },
        ]}
        bottomLeft="© 2026 NEXUS Commerce OS"
        bottomRight="Built buyer-first · disclosed · authorized-data-only"
      />
    </>
  );
}
