import type { Metadata } from 'next';

/*
 * /faq — the hub. 44 questions, none of them recycled.
 *
 * TRUTH RULE FOR THIS FILE: before writing, every existing FAQ on the site was
 * extracted — 50 across nine pages plus 5 on the home page, 55 in total — and
 * none of them is repeated here. Where a question belongs to a deeper page the
 * answer links there instead of restating it, so the two can never drift apart.
 *
 * Several answers are deliberately unflattering: the most likely way this
 * fails, the weakest part of the method, what happens if the founder loses
 * interest, and what is left if a giant copies the idea. A FAQ that only
 * contains questions the author enjoys answering is marketing with a
 * question mark bolted on.
 */

const BASE = 'https://honesttotal.com';

export const metadata: Metadata = {
  title: 'FAQ — Honest Total',
  description:
    'Forty-four questions about what this is, how it will make money, why the ranking cannot be bought, what happens to your data, and the uncomfortable ones — including the most likely way this fails.',
  alternates: { canonical: '/faq' },
  openGraph: {
    type: 'article',
    url: `${BASE}/faq`,
    title: 'Forty-four questions, including the ones we would rather skip.',
    description:
      'What this is, how it makes money, why commission cannot buy position, and the honest answers about how it might fail.',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Forty-four questions, including the ones we would rather skip.',
    description: 'Including the most likely way this fails and the weakest part of the method.',
  },
};

type Q = { q: string; a: string };
type Group = { id: string; n: string; title: string; items: Q[] };

