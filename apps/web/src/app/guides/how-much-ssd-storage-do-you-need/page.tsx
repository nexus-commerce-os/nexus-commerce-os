import type { Metadata } from 'next';

import { SiteFooter } from '@/components/SiteFooter';

/*
 * /guides/how-much-ssd-storage-do-you-need — the capacity decision.
 *
 * WHY THIS IS A THIRD SSD PAGE. /guides/ssd answers "which drive" — shape and
 * interface, what actually separates drives, the SLC cache, six purchase
 * checks. /guides/ssd-best-practices answers "how do I look after the one I
 * own" — free space, defragmentation, TRIM, endurance, backups. Neither
 * answers "what size should I buy". Capacity appears in neither guide's
 * sections, checklists or FAQs; the only adjacent item is the "how much free
 * space should I leave" question, which both pages carry and which is a
 * maintenance rule, not a purchase decision.
 *
 * THE LINE THIS PAGE MUST NOT CROSS. Headroom is used here only as an INPUT to
 * sizing. The free-space rule itself is not re-explained — it belongs to
 * /guides/ssd-best-practices and is linked, not repeated. If a section here
 * starts explaining why free space matters to performance, it has drifted.
 *
 * GSC EVIDENCE, STATED HONESTLY. /guides/ssd carries 41 measured impressions,
 * the second-highest page on the site. Visible SSD queries in the measured
 * period amount to roughly two impressions ("how to choose ssd", "ssd best
 * practices"). There is NO visible query for "how much SSD storage do I need"
 * or any equivalent, and none is claimed. The rationale is page-level category
 * interest plus a verified content gap plus a distinct purchase-decision
 * intent — not demonstrated keyword demand.
 *
 * TRUTH RULE FOR THIS FILE: no prices, no models, no merchants, no rankings,
 * and — the hard one for this topic — NO INVENTED POPULATION STATISTICS. There
 * is no "the average user needs X". Every number below is either quoted from a
 * primary source or is transparent arithmetic labelled as an example. Sources,
 * with what each one actually supports:
 *
 *   - Windows 11 minimum storage: "Storage: 64 GB or greater available disk
 *     space", with Microsoft's own note that "There might be more storage
 *     requirements over time for updates, and to enable specific features
 *     within the OS." Microsoft Learn, Windows 11 requirements, page updated
 *     2026-07-21, read 2026-09-14. SUPPORTS: the stated minimum, and the
 *     minimum-vs-practical distinction. DOES NOT SUPPORT: any claim about what
 *     Windows users actually end up using.
 *   - macOS: Apple's own "How to upgrade to macOS Tahoe 26" support page
 *     publishes NO free-space figure at all (read 2026-09-14). SUPPORTS: the
 *     statement that a published figure is not always available. Forum threads
 *     quoting 20 GB / 17 GB / 37 GB were found and deliberately NOT used — they
 *     are user posts, not Apple documentation.
 *   - Call of Duty: Black Ops 6: "SSD with 102 GB† available space at launch"
 *     for BOTH minimum and recommended, plus "Additional storage space may be
 *     required for mandatory game updates" and a footnote that the figure
 *     excludes Warzone. Activision Support, read 2026-09-14. SUPPORTS: one
 *     title's stated figure, the "at launch" qualifier, and the publisher's own
 *     statement that it grows. DOES NOT SUPPORT: "modern games are 102 GB".
 *   - Cyberpunk 2077: "Storage: 70 GB SSD" across every configuration tier.
 *     CD PROJEKT RED support, read 2026-09-14. SUPPORTS: a contrasting figure
 *     showing the spread between titles.
 *   - Marketed vs displayed capacity: drive manufacturers state capacity in
 *     decimal bytes (1 GB = 1,000,000,000 bytes) and carry a note to that
 *     effect; operating systems commonly report in binary units
 *     (1 GiB = 1,073,741,824 bytes), so a 500 GB drive is reported as roughly
 *     465. Crucial, Seagate and SanDisk support documentation, read
 *     2026-09-14. The 500 → 465 figure is also checkable arithmetic:
 *     500,000,000,000 / 1,073,741,824 = 465.7.
 *   - Cloud placeholders: "Online-only files don't take up space on your
 *     computer"; opening one downloads it and it "becomes a locally available
 *     file"; files set to always keep on the device "download to your device
 *     and take up space." Microsoft OneDrive Files On-Demand documentation,
 *     read 2026-09-14. SUPPORTS: OneDrive on Windows specifically. It is
 *     scoped that way in §09 and NOT generalised to every cloud service.
 *
 * The 10–20% headroom figure used in the worksheet is this site's own existing
 * editorial position from /guides/ssd-best-practices, attributed as such rather
 * than presented as new evidence.
 *
 * SOURCING CONVENTION: as with the other guides, sources are recorded here for
 * reviewers; the page carries no visible citations section and no external
 * link, because no guide on this site has one.
 */

