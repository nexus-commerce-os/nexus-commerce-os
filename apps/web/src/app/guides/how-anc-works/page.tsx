import type { Metadata } from 'next';

/*
 * /guides/how-anc-works — evergreen explainer.
 *
 * TRUTH RULE FOR THIS FILE: physics and category knowledge only. No prices,
 * no merchants, no model names, no per-product claims. Everything stated is
 * checkable against how active noise cancellation works in general, not
 * against any particular pair.
 */

export const metadata: Metadata = {
  title: 'How noise cancelling actually works — Honest Total',
  description:
    'Active noise cancellation explained without marketing: what feedforward, feedback and hybrid ANC do, why voices get through, what "-40 dB" hides, and how to judge ANC before you buy.',
  alternates: { canonical: '/guides/how-anc-works' },
};

const TYPES = [
  {
    k: 'Feedforward',
    v: 'A microphone on the outside hears noise before you do; the headphone plays an inverted copy. Fast, but it guesses how the noise will sound once it reaches your ear — a bad seal breaks the guess.',
  },
  {
    k: 'Feedback',
    v: 'A microphone inside the earcup hears what actually reached your ear and corrects it. Accurate at low frequencies, but it reacts after the fact and can chase itself into audible artefacts if poorly tuned.',
  },
  {
    k: 'Hybrid',
    v: 'Both microphones, one system. This is what most current ANC headphones use — the outside mic for speed, the inside mic for accuracy. Done well it is the best of both; done cheaply it is two sets of compromises.',
  },
];

const LIMITS = [
  {
    k: 'Low rumble: where ANC shines',
    v: 'Engine drone, aircraft hum, air conditioning — steady, low-frequency sound is predictable, and prediction is exactly what ANC is good at.',
  },
  {
    k: 'Voices: where physics pushes back',
    v: 'Speech lives in the mid-range and changes constantly. By the time the system has measured it, the sound has changed. No consumer headphone cancels conversation; good ones only soften it.',
  },
  {
    k: 'Sudden sounds: barely touched',
    v: 'A door slam is over before any feedback loop can respond. What protects you there is passive isolation — the physical seal — not electronics.',
  },
  {
    k: 'Wind: the self-inflicted noise',
    v: 'Wind hitting the outside microphones becomes noise the system injects while trying to cancel it. Better headphones detect wind and mute those mics; this is worth checking in reviews.',
  },
];

const JUDGING = [
  'The seal comes first: ANC performance collapses without a good fit, so pad shape and clamp matter more than the electronics',
  'Ask what frequency a "-XX dB" claim was measured at — a single number without a range describes the best case, not the experience',
  'Listen for the noise floor: aggressive ANC can add a faint hiss or ear pressure; some people notice it, some never do',
  'Check transparency mode quality — you will use it more than you expect, and bad transparency sounds like a tin can',
  'ANC costs battery: compare quoted hours with ANC on, not the headline figure',
];

const FAQ = [
  {
    q: 'Does ANC damage hearing?',
    a: 'No — if anything the opposite, indirectly. By lowering background noise it lets you listen at lower volume, and volume is what harms hearing. The pressure sensation some people feel is real but harmless: it is your brain reacting to low-frequency sound being removed, not to pressure.',
  },
  {
    q: 'Why do some people feel "eardrum suck"?',
    a: 'The brain expects low-frequency sound in an environment and notices its absence, which some people perceive as pressure. It varies person to person, tends to fade with use, and is a reason a generous return window matters more than any spec.',
  },
  {
    q: 'Is stronger ANC always better?',
    a: 'Not necessarily. Very aggressive cancellation can trade in artefacts — hiss, pressure, odd handling of your own footsteps. The best implementations are the ones you stop noticing, which is a quality no single number captures.',
  },
  {
    q: 'Which headphone has the best ANC?',
    a: 'We are not answering that yet, deliberately. Ranking requires data we can verify, and we have no connected data source. This guide gives you the questions; the comparisons will follow the method on our How we rank page when real data exists.',
  },
];