const GROUPS: Group[] = [
  {
    id: 'basics',
    n: '01',
    title: 'The basics',
    items: [
      {
        q: 'What is Honest Total, in one sentence?',
        a: 'A shopping comparison being built on one rule — rank offers by the total you actually pay, and never let commission influence that order. Everything else on this site follows from that sentence.',
      },
      {
        q: 'Is any of it usable today?',
        a: 'No. Today the site is writing: a published method, buying guides, and a waitlist. There is no comparison to run because no merchant data is connected. We would rather say that than dress a landing page up as a product.',
      },
      {
        q: 'Why does the site say NEXUS in some places and Honest Total in others?',
        a: 'NEXUS Commerce OS is the internal codename the engineering work carries; Honest Total is the public brand and the domain. You are seeing a project mid-rename rather than two companies. Where they appear together it is because the underlying system name has not been retired yet.',
      },
      {
        q: 'What will it actually do when it opens?',
        a: 'Take a product you are considering, gather offers from merchants whose data we are licensed to use, work out the real total for each — item, delivery, unavoidable fees — and order them by that number. Then hand you to the merchant to buy directly.',
      },
      {
        q: 'Which categories will it cover first?',
        a: 'Headphones, in the United States. One category and one market, because a comparison that is thin across fifty categories is useless in all of them. The buying guides start there for the same reason.',
      },
      {
        q: 'When will it launch?',
        a: 'No date, and we will not invent one. Launch depends on getting authorised access to merchant data, which is a decision other companies make about us. When there is a date that does not depend on someone else saying yes, it will be published.',
      },
    ],
  },
  {
    id: 'price',
    n: '02',
    title: 'The number that matters',
    items: [
      {
        q: 'What does “all-in price” include that a normal price does not?',
        a: 'Delivery to your destination and any mandatory fee — handling, surcharges, disposal levies — that you cannot avoid at checkout. The headline price is what a merchant advertises; the all-in price is what leaves your account.',
      },
      {
        q: 'Why would a cheaper-looking offer be left out of the comparison entirely?',
        a: 'Because if a required part of its total is unknown, we cannot say what it costs. Ranking it on the item price alone would put whichever merchant discloses least at the top. The full rule is on the How we rank page.',
      },
      {
        q: 'How will you handle sales tax?',
        a: 'By not pretending to know it. US sales tax depends on the delivery address, so without one it is not merely unmeasured but unknowable. Comparisons are made pre-tax and labelled as such rather than padded with a plausible-looking guess.',
      },
      {
        q: 'What if two offers have the same all-in total?',
        a: 'They tie, and the tie is broken by something that benefits you — availability and freshness of the data — never by what either merchant pays. A tie-break on commission is the most common way a neutral ranking quietly stops being one.',
      },
      {
        q: 'Will you show price history?',
        a: 'Only if we can source it legitimately. A price-history chart assembled by scraping is exactly the kind of unlicensed data this project has ruled out, so it will either come from an authorised source or not exist.',
      },
      {
        q: 'Will you tell me to wait for a better price?',
        a: 'No. That is a prediction about the future dressed as advice, and we would be wrong often enough to cost people money. We will show you what things cost now and what the total really is.',
      },
    ],
  },
  {
    id: 'money',
    n: '03',
    title: 'Money and incentives',
    items: [
      {
        q: 'If commission is invisible to the ranking, why disclose it at all?',
        a: 'Because you are entitled to know how a site pays for itself even when it cannot act on it. Disclosure is not an apology for a conflict — it is what lets you judge whether the structure we describe is credible.',
      },
      {
        q: 'What happens to your revenue if I read the guides and buy nothing?',
        a: 'We earn nothing, and that is the correct outcome. A guide that helped you decide not to buy did its job. The business only works if the advice is worth reading whether or not it ends in a purchase.',
      },
      {
        q: 'Do you earn more from expensive products?',
        a: 'In absolute terms, usually yes — commission is typically a percentage. That is precisely why commission is kept out of the ranking input: the incentive exists, so it is denied a route into the decision rather than resisted by willpower.',
      },
      {
        q: 'Would you ever charge users directly?',
        a: 'Possibly, and it would be the cleanest model of all — a subscription aligns us with the reader rather than the merchant. It is not the plan today because charging for something this incomplete would be indefensible.',
      },
      {
        q: 'What stops you changing these rules once real money is involved?',
        a: 'Nothing absolute — and any site claiming otherwise is overstating it. What exists is a published, dated method, a commitment to change it before rather than after, and a structure where the ranker is not given the data it would need to cheat. That is a higher bar to quietly cross than a promise.',
      },
      {
        q: 'Is anyone funding you whose interests differ from mine?',
        a: 'No. There are no investors, no advertisers and no partners — the project is self-funded. That is a limitation as much as a virtue: it means progress is slow. But it also means nobody is waiting for a return that would have to come out of your pocket.',
      },
    ],
  },
  {
    id: 'trust',
    n: '04',
    title: 'Trust, and how to check it',
    items: [
      {
        q: 'Why should I believe a site that calls itself honest?',
        a: 'You should not, on the strength of the name. What you can do is check the specific claims: the ranking method is published, the savings states are defined, the cookie claim is verifiable in your own browser, and the status sections say what is not built. Names are free; checkable statements are not.',
      },
      {
        q: 'What is the easiest way to catch us lying?',
        a: 'Open your browser tools and check the cookie claim, then read the status sections and see whether they admit more than a marketing site would. If a page ever describes a running product while nothing runs, that is the tell — and it is the thing we watch for hardest.',
      },
      {
        q: 'Has anything on this site ever been wrong?',
        a: 'Yes. A call-to-action button was unclickable for a period after launch, and a button in the footer band was invisible in dark mode. Both are written up in full, including how they were missed, in the incident log kept with the code.',
      },
      {
        q: 'Do you publish mistakes, or just fix them quietly?',
        a: 'Publish. Every defect that reached, or would have reached, a real visitor gets a written entry — what broke, why it stayed hidden, how it was found, and what would prevent the next one. A bug nobody reported is not a bug that did not happen.',
      },
      {
        q: 'What would make you shut this down?',
        a: 'Discovering that the core idea does not survive contact with real data — for example if authorised feeds turn out to lack shipping information so consistently that honest all-in totals are impossible for most offers. If the method cannot be delivered, saying so is better than shipping a diluted version under the same name.',
      },
      {
        q: 'Is there anything on this site you would call marketing?',
        a: 'The headlines, honestly. They are written to be read. What sits under them is constrained by the truth rules, and the illustrative figures are labelled every time. If you spot a headline the body cannot support, that is a fair complaint and we want to hear it.',
      },
    ],
  },
  {
    id: 'merchants',
    n: '05',
    title: 'Merchants',
    items: [
      {
        q: 'How will you decide which merchants appear?',
        a: 'By whether we have authorised access to their data and whether they can supply a complete enough offer to compute a real total. Not by who pays most, and not by who asks. A merchant we cannot price honestly is a merchant we cannot rank.',
      },
      {
        q: 'Will you include merchants who do not pay you anything?',
        a: 'Yes, where the data is available to us. Excluding a genuinely cheaper non-paying merchant would be the same distortion as promoting a paying one, just harder to notice.',
      },
      {
        q: 'What if a merchant asks you to remove an unflattering result?',
        a: 'We would decline, and if the request were interesting enough we would consider publishing that it was made. A result is unflattering because of the merchant’s own price and shipping, both of which they control.',
      },
      {
        q: 'How will you know a merchant is legitimate?',
        a: 'Because access comes through affiliate networks that verify their advertisers, not through us scraping whatever is online. It is not a guarantee of good service, and we will not pretend a hand-off is an endorsement of a merchant’s customer support.',
      },
      {
        q: 'Will you rank your own products one day?',
        a: 'There will not be any. Selling our own inventory would put us on both sides of the comparison, which no amount of disclosure fixes. The referral-only structure is a deliberate constraint, not a stage we are passing through.',
      },
    ],
  },
  {
    id: 'data',
    n: '06',
    title: 'Your data',
    items: [
      {
        q: 'Will I need an account?',
        a: 'Not to compare prices. The comparison should work for someone who arrives from a search result and leaves two minutes later. If accounts ever exist they will be for features that genuinely need to remember something, and they will be optional.',
      },
      {
        q: 'Will you email me anything besides the launch notice?',
        a: 'No. One email, when your region opens. There is no newsletter, no drip sequence and no partner mailing — and since the address is deleted on request rather than suppressed, leaving is complete rather than administrative.',
      },
      {
        q: 'What happens to my email if the project shuts down?',
        a: 'It gets deleted, not sold. A waitlist is one of the few assets a failed startup can quietly liquidate, which is exactly why saying so in advance matters more than saying it at the time.',
      },
      {
        q: 'Do you know who I am while I read this page?',
        a: 'No. There is no analytics, no cookie and no fingerprinting, so you are not distinguishable from any other reader. Our host sees the technical details of the request, as any host must, and that is the whole of it.',
      },
      {
        q: 'Do you use AI on anything I write to you?',
        a: 'No. Email sent to us is read by a person. When AI is used in the product it will be for working through offer data, and the pages describing it will say where it is used and what it is not allowed to decide.',
      },
    ],
  },
  {
    id: 'who',
    n: '07',
    title: 'Who is behind it',
    items: [
      {
        q: 'Who is building this?',
        a: 'One person, self-funded, working in the open. There is no team page because there is no team, and inventing one is the most common piece of pre-launch theatre we are trying to avoid.',
      },
      {
        q: 'Why is the founder’s name not published?',
        a: 'Because it is the one detail a reader cannot check, and this site is built around claims that can be. What is public — the method, the disclosure terms, the status, the incident log — is verifiable. The name will appear when there is an entity for it to be attached to.',
      },
      {
        q: 'Is this a side project?',
        a: 'It is a project without outside funding, which means it moves at the pace one person can sustain. That is the honest framing. It also explains why the writing exists before the product: the writing is the part one person can get right.',
      },
      {
        q: 'What if you lose interest halfway through?',
        a: 'Then the site stops being updated and the waitlist gets deleted rather than sold. It is a real risk with a solo project and pretending otherwise would be silly. The status sections are dated precisely so that a stale site is visibly stale.',
      },
      {
        q: 'Can I help, or are you hiring?',
        a: 'Not hiring — there is no money to hire with. But a sharp email pointing out a flaw in the method is genuinely valuable, and corrections to the site are the contribution we most want right now.',
      },
    ],
  },
  {
    id: 'hard',
    n: '08',
    title: 'The uncomfortable ones',
    items: [
      {
        q: 'Comparison sites have existed for twenty years. Why would this be different?',
        a: 'It might not be. The specific bet is narrow: that ranking on the real total rather than the headline price, and structurally excluding commission from that ranking, produces a different answer often enough to matter. If it turns out the answers are usually the same, the project has no reason to exist.',
      },
      {
        q: 'What is the most likely way this fails?',
        a: 'Distribution. The method could be right, the writing could be good, and almost nobody could find it — comparison traffic is dominated by sites with two decades of authority. Building the thing is the part we control; being discovered is not.',
      },
      {
        q: 'What is the weakest part of your method?',
        a: 'Shipping data. All-in pricing depends on knowing delivery cost, and merchant feeds are inconsistent about it. If that data is missing often enough, the honest response — refusing to rank incomplete offers — could leave comparisons too sparse to be useful. That is a real risk and not a solved problem.',
      },
      {
        q: 'Are you not just going to sell to a bigger company and drop all this?',
        a: 'We cannot promise otherwise in a way you should believe — everyone says no until the offer arrives. What we can say is that the commitments are published and dated, so an acquirer quietly reversing them would be doing it in public against a written record.',
      },
      {
        q: 'If a giant copied this idea tomorrow, what would you have left?',
        a: 'Very little in the way of technology, and that is fine — none of this is hard to build. What is hard is choosing to leave money on the table repeatedly, which is difficult for a company whose ranking already earns from placement. The idea is easy to copy and expensive to adopt.',
      },
      {
        q: 'Why should I give my email to a site with no product?',
        a: 'Only if the writing convinced you the eventual product is worth hearing about. The cost is one email, deletable on request, never sold — but “nothing to lose” is not a reason to sign up. If the method does not persuade you, do not join, and the guides are free to read regardless.',
      },
    ],
  },
  {
    id: 'practical',
    n: '09',
    title: 'Practical',
    items: [
      {
        q: 'Can I use this outside the United States?',
        a: 'Not at first. The US is the launch market because merchant data access, tax handling and consumer law all differ by country, and getting one right is achievable. The waitlist asks nothing about where you are; when a region opens, that is when the email goes out.',
      },
      {
        q: 'Is there an app?',
        a: 'No, and there may never be. A comparison you use a handful of times a year does not justify asking for installation and the permissions that come with it. The web works, and it does not need to know where your phone is.',
      },
      {
        q: 'Will there be a browser extension?',
        a: 'Undecided, and cautiously so. Extensions in this category have a poor history — they see everything you browse, and several have been sold to companies that monetised exactly that. If one is ever built, what it can see will be the first thing documented.',
      },
      {
        q: 'Is there an API?',
        a: 'Not today. If one exists later, offer data will be governed by what our licences permit us to pass on, which is likely to be less than developers would want. Promising an open API over data we do not own would be a promise to break.',
      },
    ],
  },
];

