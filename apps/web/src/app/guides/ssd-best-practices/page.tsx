import type { Metadata } from 'next';

import { SiteFooter } from '@/components/SiteFooter';

/*
 * /guides/ssd-best-practices — using and maintaining, not buying.
 *
 * WHY THIS IS NOT PART OF /guides/ssd. That page answers "which drive should I
 * buy" — interfaces, form factors, SLC caches, which specifications matter.
 * This one is for someone who already has the drive installed. Search Console
 * shows "ssd best practices" as a visible query alongside "how to choose ssd",
 * and the /guides/ssd page carries roughly 41 impressions in the measured
 * period, so the surface has some pull. That is the whole of the evidence: no
 * hidden queries are assumed, and no claim is made that Google has shown
 * demand for any specific maintenance question below.
 *
 * TRUTH RULE FOR THIS FILE: SSD advice is unusually full of surviving HDD-era
 * folklore, so every operational claim here was checked against a primary
 * source before it was written:
 *
 *   - Windows optimisation behaviour: Microsoft's `defrag` command reference
 *     and the Optimize-Volume cmdlet documentation, read 2026-09-11. These are
 *     the source for the retrim-versus-defragmentation distinction in §03, and
 *     for the fact — usually reported wrongly in both directions — that the
 *     scheduled task's policy DOES include a traditional defragmentation pass
 *     for SSDs monthly, while a manual defrag causes the next scheduled run to
 *     skip it.
 *   - macOS: APFS issues TRIM asynchronously when files are freed (Apple's APFS
 *     documentation). Nothing is claimed here about third-party drives or
 *     trimforce, because the only material found on that was user forum reports.
 *   - Endurance: TBW is the manufacturer's rating and warranties run for the
 *     stated period or the TBW, whichever comes first; ratings are published
 *     against JESD218. Checked against manufacturer warranty and datasheet
 *     material.
 *
 * No percentages are invented, no "typical user writes X per year" figure is
 * asserted, no brand-specific behaviour is generalised, and no prices,
 * merchants or affiliate links appear.
 */

const BASE = 'https://honesttotal.com';

export const metadata: Metadata = {
  title: 'SSD best practices: keeping a drive healthy and fast — HonestTotal',
  description:
    'What actually helps an SSD: leave some free space, let the operating system handle optimisation, keep backups. What does not: manual defragmentation, free-space wiping and optimiser utilities left over from the hard-drive era.',
  alternates: { canonical: '/guides/ssd-best-practices' },
  openGraph: {
    type: 'article',
    url: `${BASE}/guides/ssd-best-practices`,
    title: 'Most SSD maintenance advice is hard-drive advice.',
    description:
      'What genuinely helps a solid-state drive, what is harmless folklore, and the one habit that matters more than every optimisation trick combined.',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Most SSD maintenance advice is hard-drive advice.',
    description: 'Free space, TRIM, endurance, firmware, backups — what is worth doing.',
  },
};

/** The whole article, compressed. */
const CHECKLIST = [
  'Leave some free space — how much is guidance, not a hardware rule',
  'Let the operating system run its own scheduled optimisation and leave it alone',
  'Do not run hard-drive-style defragmentation on an SSD by hand',
  'Leave TRIM working; on a current desktop OS this needs no action from you',
  'Update firmware deliberately, using the manufacturer’s own tool — not routinely',
  'Keep backups; the drive is not one',
  'Pay attention to unexpected errors or health warnings, not to a slowly falling percentage',
  'Skip write-heavy "optimisation" routines — they spend endurance to achieve nothing',
];