const BASE = 'https://honesttotal.com';

export const metadata: Metadata = {
  title: 'How much SSD storage do you actually need? — HonestTotal',
  description:
    'There is no single right capacity, so this is a method rather than a number: measure what you already use, add what you know is coming, leave room to grow, then round up to a size that is actually sold.',
  alternates: { canonical: '/guides/how-much-ssd-storage-do-you-need' },
  openGraph: {
    type: 'article',
    url: `${BASE}/guides/how-much-ssd-storage-do-you-need`,
    title: 'How much SSD storage do you actually need?',
    description:
      'A sizing method instead of a recommendation: what you use now, what is coming, how much room to leave, and where each capacity stops making sense.',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'How much SSD storage do you actually need?',
    description: 'A method, not a number — because nobody can size your drive without your numbers.',
  },
};

/** The four inputs. Deliberately a method, not a prescription. */
const INPUTS = [
  {
    k: 'What you already use',
    v: 'Not the size of the drive you have — the space your files and applications currently occupy. This is the one figure nobody can guess for you, and it is the only one you can measure exactly. Every operating system will tell you in a couple of clicks.',
  },
  {
    k: 'What you know is coming',
    v: 'Specific, named things: a game you intend to install, a project you have agreed to, software a course requires. Not vague future need — items you could write down today. If you cannot name it, it belongs in growth rather than here.',
  },
  {
    k: 'Growth you cannot itemise',
    v: 'Photos, downloads, documents and updates accumulate whether or not you plan for them. The honest way to estimate this is to look backwards: if you can see what you used a year ago, the difference is your own growth rate, measured rather than assumed.',
  },
  {
    k: 'Working headroom',
    v: 'Space you deliberately never fill. Our maintenance guide makes the case for keeping roughly ten to twenty per cent free; for sizing purposes the point is simply that a drive is not usable to its last byte, so headroom has to be bought, not borrowed.',
  },
];

/** Capacity tiers as decision points, never as prescriptions. */
const TIERS = [
  {
    n: '256 GB',
    d: 'Can work if the machine is a companion rather than a main computer — a browser, documents, a handful of applications, media streamed rather than stored. Becomes restrictive as soon as one large game, one video project or one local photo library arrives.',
    state: 'Tight by design',
    tone: 'danger',
  },
  {
    n: '512 GB',
    d: 'Can work if your operating system, applications and local files stay modest and you do not keep several very large installs at once. Becomes restrictive when two or three big titles, or a growing local media library, are resident at the same time.',
    state: 'Depends on what stays local',
    tone: 'warn',
  },
  {
    n: '1 TB',
    d: 'Makes sense when you want a few large installs, a local photo library and several years of documents to coexist without management. Becomes restrictive when video work, virtual machines or a large permanently-installed game library enter the picture.',
    state: 'Room to stop thinking about it',
    tone: 'ok',
  },
  {
    n: '2 TB',
    d: 'Makes sense when large installs are routine rather than occasional, when you edit video locally, or when the machine cannot take a second drive later. Also the point at which buying ahead starts costing real money for space you may not use.',
    state: 'For workloads, not comfort',
    tone: 'ok',
  },
  {
    n: '4 TB and above',
    d: 'Makes sense for sustained local media work, large datasets, or archives that genuinely have to live on the fast drive. For most other purposes the same money is usually better split between a smaller fast drive and cheaper bulk storage elsewhere.',
    state: 'Answer a specific need',
    tone: 'muted',
  },
];

