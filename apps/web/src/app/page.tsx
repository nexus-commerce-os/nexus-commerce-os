'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Brand, Button, Eyebrow, MetricStat, PhaseTag, SectionHead, Step } from '@nexus/ui';

import { SiteFooter } from '@/components/SiteFooter';

const DEFAULT_NOTE = 'No spam — just one email the moment HonestTotal opens in your region.';
const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

/** The one figure the receipt shows; the count-up animates to exactly this. */
const VERIFIED_SAVINGS = 47.12;

/**
 * Where the chosen theme is remembered. Must match the key the inline script in
 * `layout.tsx` reads before first paint — that script is what stops a saved
 * dark theme flashing white on load.
 */
const THEME_KEY = 'nexus-theme';

/*
 * Homepage structured data. Deliberately WebSite only — no SearchAction, because
 * the site has no search; no Organization, because that reads as a registered
 * entity and this project is founder-built and pre-launch. Schema.org describes
 * what exists, or it is another unverifiable claim.
 */
const WEBSITE_LD = {
  '@context': 'https://schema.org',
  '@type': 'WebSite',
  name: 'HonestTotal',
  url: 'https://honesttotal.com/',
  description:
    'A pre-launch price comparison built on one rule: rank by the total you actually pay, and never let commission change the order.',
};