/** What helps, what is neutral, what is left over from hard drives. */
const HABITS = [
  {
    n: 'Free space',
    d: 'Keeping some of the drive empty gives the controller room for its fast write cache and its internal housekeeping. This genuinely affects how the drive behaves when busy.',
    state: 'Worth doing',
    tone: 'ok',
  },
  {
    n: 'OS scheduled optimisation',
    d: 'Windows and macOS already maintain SSDs on their own schedule. Leaving that alone is the correct action, and it is also the easiest one.',
    state: 'Worth leaving on',
    tone: 'ok',
  },
  {
    n: 'Backups',
    d: 'The only habit on this list that protects your data rather than your performance. Solid-state failure tends to be less gradual than the classic clicking hard drive, which makes the backup the thing that matters.',
    state: 'Matters most',
    tone: 'ok',
  },
  {
    n: 'Manual defragmentation',
    d: 'Reorganising file placement was a fix for the seek time of a spinning platter. An SSD has no seek time, so the exercise writes data for no benefit. The operating system already does the appropriate thing on its own.',
    state: 'Hard-drive habit',
    tone: 'warn',
  },
  {
    n: 'Wiping free space repeatedly',
    d: 'Multi-pass overwriting was designed for magnetic media. On flash it consumes write endurance, and TRIM already tells the drive which blocks are free.',
    state: 'Hard-drive habit',
    tone: 'warn',
  },
  {
    n: 'Third-party "SSD optimiser" tools',
    d: 'Some do little; some perform the two things above. The manufacturer’s own utility is a different category — that one is for firmware and health, and is worth having.',
    state: 'Usually unnecessary',
    tone: 'muted',
  },
];

/** Things people ask that have short, real answers. */
const FAQ = [
  {
    q: 'Should I defragment an SSD?',
    a: 'Not by hand, and not in the hard-drive sense. Defragmentation was a fix for the time a mechanical head spent moving between fragments, and an SSD has no head. Leave the operating system’s own scheduled optimisation enabled — on Windows that runs weekly by default and, for a solid-state drive, is principally a retrim rather than a traditional defragmentation.',
  },
  {
    q: 'Does Windows ever really defragment an SSD?',
    a: 'Yes, occasionally, and this is where most advice goes wrong in one direction or the other. Microsoft’s own documentation states that when optimisation runs from the scheduled task, the policy for solid-state drives includes both traditional defragmentation and retrim once per month — and that if you run a manual defragmentation in between, the next scheduled run skips the traditional pass. The practical conclusion is the same either way: leave the schedule alone rather than intervening.',
  },
  {
    q: 'What does TRIM actually do?',
    a: 'When you delete a file the operating system stops referencing those blocks, but the drive has no way of knowing they are now rubbish. TRIM tells it. That lets the controller erase and recycle them in its own time instead of discovering the problem during a write you are waiting on. On a current desktop operating system it is handled automatically — Apple’s file system, for instance, issues TRIM asynchronously as files are freed.',
  },
  {
    q: 'Do I need to run TRIM manually?',
    a: 'In ordinary use, no. It is part of routine maintenance the system already performs. Manually forcing it is the sort of thing worth doing when you are diagnosing a specific problem, not as a habit — and it will not restore a drive to its factory benchmark figures.',
  },
  {
    q: 'How much free space should I leave?',
    a: 'There is no universal hardware requirement, and any exact percentage you see quoted is a rule of thumb rather than a specification. The reason it helps is concrete: the fast write cache and the controller’s housekeeping both come out of unused space, so a drive running close to full has less room to work with. Leaving a comfortable margin is sensible; treating a specific number as a hard limit is not.',
    },
  {
    q: 'Does writing to an SSD wear it out?',
    a: 'Flash cells have a finite number of write and erase cycles, so in the strict sense yes — but the framing misleads. Manufacturers publish a TBW figure, the total terabytes the drive is rated to have written, and the warranty typically runs for the stated period or that TBW, whichever comes first. The useful response is not to avoid using the drive; it is to look up your own drive’s rating and its actual written total in the manufacturer’s utility if you are curious, rather than rationing ordinary use.',
  },
  {
    q: 'Should I update my SSD firmware?',
    a: 'Deliberately rather than reflexively. Firmware updates exist to fix real problems, and applying one for no reason carries a small risk for no gain. If the manufacturer has published a fix relevant to your drive, use their own tool and their own instructions, and have your important data backed up first — as you would before any consequential maintenance.',
  },
  {
    q: 'My drive health shows 95%. Should I worry?',
    a: 'No, and you should also not read it as a countdown. That indicator estimates consumed endurance; it is not a prediction of when the drive will stop working. What deserves attention is the unexpected — errors, drives disappearing, files that will not read. A slowly declining percentage is the drive reporting normal use.',
  },
];