/** Mistakes that cost money or space, phrased as behaviours rather than scolding. */
const MISTAKES = [
  'Sizing for today — the drive has to hold what you will have, not what you have now',
  'Buying exactly your current usage, which leaves a drive that is full on the day it arrives',
  'Assuming cloud sync means zero local storage, when anything you open or pin is stored locally',
  'Forgetting that a single large game or project can exceed the whole free space of a small drive',
  'Not checking whether the machine can take a bigger or second drive later',
  'Treating the advertised number as the usable number — a 500 GB drive is reported as roughly 465',
  'Assuming a larger drive is automatically faster, which is a per-model question, not a capacity rule',
  'Treating spare capacity as a backup, which it is not in any sense that survives a failed drive',
];

const FAQ = [
  {
    q: 'Is 512 GB enough for an SSD?',
    a: 'It can be, and the answer depends entirely on your own numbers rather than on anything general. 512 GB works when your operating system, applications and local files stay modest and you are not keeping several very large installs resident at once. It stops working quickly if two or three large games, a local photo library or video projects need to coexist. Measure what you use now, add what you know is coming, and the answer will be arithmetic rather than opinion.',
  },
  {
    q: 'Is 1 TB enough for most people?',
    a: 'We are not going to put a number on "most people", because that would be a population claim we have no data for. What can be said is that 1 TB is the point where a few large installs, a local photo library and several years of documents usually coexist without active management — and that video work, virtual machines or a large permanently-installed game library are the things that push past it.',
  },
  {
    q: 'How much SSD storage do I need for gaming?',
    a: 'It depends on how many large titles you keep installed at once, and the spread between titles is wide. To give two publisher-stated figures: CD PROJEKT RED lists 70 GB for Cyberpunk 2077, while Activision lists 102 GB for Call of Duty: Black Ops 6 at launch, noting separately that updates may require more and that the figure excludes Warzone. Two or three installs of that size will fill a 512 GB drive on their own.',
  },
  {
    q: 'Should I buy 1 TB or 2 TB?',
    a: 'Work out the total first, then let the tiers answer. If your measured usage plus known additions plus headroom lands under a terabyte, 2 TB is money spent on space you may not reach. If it lands above, 2 TB is the next size actually sold. The one factor that shifts this is upgradeability: if the machine cannot take a bigger or second drive later, buying ahead is worth more than it would be in a desktop with spare slots.',
  },
  {
    q: 'Does a larger SSD make a computer faster?',
    a: 'Not as a rule you can rely on. Some product lines do perform differently at different capacities because of how the drive is configured internally, but that is a per-model question to check on the specific drive rather than a general property of size. Capacity and performance are separate purchase variables, and our SSD buying guide covers which performance figures are worth reading.',
  },
  {
    q: 'How much free space should I leave on an SSD?',
    a: 'That is a maintenance question rather than a sizing one, and it has its own answer on our SSD best-practices page — briefly, around ten to twenty per cent. For this page it matters only as an input: headroom is space you buy and never fill, so it belongs in the total before you choose a capacity.',
  },
  {
    q: 'Can I use cloud storage instead of buying a larger SSD?',
    a: 'Partly, and less than people expect. Microsoft documents that with OneDrive Files On-Demand on Windows, online-only files do not take up space on the computer — but opening one downloads it and it becomes a locally available file, and anything you set to always keep on the device is stored locally. So cloud storage moves what is not in use; it does not remove the need for local space for what is.',
  },
  {
    q: 'Is 256 GB too small?',
    a: 'Too small for what is the question that decides it. As a companion machine running a browser, documents and a few applications with media streamed rather than stored, 256 GB is a deliberate choice rather than a mistake. As a main computer that will hold large installs, a photo library or any local video work, it will be full quickly enough to become a daily irritation.',
  },
];