export default function NexusLanding() {
  const countRef = useRef<HTMLSpanElement>(null);
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);
  /*
   * Whether the address was ALREADY on the list.
   *
   * The Worker has always computed this and returned `status: 'duplicate'`,
   * and the no-JavaScript path has always shown it (`?joined=already`). The
   * hydrated path read `ok` and threw the rest away, so a visitor who signed
   * up twice got an identical "You're on the list" both times — the JS path
   * showed LESS than the no-JS fallback, which is the wrong way round.
   */
  const [already, setAlready] = useState(false);
  const [busy, setBusy] = useState(false);
  const [who, setWho] = useState('you');
  const [note, setNote] = useState(DEFAULT_NOTE);
  const [noteErr, setNoteErr] = useState(false);
  /*
   * `demoOpen` starts true so the server-rendered HTML carries the panel open;
   * the effect below closes it on a narrow viewport once scripts run.
   * `mounted` gates the toggle button for the same reason — a button that does
   * nothing without JavaScript is worse than no button.
   */
  const [demoOpen, setDemoOpen] = useState(true);
  const [mounted, setMounted] = useState(false);

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
      const data = (await res.json()) as { ok?: boolean; status?: string; error?: string };
      if (res.ok && data.ok) {
        const local = v.split('@')[0] ?? 'you';
        setWho(local.length > 18 ? 'you' : local);
        setAlready(data.status === 'duplicate');
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

  /*
   * Collapse the hero illustration on a phone, once.
   *
   * Separate from the big effect below so it runs on mount and does not get
   * tangled in the observer teardown. `mounted` flips here too, which is what
   * reveals the toggle button — both facts ("scripts are running" and "this is
   * a narrow screen") are established in the same place.
   */
  useEffect(() => {
    setMounted(true);
    if (window.matchMedia('(max-width: 820px)').matches) setDemoOpen(false);

    /*
     * A visitor whose browser ran no JavaScript posted the form natively and
     * was sent back here with the outcome in the query string. If scripts are
     * working by the time they return — a different page load — show them the
     * same sentence the fetch path would have shown, and clean the parameter
     * out of the URL so a refresh does not repeat it.
     *
     * Read from `location.search` rather than a router hook because this page
     * is a static export: there is no server to read a search param for us.
     */
    const outcome = new URLSearchParams(window.location.search).get('joined');
    if (!outcome) return;
    const said: Record<string, [string, boolean]> = {
      ok: ["You're on the list.", false],
      already: ["You're already on the list.", false],
      invalid: ['Please enter a valid email address.', true],
      'slow-down': ['Too many attempts — please wait a minute.', true],
      error: ['Could not save right now — please try again.', true],
    };
    const [message, isError] = said[outcome] ?? ['', false];
    if (!message) return;
    setNote(message);
    setNoteErr(isError);
    if (!isError) {
      setAlready(outcome === 'already');
      setSubmitted(true);
    }
    window.history.replaceState(null, '', window.location.pathname + window.location.hash);
  }, []);

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
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(WEBSITE_LD) }}
      />

      <header className="nav">
        <div className="wrap nav-in">
          <Brand href="#main-content" />
          <nav className="nav-links" id="navlinks">
            <a href="#how">How it works</a>
            <a href="#ranking">Commission-blind</a>
            <a href="#savings">Verified savings</a>
            <a href="/for-developers">For developers</a>
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

      <main id="main-content" tabIndex={-1}>
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
                HonestTotal is a price comparison being built to find the genuinely best price
                across authorized merchants, hand you off to check out directly, and count a saving
                only once it is <b>verified</b>. Ranking will be by value — never by who pays us
                most.
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
            {/*
             * On a phone this illustration is 1,233px of the hero's 2,059px —
             * more than half the first screen's height, for something the badge
             * already calls an ILLUSTRATION and that `role="img"` already
             * summarises in one aria-label. So on narrow screens it collapses
             * behind a disclosure.
             *
             * It starts OPEN and JavaScript closes it, never the other way
             * round: the static HTML a no-JS phone receives is therefore the
             * panel in full, exactly as before, and the toggle only appears
             * once `mounted` proves scripts are running. Shipping it closed by
             * default would have hidden it permanently from anyone without JS.
             */}
            {mounted && (
              <button
                type="button"
                className="demo-toggle"
                aria-expanded={demoOpen}
                aria-controls="hero-demo-panel"
                onClick={() => setDemoOpen((open) => !open)}
              >
                {demoOpen ? 'Hide the example' : 'See an illustrated example'}
              </button>
            )}
            <div
              id="hero-demo-panel"
              className={`demo-panel reveal${demoOpen ? ' is-open' : ''}`}
              data-countup-root
              role="img"
              aria-label="Illustration of a price comparison: five merchants checked, best price 328 dollars, 47 dollars 12 cents below the typical price"
            >
              <div className="dp-glow" aria-hidden="true" />
              <div className="dp-head">
                <div>
                  <b>HonestTotal</b>
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
                  <p className="dp-title">Over-ear headphones</p>
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
          <div className="wrap">
            <p className="proof-cap">Guarantees, not usage figures — nothing has launched yet.</p>
          </div>
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

        {/*
         * The "Our promise" band was here. It said HonestTotal works for the
         * buyer, never for whoever pays us most — which is what the hero
         * paragraph two screens above already says, in nearly the same words,
         * and what the Trust section below says again. Three statements of one
         * claim do not make it three times as true; they make the page longer
         * and the claim cheaper. The hero keeps it.
         */}
        <section id="how">
          <div className="wrap">
            <SectionHead eyebrow="The model" title="A referral layer, not a checkout.">
              HonestTotal never holds your money, your order, or your inventory. It does one thing
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
                deep link. You pay them directly. HonestTotal takes no custody.
              </Step>
              <Step index="04" title="Verify the saving" className="reveal">
                The network confirms the purchase asynchronously. Only a confirmed, past-the-window
                saving is counted as real.
              </Step>
            </div>
          </div>
        </section>

        {/*
         * One section where there were three.
         *
         * `#ranking` and `#savings` each restated, at full length, an argument
         * that already has its own page — /commission-blind and
         * /verified-savings — and `#how` above had just made the same points a
         * third time. On a phone those two sections alone were 2,255px of
         * repetition, which is most of the reason the page ran to 9,583px.
         *
         * Nothing is lost: every claim still exists in full, on the page
         * written to carry it, and each is linked from here. A landing page's
         * job is to state the promise and let the reader choose which part to
         * check — not to be the whole argument.
         */}
        <section id="ranking">
          <div className="wrap">
            <SectionHead
              eyebrow="Why trust the order"
              title="The result that's best for you sits on top."
            >
              Most &quot;deal&quot; sites quietly sort by what pays them. Here, commission is never
              given to the ordering function at all — and a saving is only counted once the network
              has confirmed it. Both rules are written down, and both are checkable.
            </SectionHead>
            <div className="deep-links">
              <a className="deep-link" href="/how-we-rank">
                <span className="deep-link-title">How we rank</span>
                <span className="deep-link-note">
                  The full method, the inputs it is given, and the ones it is not.
                </span>
              </a>
              <a className="deep-link" href="/commission-blind">
                <span className="deep-link-title">Commission-blind</span>
                <span className="deep-link-note">
                  Why money cannot reach the ranking, and how that is meant to be enforced.
                </span>
              </a>
              <a className="deep-link" href="/verified-savings">
                <span className="deep-link-title">Verified savings</span>
                <span className="deep-link-note">
                  What counts as a saving, what does not, and why the figure is $0.00 today.
                </span>
              </a>
            </div>
          </div>
        </section>

        {/*
         * Six promises, as a list rather than six full-width cards.
         *
         * As cards these stacked to 1,454px on a phone — the largest block on
         * the page — to carry six sentences. The claims are unchanged word for
         * word; only the furniture around them is gone.
         */}
        <section id="trust">
          <div className="wrap">
            <SectionHead
              eyebrow="Trust & transparency"
              title="Promises we engineered, not just wrote."
            />
            <ul className="promises">
              <li>
                <b>Disclosed, every time.</b> Before any affiliate link, the agent tells you it may
                earn a commission — and that it never changes the recommendation (FTC-aligned).
              </li>
              <li>
                <b>Authorized data only.</b> Official APIs, licensed feeds and affiliate networks.
                No scraping, no copyright shortcuts.
              </li>
              <li>
                <b>Un-buyable ranking.</b> Sponsored placements are always labelled and visually
                distinct. Commission can never raise a product&apos;s rank.
              </li>
              <li>
                <b>No custody.</b> HonestTotal never becomes merchant of record. You pay the
                merchant directly through a signed hand-off.
              </li>
              <li>
                <b>Your data stays yours.</b> Personalization will be a feature you control, not
                surveillance. Today nothing personal is collected at all — see the{' '}
                <a href="/privacy">privacy page</a>.
              </li>
              <li>
                <b>Honest by metric.</b> Our north star is Verified Money Saved. It counts only
                confirmed savings, so it is falsifiable rather than marketing.
              </li>
            </ul>
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
                label="AI cost per request — design budget, not yet measured"
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
                <summary>How does HonestTotal actually make money?</summary>
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
                  No. Today the only thing stored is a waitlist email, if you submit one — no
                  cookies, no analytics, no trackers. When personalization exists it will be
                  something you can inspect and reset, and we will never take payment custody.
                </p>
              </details>
              <details className="reveal">
                <summary>Is this just another cashback or coupon app?</summary>
                <p>
                  No. Cashback (where legal) is one feature, not the point. HonestTotal is being
                  built that finds the best real price and proves the saving — coupons and cashback
                  are inputs to &quot;best price&quot;, not the product.
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
                <summary>Where will HonestTotal be available?</summary>
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
                  <span className="chk">✓</span>{' '}
                  {already ? "You're already on the list." : "You're on the list."} We&apos;ll email{' '}
                  <b>{who}</b> the moment your region opens.
                </p>
              ) : (
                <>
                  {/*
                   * `action`, `method` and the field `name` are what make this
                   * form work WITHOUT JavaScript. They are not decoration:
                   * without them, a browser that never hydrated submitted
                   * nothing anywhere, and the address was lost in silence.
                   * That is what the live site did, because its CSP blocked
                   * Next's inline bootstrap scripts and React never ran.
                   *
                   * When React IS running, `onSubmit` calls preventDefault and
                   * the fetch path behaves exactly as before. The native post
                   * is the floor, not the normal case.
                   */}
                  <form
                    className="wl"
                    action="/api/waitlist"
                    method="post"
                    onSubmit={onSubmit}
                    noValidate
                  >
                    <input
                      className="wl-input"
                      type="email"
                      name="email"
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

      <SiteFooter note="Built buyer-first · disclosed · authorized-data-only" />
    </>
  );
}
