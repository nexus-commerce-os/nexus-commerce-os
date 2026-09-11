import type { Metadata } from 'next';

import { SiteFooter } from '@/components/SiteFooter';

/*
 * /guides/ssd — evergreen explainer.
 *
 * TRUTH RULE FOR THIS FILE: category knowledge only. No prices, no model
 * names, no brand comparisons, no "best" list. Describing what an SLC cache is
 * and why sustained writes fall off a cliff is how the technology works;
 * saying which manufacturer's drive holds up best would be a product claim we
 * have no data source for.
 */

const BASE = 'https://honesttotal.com';

export const metadata: Metadata = {
  title: 'How to choose an SSD — HonestTotal',
  description:
    'SSDs explained without the headline number: why 7,000 MB/s almost never matters, what an SLC cache hides, DRAM versus HMB, TLC versus QLC, and the specs that actually change how a drive feels.',
  alternates: { canonical: '/guides/ssd' },
  openGraph: {
    type: 'article',
    url: `${BASE}/guides/ssd`,
    title: 'The fastest number on the box is the least useful one.',
    description:
      'Why sequential speed rarely matters, what happens when the write cache runs out, and the specifications that actually decide how a drive feels.',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'The fastest number on the box is the least useful one.',
    description: 'Sequential speed, SLC caches, DRAM, endurance — what matters and what does not.',
  },
};

/** Interface and form factor are different things, and the confusion is costly. */
const SHAPES = [
  {
    k: 'M.2 is a shape, not a speed',
    v: 'M.2 describes the physical stick. An M.2 drive can be SATA or NVMe, and they are not interchangeable in every slot. Buying the wrong one is the single most common SSD mistake, and it fits well enough to be confusing.',
  },
  {
    k: 'SATA: the old ceiling',
    v: 'Limited to roughly 550 MB/s by the interface itself. That sounds slow next to NVMe and still feels instant compared with a hard drive — for an older laptop or a bulk storage drive it is often the only option and rarely the bottleneck.',
  },
  {
    k: 'NVMe over PCIe: the current default',
    v: 'Speaks directly to the CPU over PCIe lanes. Generation 3, 4 and 5 roughly double the headline figure each step. Whether you can tell the difference is a separate question, answered below.',
  },
];

/** The specifications that actually change day-to-day behaviour. */
const WHAT_MATTERS = [
  {
    n: 'Random reads',
    d: 'Small scattered reads at low queue depth — opening applications, booting, loading a game level. This is what almost all consumer use looks like, and it is the number least often advertised.',
    state: 'Matters most',
    tone: 'ok',
  },
  {
    n: 'Sustained writes',
    d: 'What the drive does once its fast cache is exhausted. A drive quoting 7,000 MB/s may drop to a fraction of that partway through a large transfer. If you move big files, this is the figure that decides your afternoon.',
    state: 'Matters if you move large files',
    tone: 'warn',
  },
  {
    n: 'DRAM cache',
    d: 'A small memory chip holding the map of where data lives. DRAM-less drives borrow system memory instead (HMB), which is fine for light use and shows up as inconsistency when the drive is busy or nearly full.',
    state: 'Matters under load',
    tone: 'warn',
  },
  {
    n: 'Sequential speed',
    d: 'The headline. It describes copying one enormous file to a drive with an empty cache — a benchmark shape, not a Tuesday. It is a real measurement of a real capability you will rarely be in a position to use.',
    state: 'Matters least',
    tone: 'muted',
  },
];

/** Flash types and the cache trick that hides their differences. */
const FLASH = [
  {
    k: 'TLC and QLC',
    v: 'Three or four bits stored per cell. More bits means more capacity per wafer and lower cost, at the cost of slower native writes and lower endurance. Both are used in perfectly good drives; the difference shows up under sustained load, not in casual use.',
  },
  {
    k: 'The SLC cache',
    v: 'Drives treat a portion of their flash as fast single-bit storage and write there first, flushing later. This is why almost every drive looks fast in a short test — and why a long transfer can slow abruptly when the cache fills.',
  },
  {
    k: 'Why a full drive slows down',
    v: 'The cache is carved out of free space, so a nearly-full drive has less of it. Leaving ten to twenty per cent free is not superstition; it is what keeps the fast path available.',
  },
];