export default function AncGuidePage() {
  return (
    <>
      <header className="nav">
        <div className="wrap nav-in">
          <a className="brand" href="/" aria-label="Honest Total home">
            <span className="mk" aria-hidden="true" />
            NEXUS <small>Commerce OS</small>
          </a>
          <nav className="nav-links">
            <a href="/">Home</a>
            <a href="/guides/over-ear-headphones">Buying guide</a>
            <a className="active" href="/guides/how-anc-works">
              ANC explained
            </a>
          </nav>
          <a className="btn btn-primary" href="/#cta">
            Join the waitlist
          </a>
        </div>
      </header>

      <main>
        <section className="hero" style={{ borderTop: 0 }}>
          <div className="wrap">
            <span className="pill-eyebrow">
              <span aria-hidden="true">✦</span>
              <p className="eyebrow">Explainer · noise cancelling</p>
            </span>
            <h1 className="hero-h1" style={{ maxWidth: '22ch' }}>
              <span className="h1-underlined">ANC,</span> <em>without the</em> marketing.
            </h1>
            <p className="lede" style={{ marginTop: 24 }}>
              Active noise cancellation is one of the most impressive tricks in consumer audio, and
              one of the most over-promised. Here is how it actually works, what it genuinely cannot
              do, and how to judge it before you pay for it.
            </p>
            <p className="prelaunch" style={{ maxWidth: '58ch' }}>
              <b>No models named, no prices quoted.</b> This is category knowledge — true of ANC as
              a technology, checkable anywhere, owned by no brand.
            </p>
          </div>
        </section>

        <section id="principle">
          <div className="wrap">
            <div className="sec-head">
              <p className="eyebrow">01 · The principle</p>
              <h2>Noise, cancelled by its opposite.</h2>
            </div>
            <div className="card rule-card">
              <p className="rule-quote">
                A microphone measures incoming sound; the headphone plays the same wave{' '}
                <b>inverted</b>. Where peak meets trough, the air stops moving — and what your
                eardrum never receives, you never hear.
              </p>
              <p className="muted">
                Everything good and bad about ANC follows from that sentence. It works when the
                noise is predictable enough to invert in time, and it fails exactly where prediction
                fails — which is why the sections below exist.
              </p>
            </div>
          </div>
        </section>

        <section id="types">
          <div className="wrap">
            <div className="sec-head">
              <p className="eyebrow">02 · Three architectures</p>
              <h2>Where the microphones sit decides what you get.</h2>
            </div>
            <div className="comp-list">
              {TYPES.map((t) => (
                <div className="comp card" key={t.k}>
                  <h3>{t.k}</h3>
                  <p>{t.v}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="limits">
          <div className="wrap">
            <div className="sec-head">
              <p className="eyebrow">03 · Honest limits</p>
              <h2>What ANC can and cannot cancel.</h2>
              <p>
                The gap between marketing and experience lives here. None of this is a defect of any
                particular product — it is the physics every product negotiates with.
              </p>
            </div>
            <div className="comp-list">
              {LIMITS.map((l) => (
                <div className="comp card" key={l.k}>
                  <h3>{l.k}</h3>
                  <p>{l.v}</p>
                </div>
              ))}
            </div>
            <p className="note">
              Passive isolation — the physical seal of the pads — is the quiet partner in every good
              ANC experience. It handles what electronics cannot, which is why comfort and fit sit
              above ANC in <a href="/guides/over-ear-headphones">our buying guide</a>.
            </p>
          </div>
        </section>

        <section id="judging">
          <div className="wrap">
            <div className="sec-head">
              <p className="eyebrow">04 · Before you buy</p>
              <h2>How to judge ANC from the outside.</h2>
            </div>
            <div className="card blind" style={{ maxWidth: 720 }}>
              <h3>Five checks that beat the spec sheet</h3>
              <ul className="tick-list">
                {JUDGING.map((j) => (
                  <li key={j}>{j}</li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        <section id="faq">
          <div className="wrap">
            <div className="sec-head">
              <p className="eyebrow">05 · Questions</p>
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
              <h2>Judgement now, comparisons when the data is real.</h2>
              <p>
                When live offers exist they will be ranked by the published method — totals,
                commission-blind, nothing unverified.
              </p>
              <div className="hero-cta" style={{ justifyContent: 'center', marginTop: 28 }}>
                <a className="btn btn-primary" href="/#cta">
                  Join the waitlist →
                </a>
                <a className="btn btn-ghost" href="/guides/over-ear-headphones">
                  Read the buying guide
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
            <span className="mono">No prices quoted · no models endorsed · pre-launch</span>
          </div>
        </div>
      </footer>
    </>
  );
}