const BREADCRUMB_LD = {
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: [
    // Two levels, matching the other guides: there is no /guides index page.
    { '@type': 'ListItem', position: 1, name: 'Home', item: `${BASE}/` },
    {
      '@type': 'ListItem',
      position: 2,
      name: 'SSD best practices',
      item: `${BASE}/guides/ssd-best-practices`,
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

export default function SsdBestPracticesPage() {
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
            <a className="active" href="/guides/ssd-best-practices">
              Looking after one
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
                <span aria-current="page">SSD best practices</span>
              </li>
            </ol>
          </nav>
        </div>

        {/* 1 — hero: the answer, immediately */}
        <section className="hero" style={{ borderTop: 0 }}>
          <div className="wrap">
            <span className="pill-eyebrow">
              <span aria-hidden="true">✦</span>
              <p className="eyebrow">Explainer · living with an SSD</p>
            </span>
            <h1 className="hero-h1" style={{ maxWidth: '24ch' }}>
              <span className="h1-underlined">SSD best practices:</span>{' '}
              <em>keeping a drive</em> healthy and fast.
            </h1>
            <p className="lede" style={{ marginTop: 24 }}>
              The short version: leave some free space, let the operating system run its own
              maintenance, and keep backups. Almost everything else people do to solid-state drives
              is inherited from hard drives, where it made sense, and does nothing here.
            </p>
            <p className="lede">
              A modern SSD is designed to look after itself. The genuinely useful habits are few,
              and most of them consist of not interfering.
            </p>
            <p className="prelaunch" style={{ maxWidth: '58ch' }}>
              <b>This page is about a drive you already have.</b> If you are still choosing one —
              capacity, NVMe versus SATA, what the speed figures mean — that is the{' '}
              <a href="/guides/ssd">SSD buying guide</a>.
            </p>
          </div>
        </section>

        {/* 2 — checklist first */}
        <section id="checklist">
          <div className="wrap">
            <div className="sec-head">
              <p className="eyebrow">01 · The short checklist</p>
              <h2>Everything below, in eight lines.</h2>
              <p>The rest of this page explains why, for anyone who wants the reasoning.</p>
            </div>
            <div className="card blind" style={{ maxWidth: 760 }}>
              <h3>Worth doing</h3>
              <ul className="tick-list">
                {CHECKLIST.map((c) => (
                  <li key={c}>{c}</li>
                ))}
              </ul>
            </div>
            <p className="note">
              Notice how much of it is passive. The most common mistake with an SSD is not neglect —
              it is maintenance borrowed from a different kind of storage.
            </p>
          </div>
        </section>

        {/* 3 — free space */}
        <section id="free-space">
          <div className="wrap">
            <div className="sec-head">
              <p className="eyebrow">02 · Free space</p>
              <h2>Leave the drive some room.</h2>
            </div>
            <div className="card rule-card">
              <p className="rule-quote">
                A drive running close to full has less space for its fast write cache and its
                internal housekeeping — so it has fewer options, and it slows down.
              </p>
              <p className="muted">
                This is a real effect with a mechanical explanation, not a superstition. It is also
                not a hardware requirement with a fixed threshold. Any specific percentage you see
                quoted is a rule of thumb; the behaviour varies with the drive, the controller and
                what you are asking it to do. Leave a comfortable margin rather than chasing a
                number. The mechanism — how the cache is carved out of unused space — is covered in
                the <a href="/guides/ssd">buying guide</a>.
              </p>
            </div>
          </div>
        </section>

        {/* 4 — defrag */}
        <section id="defragmentation">
          <div className="wrap">
            <div className="sec-head">
              <p className="eyebrow">03 · Defragmentation</p>
              <h2>No — and the reason matters.</h2>
              <p>
                This is the single most common piece of outdated advice, and correcting it badly is
                almost as common as repeating it.
              </p>
            </div>
            <div className="card rule-card">
              <p className="rule-quote">
                Defragmentation solved a mechanical problem: the time a read head spent travelling
                between pieces of a file. <b>An SSD has no head and no travel time</b>, so
                rearranging the pieces writes data to achieve nothing.
              </p>
              <p className="muted">
                What the operating system does on its own is a different operation. On Windows,
                scheduled optimisation runs weekly by default, and for a solid-state drive it is
                principally a <b>retrim</b> — telling the drive which blocks are free — rather than
                the file reshuffling the name suggests.
              </p>
            </div>
            <p className="note">
              The part usually reported wrongly: Microsoft&rsquo;s own documentation states that the
              scheduled task&rsquo;s policy for solid-state drives <b>does</b> include a traditional
              defragmentation pass once per month alongside the retrim — and that running a manual
              defragmentation in between causes the next scheduled run to skip that pass. So
              &ldquo;Windows never defragments an SSD&rdquo; is too strong. The practical advice is
              unchanged, and simpler than either claim: <b>leave the schedule alone.</b>
            </p>
          </div>
        </section>

        {/* 5 — TRIM */}
        <section id="trim">
          <div className="wrap">
            <div className="sec-head">
              <p className="eyebrow">04 · TRIM</p>
              <h2>How the drive learns what it can throw away.</h2>
            </div>
            <div className="card rule-card">
              <p className="rule-quote">
                Deleting a file tells the <em>operating system</em> to stop referencing those
                blocks. It does not tell the <em>drive</em>. TRIM is the message that does.
              </p>
              <p className="muted">
                Without it the controller keeps treating discarded data as live, and only discovers
                otherwise when it needs the space — during a write you are waiting for. With it, the
                cleanup happens quietly in advance. Current desktop operating systems handle this
                automatically: Apple&rsquo;s file system, for example, issues TRIM asynchronously as
                files are freed.
              </p>
            </div>
            <p className="note">
              You do not need to run it manually, and doing so will not restore a drive to the
              numbers on its box. TRIM keeps a drive behaving normally; it is not a performance
              treatment.
            </p>
          </div>
        </section>

        {/* 6 — endurance */}
        <section id="endurance">
          <div className="wrap">
            <div className="sec-head">
              <p className="eyebrow">05 · Writes and endurance</p>
              <h2>Finite, but not fragile.</h2>
              <p>
                Both of the usual framings are wrong: writing to an SSD is neither damaging it nor
                free.
              </p>
            </div>
            <div className="card rule-card">
              <p className="rule-quote">
                Flash cells tolerate a finite number of write and erase cycles. Manufacturers
                publish that budget as <b>TBW</b> — the total terabytes the drive is rated to
                have written — and the warranty typically runs for the stated number of years{' '}
                <b>or</b> that TBW, whichever comes first.
              </p>
              <p className="muted">
                What follows from this is not rationing. It is that endurance is a specification you
                can look up rather than a worry you have to carry: your drive has a rating, and the
                manufacturer&rsquo;s own utility will tell you how much has actually been written.
                If you are curious, check. Ordinary desktop and laptop use is not the scenario those
                ratings were designed to protect against.
              </p>
            </div>
            <p className="note">
              This is also why the write-heavy &ldquo;optimisation&rdquo; routines in §06 are worse
              than useless: they spend a finite budget to produce no benefit.
            </p>
          </div>
        </section>

        {/* 7 — habits table */}
        <section id="habits">
          <div className="wrap">
            <div className="sec-head">
              <p className="eyebrow">06 · Habits, sorted</p>
              <h2>What helps, and what is left over from hard drives.</h2>
            </div>
            <div className="fresh-table" role="table" aria-label="SSD habits, useful and otherwise">
              <div className="fresh-head" role="row">
                <span role="columnheader">Habit</span>
                <span role="columnheader">Why</span>
                <span role="columnheader">Verdict</span>
              </div>
              {HABITS.map((h) => (
                <div className="fresh-row" role="row" key={h.n}>
                  <span role="cell">
                    <b className={`fstate f-${h.tone}`}>{h.n}</b>
                  </span>
                  <span role="cell">{h.d}</span>
                  <span role="cell" className={`frank fr-${h.tone}`}>
                    {h.state}
                  </span>
                </div>
              ))}
            </div>
            <p className="note">
              Secure erasure is a separate subject and not maintenance. If you are disposing of a
              drive or handing it on, the manufacturer&rsquo;s sanitise function is the right
              instrument — not repeated overwriting, which is a magnetic-media technique that costs
              endurance here.
            </p>
          </div>
        </section>

        {/* 8 — firmware */}
        <section id="firmware">
          <div className="wrap">
            <div className="sec-head">
              <p className="eyebrow">07 · Firmware and utilities</p>
              <h2>Deliberately, not reflexively.</h2>
            </div>
            <div className="card blind" style={{ maxWidth: 760 }}>
              <h3>A reasonable position</h3>
              <ul className="tick-list">
                <li>
                  Firmware updates exist to fix real faults, and some have fixed serious ones
                </li>
                <li>
                  Applying one with no reason to is a small risk taken for no return
                </li>
                <li>
                  If the manufacturer has published a fix relevant to your drive, use their tool and
                  their instructions — not a third-party utility
                </li>
                <li>
                  Have important data backed up first, as before any consequential maintenance
                </li>
                <li>
                  The manufacturer&rsquo;s utility is also where health and written-total figures
                  live, which makes it worth having installed regardless
                </li>
              </ul>
            </div>
          </div>
        </section>

        {/* 9 — backups */}
        <section id="backups">
          <div className="wrap">
            <div className="sec-head">
              <p className="eyebrow">08 · The part that actually protects you</p>
              <h2>The drive is not a backup.</h2>
            </div>
            <div className="card rule-card">
              <p className="rule-quote">
                Every optimisation on this page is about how a drive <em>performs</em>. A backup is
                the only measure that addresses what happens when one <b>stops</b>.
              </p>
              <p className="muted">
                A health indicator estimates consumed endurance. It does not predict a failure date,
                and it will not warn you about a controller fault, a bad cable, a firmware bug, a
                dropped laptop, or the far more common problem of deleting something you needed.
                Solid-state failure also tends to be less gradual than the classic clicking hard
                drive — there is often no warning noise to act on.
              </p>
            </div>
            <p className="note">
              If you take one thing from this page, take this one. It is worth more than every
              tweak above combined, and it is the only item on the list that is still true when the
              hardware is not.
            </p>
          </div>
        </section>

        {/* 10 — FAQ */}
        <section id="faq">
          <div className="wrap">
            <div className="sec-head">
              <p className="eyebrow">09 · Questions</p>
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

        {/* 11 — CTA */}
        <section id="cta" style={{ borderTop: 0 }}>
          <div className="wrap">
            <div className="cta-final">
              <h2>Answers first, comparisons when the data is real.</h2>
              <p>
                This page recommends no drive and quotes no price. When live offers exist they will
                be ranked by the published method — totals, commission-blind, nothing unverified.
              </p>
              <div className="hero-cta" style={{ justifyContent: 'center', marginTop: 28 }}>
                <a className="btn btn-primary" href="/guides/ssd">
                  Choosing a drive instead? →
                </a>
                <a className="btn btn-ghost" href="/how-we-rank">
                  Read how we rank
                </a>
              </div>
            </div>
          </div>
        </section>
      </main>

      <SiteFooter note={<>No models endorsed · no prices quoted · pre-launch</>} />
    </>
  );
}