const JUDGING = [
  'Check what your machine actually accepts: M.2 length, whether the slot is NVMe or SATA, and whether a double-sided drive will fit',
  'Match the PCIe generation to the slot — a Gen 5 drive in a Gen 3 slot runs at Gen 3 speed and costs Gen 5 money',
  'Look for a sustained-write figure or a cache-exhaustion test, not just the peak number',
  'Check whether it has DRAM if it will be a busy system drive rather than a games library',
  'Read the endurance rating (TBW) against how you will use it — most people never approach it, and heavy video work can',
  'For Gen 5 especially, check cooling: thermal throttling turns the fastest drive into a slower one',
];

const FAQ = [
  {
    q: 'Will a faster SSD make my computer feel faster?',
    a: 'Going from a hard drive to any SSD is transformative. Going from a good SATA SSD to NVMe is noticeable in file transfers and largely invisible elsewhere. Going from Gen 4 to Gen 5 is, for most people doing most things, a number that changes in a benchmark and nowhere else.',
  },
  {
    q: 'Is QLC bad?',
    a: 'No, it is a trade. Lower cost per gigabyte, slower once the cache runs out, lower endurance. For a games library or media storage that is written rarely and read often, it makes good sense. For a drive you will hammer with large writes daily, it is the wrong tool.',
  },
  {
    q: 'Do I need DRAM?',
    a: 'For a system drive that will be busy, it helps keep performance consistent — especially when the drive is fuller. For secondary storage, DRAM-less is usually fine. It is one of the few specifications where "it depends on the job" is genuinely the honest answer.',
  },
  {
    q: 'How much free space should I leave?',
    a: 'Ten to twenty per cent is a reasonable habit. It preserves the fast write cache and gives the controller room to manage wear. A drive at ninety-nine per cent full is slow for reasons that have nothing to do with which drive you bought.',
  },
  {
    q: 'Do SSDs wear out?',
    a: 'Yes, but the endurance ratings are far beyond typical use — most consumer drives will be replaced for being small or slow long before they are worn out. Heavy sustained writing changes that calculation, which is why the rating is worth reading rather than ignoring.',
  },
  {
    q: 'Which SSD should I buy?',
    a: 'We are not answering that, deliberately. Ranking requires data we can verify, and we have no connected data source. This guide gives you the questions; comparisons will follow the published method when real offer data exists.',
  },
];