const ALL: Q[] = GROUPS.flatMap((g) => g.items);

const FAQ_LD = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: ALL.map((f) => ({
    '@type': 'Question',
    name: f.q,
    acceptedAnswer: { '@type': 'Answer', text: f.a },
  })),
};

const BREADCRUMB_LD = {
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: [
    { '@type': 'ListItem', position: 1, name: 'Home', item: `${BASE}/` },
    { '@type': 'ListItem', position: 2, name: 'FAQ', item: `${BASE}/faq` },
  ],
};

export default function FaqPage() {
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
            <a href="/how-we-rank">How we rank</a>
            <a className="active" href="/faq">
              FAQ
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
                <span aria-current="page">FAQ</span>
              </li>
            </ol>
          </nav>
        </div>

        {/* 1 — hero */}
        <section className="hero" style={{ borderTop: 0 }}>
          <div className="wrap">
            <span className="pill-eyebrow">
              <span aria-hidden="true">✦</span>
              <p className="eyebrow">FAQ</p>
            </span>
            <h1 className="hero-h1" style={{ maxWidth: '21ch' }}>
              <span className="h1-underlined">{ALL.length} questions,</span>{' '}
              <em>including the awkward ones.</em>
            </h1>
            <p className="lede" style={{ marginTop: 24 }}>
              Grouped so you can skip to what you care about. Several answers are deliberately
              unflattering — the most likely way this fails, the weakest part of the method, and
              what happens if the person building it stops.
            </p>
            <p className="prelaunch" style={{ maxWidth: '58ch' }}>
              <b>None of these repeats a question answered elsewhere.</b> Where an answer belongs to
              a deeper page it links there rather than restating it, so the two cannot drift apart.
            </p>
          </div>
        </section>

        {/* 2 — jump links */}
        <section id="contents">
          <div className="wrap">
            <div className="sec-head">
              <p className="eyebrow">Contents</p>
              <h2>Nine groups.</h2>
            </div>
            <nav className="crumbs" aria-label="FAQ sections" style={{ paddingTop: 0 }}>
              <ol style={{ gap: '10px 18px' }}>
                {GROUPS.map((g) => (
                  <li key={g.id}>
                    <a href={`#${g.id}`}>
                      {g.n} · {g.title}
                    </a>
                  </li>
                ))}
              </ol>
            </nav>
          </div>
        </section>

        {GROUPS.map((g) => (
          <section id={g.id} key={g.id}>
            <div className="wrap">
              <div className="sec-head">
                <p className="eyebrow">
                  {g.n} · {g.title}
                </p>
                <h2>
                  {g.items.length} question{g.items.length === 1 ? '' : 's'}.
                </h2>
              </div>
              <div className="faq">
                {g.items.map((f) => (
                  <details key={f.q}>
                    <summary>{f.q}</summary>
                    <p>{f.a}</p>
                  </details>
                ))}
              </div>
            </div>
          </section>
        ))}

        {/* 3 — not answered */}
        <section id="unanswered">
          <div className="wrap">
            <div className="sec-head">
              <p className="eyebrow">Still not answered</p>
              <h2>Then ask, and we will add it.</h2>
            </div>
            <div className="card rule-card">
              <p className="rule-quote">
                A question we cannot answer honestly is more useful to us than one we can — it
                usually means <b>a page needs rewriting</b>.
              </p>
              <p className="muted">
                Write to <a href="mailto:hello@honesttotal.com">hello@honesttotal.com</a>. Questions
                that expose a gap get added here, and if the honest answer is uncomfortable it goes
                in with the other uncomfortable ones rather than being smoothed over.
              </p>
            </div>
          </div>
        </section>

        {/* 4 — CTA */}
        <section id="cta" style={{ borderTop: 0 }}>
          <div className="wrap">
            <div className="cta-final">
              <h2>Read the method before the waitlist.</h2>
              <p>
                It is the only page that matters — the rest of the site is an argument for taking it
                seriously.
              </p>
              <div className="hero-cta" style={{ justifyContent: 'center', marginTop: 28 }}>
                <a className="btn btn-primary" href="/how-we-rank">
                  Read how we rank →
                </a>
                <a className="btn btn-ghost" href="/#cta">
                  Join the waitlist
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
            <span className="mono">{ALL.length} answered · none recycled · pre-launch</span>
          </div>
        </div>
      </footer>
    </>
  );
}