const BREADCRUMB_LD = {
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: [
    { '@type': 'ListItem', position: 1, name: 'Home', item: `${BASE}/` },
    {
      '@type': 'ListItem',
      position: 2,
      name: 'How much SSD storage do you actually need?',
      item: `${BASE}/guides/how-much-ssd-storage-do-you-need`,
    },
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

export default function SsdCapacityGuidePage() {
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
            <a href="/guides/ssd">Buying guide</a>
            <a className="active" href="/guides/how-much-ssd-storage-do-you-need">
              How much storage?
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
                <span aria-current="page">How much SSD storage do you actually need?</span>
              </li>
            </ol>
          </nav>
        </div>

        {/* 1 — hero: the honest answer immediately */}
        <section className="hero" style={{ borderTop: 0 }}>
          <div className="wrap">
            <span className="pill-eyebrow">
              <span aria-hidden="true">✦</span>
              <p className="eyebrow">Buying decision · storage</p>
            </span>
            <h1 className="hero-h1" style={{ maxWidth: '24ch' }}>
              <span className="h1-underlined">How much SSD storage</span> do you{' '}
              <em>actually</em> need?
            </h1>
            <p className="lede" style={{ marginTop: 24 }}>
              Nobody can answer that without your numbers, so this page gives you a method instead
              of a recommendation: measure what you use now, add what you know is coming, leave room
              to grow, then round up to a size that is actually sold.
            </p>
            <p className="lede">
              It takes about five minutes and it is more reliable than any figure anyone could
              publish about &ldquo;most people&rdquo; — because the only usage that decides your
              drive is yours.
            </p>
            <p className="prelaunch" style={{ maxWidth: '58ch' }}>
              <b>This page is about size, not about which drive.</b> Interfaces, caches and the
              specifications worth reading are in the{' '}
              <a href="/guides/ssd">SSD buying guide</a>.
            </p>
          </div>
        </section>

        {/* 2 — the short answer */}
        <section id="short-answer">
          <div className="wrap">
            <div className="sec-head">
              <p className="eyebrow">01 · The short answer</p>
              <h2>Four numbers, added together, rounded up.</h2>
            </div>
            <div className="card rule-card">
              <p className="rule-quote">
                Required capacity = <b>what you use now</b> + <b>what you know is coming</b> +{' '}
                <b>growth</b> + <b>headroom you never fill</b> — then round up to the next capacity
                that is actually on sale.
              </p>
              <p className="muted">
                That is the whole method. It is our framework rather than an industry standard, and
                its value is not sophistication — it is that each term is something you can find
                out, instead of something you have to believe.
              </p>
            </div>
            <p className="note">
              Note what the formula does not contain: any claim about what other people need. There
              is no average user in this calculation, because there is no average drive.
            </p>
          </div>
        </section>

        {/* 3 — the four inputs */}
        <section id="inputs">
          <div className="wrap">
            <div className="sec-head">
              <p className="eyebrow">02 · The four inputs</p>
              <h2>Where each number comes from.</h2>
              <p>
                Three of these you can measure or name. Only one is an estimate, and even that can
                be measured backwards.
              </p>
            </div>
            <div className="comp-list">
              {INPUTS.map((i) => (
                <div className="comp card" key={i.k}>
                  <h3>{i.k}</h3>
                  <p>{i.v}</p>
                </div>
              ))}
            </div>
            <p className="note">
              The headroom figure belongs to maintenance rather than shopping — why it matters and
              what happens without it is covered in{' '}
              <a href="/guides/ssd-best-practices">SSD best practices</a>. Here it is simply a term
              in the sum.
            </p>
          </div>
        </section>

        {/* 4 — the worksheet */}
        <section id="worksheet">
          <div className="wrap">
            <div className="sec-head">
              <p className="eyebrow">03 · The worksheet</p>
              <h2>Six steps, one afternoon number.</h2>
            </div>
            <div className="flow">
              <div className="flow-step card">
                <span className="flow-n">1</span>
                <p>
                  <b>Measure what you use.</b> Your operating system reports used space directly.
                  Write down the figure — not the drive size, the used figure.
                </p>
              </div>
              <div className="flow-step card">
                <span className="flow-n">2</span>
                <p>
                  <b>Separate what must stay local</b> from what could live elsewhere. Archives you
                  never open are a different problem from files you work on daily.
                </p>
              </div>
              <div className="flow-step card">
                <span className="flow-n">3</span>
                <p>
                  <b>List the large things you can name.</b> Specific games, projects or software
                  you intend to install, with their published sizes where they have one.
                </p>
              </div>
              <div className="flow-step card">
                <span className="flow-n">4</span>
                <p>
                  <b>Estimate growth from your own history</b> rather than from a rule. A year of
                  your own accumulation is the best predictor of the next one.
                </p>
              </div>
              <div className="flow-step card">
                <span className="flow-n">5</span>
                <p>
                  <b>Add headroom you will never fill.</b> Ten to twenty per cent of the finished
                  total, following the figure on our maintenance page.
                </p>
              </div>
              <div className="flow-step card">
                <span className="flow-n">6</span>
                <p>
                  <b>Round up to a capacity that exists.</b> Drives are sold in tiers; if the total
                  lands between two, the smaller one is a decision to manage space forever.
                </p>
              </div>
            </div>

            <div className="card blind" style={{ maxWidth: 760, marginTop: 28 }}>
              <h3>A worked example — illustration only, not a recommendation</h3>
              <ul className="tick-list">
                <li>Currently used: 310 GB</li>
                <li>Large installs planned and named: 180 GB</li>
                <li>Growth, from last year&rsquo;s own accumulation: 150 GB</li>
                <li>Subtotal: 640 GB</li>
                <li>Headroom at fifteen per cent of the subtotal: about 96 GB</li>
                <li>Total need: roughly 736 GB</li>
                <li>
                  Decision: 512 GB is already too small; <b>1 TB is the next tier that exists</b>
                </li>
              </ul>
            </div>
            <p className="note">
              Those are <b>somebody&rsquo;s</b> numbers, invented to show the arithmetic. They are
              not a claim about you or about anyone. Replace all four with your own and the method
              produces a different, better answer.
            </p>
            <p className="note">
              One adjustment when you round up: drive makers state capacity in decimal bytes — one
              gigabyte meaning one billion bytes — while operating systems commonly report in binary
              units, so a drive sold as 500 GB is reported as roughly 465. Manufacturers carry a
              note to this effect on their own specifications. Size against the reported figure, not
              the label.
            </p>
          </div>
        </section>

        {/* 5 — tiers */}
        <section id="tiers">
          <div className="wrap">
            <div className="sec-head">
              <p className="eyebrow">04 · What each capacity can mean</p>
              <h2>Decision points, not prescriptions.</h2>
              <p>
                Every line below is conditional on purpose. A capacity is not right or wrong for a
                kind of person — it is adequate or restrictive for a set of files.
              </p>
            </div>
            <div className="fresh-table" role="table" aria-label="What each SSD capacity can mean">
              <div className="fresh-head" role="row">
                <span role="columnheader">Capacity</span>
                <span role="columnheader">When it can work, and when it stops</span>
                <span role="columnheader">Character</span>
              </div>
              {TIERS.map((t) => (
                <div className="fresh-row" role="row" key={t.n}>
                  <span role="cell">
                    <b className={`fstate f-${t.tone}`}>{t.n}</b>
                  </span>
                  <span role="cell">{t.d}</span>
                  <span role="cell" className={`frank fr-${t.tone}`}>
                    {t.state}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* 6 — games */}
        <section id="games">
          <div className="wrap">
            <div className="sec-head">
              <p className="eyebrow">05 · Games are the largest single variable</p>
              <h2>The spread between titles is enormous.</h2>
            </div>
            <div className="card rule-card">
              <p className="rule-quote">
                Two publisher-stated figures, to show the range rather than the norm: CD PROJEKT RED
                lists <b>70 GB</b> for Cyberpunk 2077. Activision lists{' '}
                <b>102 GB at launch</b> for Call of Duty: Black Ops 6 — for both the minimum and the
                recommended configuration.
              </p>
              <p className="muted">
                Two things in that Activision listing are worth more than the number itself. The
                phrase <b>at launch</b> is doing real work, and the same page states that additional
                storage may be required for mandatory updates, and that the figure excludes Warzone.
                Install sizes are a starting position, not a fixed cost — which is why sizing a
                drive to exactly fit today&rsquo;s library is a decision that expires.
              </p>
            </div>
            <p className="note">
              Neither figure represents &ldquo;modern games&rdquo;, and this page does not claim
              one. They are two titles, checked on their publishers&rsquo; own pages, quoted to show
              that a single install can consume a fifth of a 512 GB drive — or a third of it.
            </p>
          </div>
        </section>

        {/* 7 — creative work */}
        <section id="creative">
          <div className="wrap">
            <div className="sec-head">
              <p className="eyebrow">06 · Photos, video and creative work</p>
              <h2>The category where capacity stops being optional.</h2>
            </div>
            <div className="comp-list">
              <div className="comp card">
                <h3>Raw beats compressed, by a lot</h3>
                <p>
                  A camera&rsquo;s raw file is substantially larger than the compressed image the
                  same shot produces, and the multiple depends on the camera. The practical point is
                  that a library shot in raw grows at a different rate from one shot in JPEG, and
                  only your own camera can tell you which numbers apply.
                </p>
              </div>
              <div className="comp card">
                <h3>Video is measured in rate, not in files</h3>
                <p>
                  Footage consumes space per minute of recording, so the question is not how many
                  files you have but how many hours. Higher resolutions and higher bit rates
                  multiply that rate. Check what your own camera or phone actually writes rather
                  than relying on a general figure.
                </p>
              </div>
              <div className="comp card">
                <h3>The invisible half: caches and proxies</h3>
                <p>
                  Editing software generates previews, proxies and cache files that can rival the
                  source material in size and are easy to forget when sizing a drive. They are
                  temporary in principle and permanent in practice until someone clears them.
                </p>
              </div>
              <div className="comp card">
                <h3>Archives quietly become the majority</h3>
                <p>
                  Finished work rarely gets deleted. Over a few years the archive, not the active
                  project, is usually what fills a creative machine — and it is also the part that
                  has the least need to sit on the fast internal drive.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* 8 — cloud */}
        <section id="cloud">
          <div className="wrap">
            <div className="sec-head">
              <p className="eyebrow">07 · Cloud storage does not erase local needs</p>
              <h2>It moves what you are not using.</h2>
            </div>
            <div className="card rule-card">
              <p className="rule-quote">
                Microsoft&rsquo;s documentation for OneDrive Files On-Demand on Windows states that{' '}
                <b>online-only files do not take up space on your computer</b> — but that opening
                one downloads it and it becomes a locally available file, and that files you set to
                always keep on the device are stored locally.
              </p>
              <p className="muted">
                That is the shape of the trade in general, though the detail above is specific to
                one service on one operating system and this page does not extend it to others. The
                questions worth asking of whichever service you use are the same: are files kept
                locally or as placeholders, what happens offline, how much cache does it keep, and
                what does it do when the drive fills up.
              </p>
            </div>
          </div>
        </section>

        {/* 9 — upgradeability */}
        <section id="upgradeability">
          <div className="wrap">
            <div className="sec-head">
              <p className="eyebrow">08 · Upgradeability changes the answer</p>
              <h2>The same needs, two different decisions.</h2>
            </div>
            <div className="comp-list">
              <div className="comp card">
                <h3>When you can add or replace later</h3>
                <p>
                  A desktop with a spare slot, or a laptop with a replaceable drive, lets you buy
                  for the next couple of years rather than the next decade. Running out is
                  inconvenient rather than terminal, so the sensible purchase sits closer to the
                  measured total.
                </p>
              </div>
              <div className="comp card">
                <h3>When you cannot</h3>
                <p>
                  Some machines have storage soldered to the board or otherwise not user-replaceable;
                  others take a standard drive you can swap in an afternoon. Where it cannot be
                  changed, the capacity you buy is the capacity for the machine&rsquo;s life, and
                  buying one tier ahead stops being wasteful.
                </p>
              </div>
              <div className="comp card">
                <h3>Primary and secondary are different jobs</h3>
                <p>
                  A fast primary drive holding the system, applications and active files does not
                  have to hold the archive as well. Where a second drive is possible, splitting the
                  roles usually buys more usable space per unit of money than one very large drive.
                </p>
              </div>
              <div className="comp card">
                <h3>External storage helps, with friction</h3>
                <p>
                  An external drive reduces pressure on internal capacity and brings trade-offs:
                  something to carry, an interface that may be slower, a cable to remember, and a
                  workflow that breaks when it is not plugged in. Useful for archives; awkward for
                  work in progress.
                </p>
              </div>
            </div>
            <p className="note">
              Whether a particular machine can be upgraded is a fact about that machine, not about
              its category — worth checking on the manufacturer&rsquo;s own specifications before it
              becomes a constraint you discover later.
            </p>
          </div>
        </section>

        {/* 10 — mistakes */}
        <section id="mistakes">
          <div className="wrap">
            <div className="sec-head">
              <p className="eyebrow">09 · Common sizing mistakes</p>
              <h2>Eight ways the sum goes wrong.</h2>
            </div>
            <div className="card blind" style={{ maxWidth: 760 }}>
              <h3>Worth checking your own reasoning against</h3>
              <ul className="tick-list">
                {MISTAKES.map((m) => (
                  <li key={m}>{m}</li>
                ))}
              </ul>
            </div>
            <p className="note">
              The last one is the one that actually costs people their files.{' '}
              <b>A larger drive is not a backup.</b> More capacity stores more data; it does nothing
              about drive failure, theft, corruption or the file you deleted yesterday. What does is
              covered in <a href="/guides/ssd-best-practices">SSD best practices</a>.
            </p>
            <p className="note">
              Two more that belong to the drive rather than the size: whether a bigger model is
              faster, and whether it lasts longer, are both per-model questions to check on the
              specific product — the{' '}
              <a href="/guides/ssd">buying guide</a> covers which of those figures are worth
              reading.
            </p>
          </div>
        </section>

        {/* 11 — OS floor */}
        <section id="os">
          <div className="wrap">
            <div className="sec-head">
              <p className="eyebrow">10 · One thing a minimum requirement is not</p>
              <h2>The floor is not the room.</h2>
            </div>
            <div className="card rule-card">
              <p className="rule-quote">
                Microsoft states the Windows 11 minimum as <b>64 GB or greater available disk
                space</b>, and adds in the same document that there might be more storage required
                over time for updates and to enable specific features.
              </p>
              <p className="muted">
                A minimum install requirement says the system will fit. It says nothing about
                living on the machine afterwards with applications, updates and your own files. And
                a published figure is not always available at all: Apple&rsquo;s own page on
                upgrading to the current macOS does not state a free-space number, which is a useful
                reminder that measuring your own usage beats looking up somebody else&rsquo;s.
              </p>
            </div>
          </div>
        </section>

        {/* 12 — FAQ */}
        <section id="faq">
          <div className="wrap">
            <div className="sec-head">
              <p className="eyebrow">11 · Questions</p>
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
              <h2>A size is a decision. A drive is a separate one.</h2>
              <p>
                We are not recommending capacities or models, because a recommendation is only
                honest when it comes from data we can verify. When live offers exist they will be
                ranked by the published method — totals, commission-blind, nothing unverified.
              </p>
              <div className="hero-cta" style={{ justifyContent: 'center', marginTop: 28 }}>
                <a className="btn btn-primary" href="/#cta">
                  Join the waitlist →
                </a>
                <a className="btn btn-ghost" href="/guides/ssd">
                  How to choose the drive
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