const BREADCRUMB_LD = {
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: [
    { '@type': 'ListItem', position: 1, name: 'Home', item: `${BASE}/` },
    { '@type': 'ListItem', position: 2, name: 'How to choose an SSD', item: `${BASE}/guides/ssd` },
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

export default function SsdGuidePage() {
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
            <a href="/guides/oled-tv">OLED</a>
            <a className="active" href="/guides/ssd">
              SSDs
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
                <span aria-current="page">How to choose an SSD</span>
              </li>
            </ol>
          </nav>
        </div>

        <section className="hero" style={{ borderTop: 0 }}>
          <div className="wrap">
            <span className="pill-eyebrow">
              <span aria-hidden="true">✦</span>
              <p className="eyebrow">Buying guide · solid-state drives</p>
            </span>
            <h1 className="hero-h1" style={{ maxWidth: '22ch' }}>
              <span className="h1-underlined">The big number</span>{' '}
              <em>is the least useful one.</em>
            </h1>
            <p className="lede" style={{ marginTop: 24 }}>
              Every SSD is sold on one figure, and it describes a task almost nobody performs. Here
              is what the other specifications mean, which ones change how a drive feels, and how to
              avoid buying speed your computer cannot use.
            </p>
            <p className="prelaunch" style={{ maxWidth: '58ch' }}>
              <b>No models named, no prices quoted.</b> This is category knowledge — true of how
              flash storage works, checkable anywhere, owned by no manufacturer.
            </p>
          </div>
        </section>

        <section id="shapes">
          <div className="wrap">
            <div className="sec-head">
              <p className="eyebrow">01 · Shape and interface</p>
              <h2>They are not the same thing.</h2>
              <p>
                The most expensive mistake in this category is not buying the wrong speed — it is
                buying a drive that physically fits and electrically does not.
              </p>
            </div>
            <div className="comp-list">
              {SHAPES.map((s) => (
                <div className="comp card" key={s.k}>
                  <h3>{s.k}</h3>
                  <p>{s.v}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="matters">
          <div className="wrap">
            <div className="sec-head">
              <p className="eyebrow">02 · What actually matters</p>
              <h2>Roughly the reverse of the advertising.</h2>
            </div>
            <div className="fresh-table" role="table" aria-label="Which SSD specifications matter">
              <div className="fresh-head" role="row">
                <span role="columnheader">Specification</span>
                <span role="columnheader">What it means</span>
                <span role="columnheader">Weight</span>
              </div>
              {WHAT_MATTERS.map((w) => (
                <div className="fresh-row" role="row" key={w.n}>
                  <span role="cell">
                    <b className={`fstate f-${w.tone}`}>{w.n}</b>
                  </span>
                  <span role="cell">{w.d}</span>
                  <span role="cell" className={`frank fr-${w.tone}`}>
                    {w.state}
                  </span>
                </div>
              ))}
            </div>
            <p className="note">
              The ordering is the point. Sequential speed sits at the bottom and at the top of every
              product page, because it is the number that improves most dramatically between
              generations and matters least to how the machine feels.
            </p>
          </div>
        </section>

        <section id="flash">
          <div className="wrap">
            <div className="sec-head">
              <p className="eyebrow">03 · Flash, and the cache trick</p>
              <h2>Why every drive looks fast in a short test.</h2>
            </div>
            <div className="comp-list">
              {FLASH.map((f) => (
                <div className="comp card" key={f.k}>
                  <h3>{f.k}</h3>
                  <p>{f.v}</p>
                </div>
              ))}
            </div>
            <p className="note">
              None of this is deceptive by itself — caching is a sensible engineering decision that
              makes drives genuinely faster for ordinary work. It becomes misleading only when the
              benchmark is short enough that the cache never runs out, which most of them are.
            </p>
            <p className="note">
              If you already own a drive and the question is how to look after it — free space,
              TRIM, whether to defragment, what endurance ratings mean — that is covered separately
              in <a href="/guides/ssd-best-practices">SSD best practices</a>.
            </p>
          </div>
        </section>

        <section id="judging">
          <div className="wrap">
            <div className="sec-head">
              <p className="eyebrow">04 · Before you buy</p>
              <h2>Six checks, starting with the boring one.</h2>
            </div>
            <div className="card blind" style={{ maxWidth: 760 }}>
              <h3>In this order</h3>
              <ul className="tick-list">
                {JUDGING.map((j) => (
                  <li key={j}>{j}</li>
                ))}
              </ul>
            </div>
            <p className="note">
              The first item is unglamorous and prevents the most expensive mistake. A drive that
              does not fit, or fits into a slot that cannot drive it, is a returned parcel rather
              than an upgrade.
            </p>
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
              <h2>Questions now, comparisons when the data is real.</h2>
              <p>
                When live offers exist they will be ranked by the published method — totals,
                commission-blind, nothing unverified.
              </p>
              <div className="hero-cta" style={{ justifyContent: 'center', marginTop: 28 }}>
                <a className="btn btn-primary" href="/#cta">
                  Join the waitlist →
                </a>
                <a className="btn btn-ghost" href="/how-we-rank">
                  Read how we rank
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
