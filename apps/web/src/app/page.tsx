"use client";

import React, { useEffect, useRef, useState } from "react";

const DEFAULT_NOTE = "No spam — just one email the moment NEXUS opens in your region.";

export default function NexusLanding() {
  const countRef = useRef<HTMLSpanElement>(null);
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [who, setWho] = useState("you");
  const [note, setNote] = useState(DEFAULT_NOTE);
  const [noteErr, setNoteErr] = useState(false);

  const toggleTheme = () => {
    const root = document.documentElement;
    const cur = root.getAttribute("data-theme");
    const dark = cur
      ? cur === "dark"
      : window.matchMedia("(prefers-color-scheme:dark)").matches;
    root.setAttribute("data-theme", dark ? "light" : "dark");
  };

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const v = email.trim();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v)) {
      setNote("Please enter a valid email address.");
      setNoteErr(true);
      return;
    }
    const local = v.split("@")[0] ?? "you";
    setWho(local.length > 18 ? "you" : local);
    setSubmitted(true);
  };

  useEffect(() => {
    const root = document.documentElement;
    const reduce = window.matchMedia("(prefers-reduced-motion:reduce)").matches;
    const cleanups: Array<() => void> = [];

    // --- Verified-savings count-up (with resilience if the observer is throttled) ---
    const el = countRef.current;
    if (el) {
      const targetVal = 47.12;
      const fmt = (n: number) =>
        n.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
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
        const rc = el.closest(".receipt");
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
    const reveals = Array.from(
      document.querySelectorAll<HTMLElement>(".reveal"),
    );
    if (reduce) {
      reveals.forEach((n) => n.classList.add("in"));
    } else {
      root.classList.add("anim");
      const revealIO = new IntersectionObserver(
        (entries) => {
          entries.forEach((x) => {
            if (x.isIntersecting) {
              x.target.classList.add("in");
              revealIO.unobserve(x.target);
            }
          });
        },
        { threshold: 0.15 },
      );
      reveals.forEach((n) => revealIO.observe(n));
      cleanups.push(() => {
        revealIO.disconnect();
        root.classList.remove("anim");
      });
    }

    // --- Active-nav highlight on scroll ---
    const links = Array.from(
      document.querySelectorAll<HTMLAnchorElement>("#navlinks a"),
    );
    const map = new Map<string, HTMLAnchorElement>();
    links.forEach((a) => {
      const id = (a.getAttribute("href") ?? "").slice(1);
      if (id && document.getElementById(id)) map.set(id, a);
    });
    const spy = new IntersectionObserver(
      (entries) => {
        entries.forEach((x) => {
          if (x.isIntersecting) {
            links.forEach((a) => a.classList.remove("active"));
            map.get(x.target.id)?.classList.add("active");
          }
        });
      },
      { rootMargin: "-45% 0px -50% 0px" },
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
          <a className="brand" href="#top" aria-label="NEXUS Commerce OS home">
            <span className="mk" aria-hidden="true" />
            NEXUS <small>Commerce&nbsp;OS</small>
          </a>
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
          <a className="btn btn-primary" href="#cta">
            Join the waitlist
          </a>
        </div>
      </header>

      <main id="top">
        <section className="hero" style={{ borderTop: 0 }}>
          <div className="wrap hero-grid">
            <div>
              <p className="eyebrow">AI shopping · pure referral, zero custody</p>
              <h1>
                We only make money <em>when you save money.</em>
              </h1>
              <p className="lede">
                NEXUS is an AI buying agent that finds the genuinely best price
                across authorized merchants, hands you off to check out directly,
                and counts a saving only once it&apos;s <b>verified</b>. Ranking is
                by value — never by who pays us most.
              </p>
              <div className="hero-cta">
                <a className="btn btn-primary" href="#cta">
                  Join the waitlist →
                </a>
                <a className="btn btn-ghost" href="#how">
                  See how it works
                </a>
              </div>
              <div className="assure">
                <span>
                  <b className="tick">✓</b> Commission-blind ranking
                </span>
                <span>
                  <b className="tick">✓</b> No payment custody
                </span>
                <span>
                  <b className="tick">✓</b> Disclosed, always
                </span>
              </div>
            </div>

            <div
              className="receipt reveal"
              role="img"
              aria-label="A verified savings receipt showing 47 dollars 12 cents saved"
            >
              <div className="rc-head">
                <b>NEXUS · VERIFIED SAVINGS</b>
                <span>RCPT&nbsp;#0007</span>
              </div>
              <div className="rc-row">
                <span>Item</span>
                <b>Sony WH-1000XM5</b>
              </div>
              <div className="rc-row">
                <span>Best real price found</span>
                <b className="mono">$328.00</b>
              </div>
              <div className="rc-row">
                <span>You paid at merchant</span>
                <b className="mono">$328.00</b>
              </div>
              <div className="rc-row">
                <span>List / typical price</span>
                <b className="mono">$375.12</b>
              </div>
              <div className="rc-rule" />
              <div className="rc-total">
                <span className="lab">Verified money saved</span>
                <span className="val mono">
                  $<span ref={countRef}>0.00</span>
                </span>
              </div>
              <div className="stamp">VERIFIED&nbsp;✓</div>
              <div className="rc-foot">
                Confirmed by the merchant network · past the return window ·
                counts toward your VMS
              </div>
            </div>
          </div>
        </section>

        <div className="promise-band">
          <div className="wrap">
            <p className="eyebrow">Our promise</p>
            <p className="q reveal">
              NEXUS works for the <em>buyer</em> — never for whoever pays us
              most.
            </p>
            <p className="sub reveal">
              Everything below is engineered, tested, and auditable, not
              marketing. Our recommendation function literally cannot see
              commission, and we count a saving as real only after the merchant
              confirms it. If we can&apos;t prove it, we don&apos;t claim it.
            </p>
          </div>
        </div>

        <section id="how">
          <div className="wrap">
            <div className="sec-head">
              <p className="eyebrow">The model</p>
              <h2>A referral layer, not a checkout.</h2>
              <p>
                NEXUS never holds your money, your order, or your inventory. It
                does one thing extremely well: find the best legitimate deal and
                get out of the way.
              </p>
            </div>
            <div className="steps">
              <div className="step reveal">
                <div className="n">STEP 01</div>
                <h3>Ask</h3>
                <p>
                  Tell the agent what you want — in words. It&apos;s an API before
                  it&apos;s a screen, so it works in chat, on the web, or inside
                  your own assistant.
                </p>
              </div>
              <div className="step reveal">
                <div className="n">STEP 02</div>
                <h3>Find the real price</h3>
                <p>
                  It searches only authorized feeds and affiliate networks —
                  never scraping — and ranks purely by your value, blind to
                  commission.
                </p>
              </div>
              <div className="step reveal">
                <div className="n">STEP 03</div>
                <h3>Signed hand-off</h3>
                <p>
                  You&apos;re handed to the merchant&apos;s own checkout via a
                  signed, allow-listed deep link. You pay them directly. NEXUS
                  takes no custody.
                </p>
              </div>
              <div className="step reveal">
                <div className="n">STEP 04</div>
                <h3>Verify the saving</h3>
                <p>
                  The network confirms the purchase asynchronously. Only a
                  confirmed, past-the-window saving is counted as real.
                </p>
              </div>
            </div>
          </div>
        </section>

        <section id="ranking">
          <div className="wrap">
            <div className="sec-head">
              <p className="eyebrow">Commission-blind by design</p>
              <h2>The result that&apos;s best for you sits on top.</h2>
              <p>
                Most &quot;deal&quot; sites quietly sort by what pays them.
                NEXUS&apos;s ranking function cannot see commission at all —
                it&apos;s a fitness test enforced in CI, not a promise on a page.
              </p>
            </div>
            <div className="rank">
              <div className="rank-card reveal">
                <h3>
                  <span className="dot" style={{ background: "var(--accent)" }} />{" "}
                  NEXUS — ranked by your value
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
              </div>
              <div className="rank-card reveal">
                <h3>
                  <span className="dot" style={{ background: "var(--amber)" }} />{" "}
                  Typical &quot;deal&quot; site — ranked by payout
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
              </div>
            </div>
          </div>
        </section>

        <section id="savings">
          <div className="wrap">
            <div className="sec-head">
              <p className="eyebrow">Verified Money Saved · the north star</p>
              <h2>Every saving has an honest state.</h2>
              <p>
                We won&apos;t show you money you might not keep. A figure moves
                through four states, and only <b>Confirmed</b> counts toward your
                Verified Money Saved.
              </p>
            </div>
            <div className="life">
              <div className="life-card reveal">
                <span className="st est">Estimated</span>
                <h3>Projected</h3>
                <p>
                  Before you buy — clearly labelled an estimate, never a
                  guarantee.
                </p>
                <span className="arrow">→</span>
              </div>
              <div className="life-card reveal">
                <span className="st pend">Pending</span>
                <h3>Awaiting confirm</h3>
                <p>
                  You bought; we&apos;re waiting on the network&apos;s
                  confirmation and the return window.
                </p>
                <span className="arrow">→</span>
              </div>
              <div className="life-card reveal">
                <span className="st conf">Confirmed</span>
                <h3>Counts toward VMS</h3>
                <p>
                  Network-confirmed and past the hold period. The only state
                  that&apos;s truly yours.
                </p>
                <span className="arrow">→</span>
              </div>
              <div className="life-card reveal">
                <span className="st rev">Reversed</span>
                <h3>Returned</h3>
                <p>
                  A cancellation or return reverses it — transparently, per
                  published terms.
                </p>
              </div>
            </div>
          </div>
        </section>

        <section id="agent">
          <div className="wrap">
            <div className="sec-head">
              <p className="eyebrow">Agent-first · built for developers</p>
              <h2>Every capability is an API before it&apos;s a screen.</h2>
              <p>
                The tools the NEXUS agent calls are a first-class public surface —
                the same ones a partner&apos;s assistant can call, scope-gated.
                The web app is just one renderer.
              </p>
            </div>
            <div className="agent-grid">
              <div>
                <div className="agent-points">
                  <div className="apt reveal">
                    <span className="k">01</span>
                    <div>
                      <b>Natural language in, structured deal out</b>
                      <p>
                        Ask in plain words; get a ranked, machine-readable offer
                        with a signed hand-off link.
                      </p>
                    </div>
                  </div>
                  <div className="apt reveal">
                    <span className="k">02</span>
                    <div>
                      <b>Disclosure travels with the response</b>
                      <p>
                        Every API response carries a{" "}
                        <span className="mono">disclosure</span> field; the agent
                        verbalizes it before any redirect.
                      </p>
                    </div>
                  </div>
                  <div className="apt reveal">
                    <span className="k">03</span>
                    <div>
                      <b>No unverified price, ever</b>
                      <p>
                        Prices are deterministically verified before they&apos;re
                        shown — a hallucinated price can&apos;t reach you.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
              <div
                className="term reveal"
                aria-label="Example conversation with the NEXUS agent"
              >
                <div className="bar">
                  <i style={{ background: "#E5695B" }} />
                  <i style={{ background: "#E4A94A" }} />
                  <i style={{ background: "#2BD48F" }} />
                  <span>nexus-agent · session</span>
                </div>
                <div className="body">
                  <div>
                    <span className="u">you ›</span> find the best price on the
                    Sony XM5 — authorized sellers only
                  </div>
                  <div style={{ marginTop: "10px" }}>
                    <span className="n">nexus ›</span> Best real price:{" "}
                    <span className="n">$328.00</span> at Merchant A
                  </div>
                  <div>
                    <span className="muted2">
                      &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;ranked by value, not
                      payout · verified just now
                    </span>
                  </div>
                  <div className="disc" style={{ marginTop: "8px" }}>
                    &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;heads up: I may earn a
                    commission — it never changes my pick.
                  </div>
                  <div>
                    <span className="cta-line">Hand off to Merchant A →</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section id="trust">
          <div className="wrap">
            <div className="sec-head">
              <p className="eyebrow">Trust &amp; transparency</p>
              <h2>Promises we engineered, not just wrote.</h2>
            </div>
            <div className="trust">
              <div className="promise reveal">
                <div className="ic">%</div>
                <h3>Disclosed, every time</h3>
                <p>
                  Before any affiliate link, the agent tells you it may earn a
                  commission — and that it never changes the recommendation
                  (FTC-aligned).
                </p>
              </div>
              <div className="promise reveal">
                <div className="ic">⌘</div>
                <h3>Authorized data only</h3>
                <p>
                  Official APIs, licensed feeds, and affiliate networks. No
                  scraping, no copyright shortcuts — legitimacy is built in.
                </p>
              </div>
              <div className="promise reveal">
                <div className="ic">=</div>
                <h3>Un-buyable ranking</h3>
                <p>
                  Sponsored placements are always labelled and visually distinct.
                  Commission can never raise a product&apos;s rank.
                </p>
              </div>
              <div className="promise reveal">
                <div className="ic">↔</div>
                <h3>No custody</h3>
                <p>
                  NEXUS never becomes merchant of record. You pay the merchant
                  directly through a signed hand-off.
                </p>
              </div>
              <div className="promise reveal">
                <div className="ic">◈</div>
                <h3>Your data stays yours</h3>
                <p>
                  Personalization is a feature, not surveillance — you can see and
                  reset what drives your recommendations.
                </p>
              </div>
              <div className="promise reveal">
                <div className="ic">✓</div>
                <h3>Honest by metric</h3>
                <p>
                  Our north star is Verified Money Saved. It counts only confirmed
                  savings — so it&apos;s falsifiable, not marketing.
                </p>
              </div>
            </div>
          </div>
        </section>

        <section>
          <div className="wrap">
            <div className="band reveal">
              <div className="metric">
                <div className="v">
                  <em>$0.00</em>
                </div>
                <div className="k">Taken from your wallet — ever</div>
              </div>
              <div className="metric">
                <div className="v">
                  ≤ <em>1¢</em>
                </div>
                <div className="k">AI cost per request, by design</div>
              </div>
              <div className="metric">
                <div className="v">
                  <em>100%</em>
                </div>
                <div className="k">Disclosed affiliate relationships</div>
              </div>
              <div className="metric">
                <div className="v">
                  <em>0</em>
                </div>
                <div className="k">Scraped data sources</div>
              </div>
            </div>
            <div style={{ marginTop: "34px" }}>
              <p className="eyebrow">Phased, region-before-market</p>
              <div className="rollout">
                <span className="phase live">
                  <b>P1</b> United States
                </span>
                <span className="phase">
                  <b>P2</b> CA · UK · AU
                </span>
                <span className="phase">
                  <b>P3</b> EU
                </span>
                <span className="phase">
                  <b>P4</b> BD · IN · PK · ME
                </span>
              </div>
            </div>
          </div>
        </section>

        <section id="faq">
          <div className="wrap">
            <div className="sec-head">
              <p className="eyebrow">Questions, answered plainly</p>
              <h2>The honest FAQ.</h2>
            </div>
            <div className="faq">
              <details className="reveal">
                <summary>How does NEXUS actually make money?</summary>
                <p>
                  Affiliate commissions the merchant pays when you buy through our
                  hand-off link. Crucially, commission is invisible to our ranking
                  — we&apos;re paid the same regardless of which result you pick,
                  so our incentive is simply to make you save and buy.
                </p>
              </details>
              <details className="reveal">
                <summary>Do you sell my data or track me around the web?</summary>
                <p>
                  No. Personalization is a feature you control, not surveillance.
                  You can see exactly what drives your recommendations and reset
                  it. We take no payment custody and store only what a referral
                  needs.
                </p>
              </details>
              <details className="reveal">
                <summary>Is this just another cashback or coupon app?</summary>
                <p>
                  No. Cashback (where legal) is one feature, not the point. NEXUS
                  is an AI agent that finds the best real price and proves the
                  saving — coupons and cashback are inputs to &quot;best
                  price&quot;, not the product.
                </p>
              </details>
              <details className="reveal">
                <summary>What does &quot;verified&quot; actually mean?</summary>
                <p>
                  A saving only counts once the merchant network confirms the
                  purchase and it clears the return window. Until then it&apos;s
                  shown as <b>Pending</b>, never as money you&apos;ve banked.
                  Returns reverse it, transparently.
                </p>
              </details>
              <details className="reveal">
                <summary>Where is NEXUS available?</summary>
                <p>
                  Rolling out region-before-market: United States first, then
                  Canada / UK / Australia, then the EU, then Bangladesh / India /
                  Pakistan / the Middle East — each only after its data-residency
                  and legal review passes.
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
                Be first to try the AI agent that&apos;s paid to save you money —
                and proves it, one verified receipt at a time.
              </p>
              {submitted ? (
                <p className="wl-ok">
                  <span className="chk">✓</span> You&apos;re on the list.
                  We&apos;ll email <b>{who}</b> the moment your region opens.
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
                      onChange={(e) => {
                        setEmail(e.target.value);
                        setNote(DEFAULT_NOTE);
                        setNoteErr(false);
                      }}
                    />
                    <button className="btn btn-primary" type="submit">
                      Join the waitlist →
                    </button>
                  </form>
                  <p
                    className="wl-note"
                    style={noteErr ? { color: "var(--amber)" } : undefined}
                  >
                    {note}
                  </p>
                </>
              )}
            </div>
          </div>
        </section>
      </main>

      <footer>
        <div className="wrap">
          <div className="foot-grid">
            <div>
              <div className="brand">
                <span className="mk" aria-hidden="true" /> NEXUS{" "}
                <small>Commerce&nbsp;OS</small>
              </div>
              <p className="foot-note">
                A pure referral + affiliate intelligence layer. Codename NEXUS —
                consumer brand deferred. Illustrative figures shown.
              </p>
            </div>
            <div>
              <h4>Product</h4>
              <a href="#how">How it works</a>
              <a href="#ranking">Commission-blind</a>
              <a href="#savings">Verified savings</a>
              <a href="#agent">For developers</a>
            </div>
            <div>
              <h4>Company</h4>
              <a href="#trust">Trust &amp; transparency</a>
              <a href="#faq">FAQ</a>
              <a href="#cta">Waitlist</a>
            </div>
            <div>
              <h4>Legal</h4>
              <a href="#trust">Affiliate disclosure</a>
              <a href="#savings">Savings terms</a>
              <a href="#trust">Privacy</a>
            </div>
          </div>
          <div className="foot-bottom">
            <span>© 2026 NEXUS Commerce OS</span>
            <span className="mono">
              Built buyer-first · disclosed · authorized-data-only
            </span>
          </div>
        </div>
      </footer>
    </>
  );
}
