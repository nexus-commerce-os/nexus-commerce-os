import {
  Badge,
  Brand,
  Button,
  Footer,
  MetricStat,
  SectionHead,
  StatePill,
  Table,
  Tabs,
} from '@nexus/ui';
import type { SavingsState, TableColumn } from '@nexus/ui';

// Illustrative operator data. P0.2 wires this to the real waitlist store + analytics.
type Signup = {
  email: string;
  region: string;
  state: SavingsState;
  label: string;
  when: string;
};

const SIGNUPS: Signup[] = [
  {
    email: 'jane@example.com',
    region: 'US',
    state: 'confirmed',
    label: 'Confirmed',
    when: '2 min ago',
  },
  {
    email: 'amir@example.pk',
    region: 'PK',
    state: 'pending',
    label: 'Pending',
    when: '14 min ago',
  },
  {
    email: 'sofia@example.eu',
    region: 'EU',
    state: 'confirmed',
    label: 'Confirmed',
    when: '38 min ago',
  },
  { email: 'ken@example.au', region: 'AU', state: 'pending', label: 'Pending', when: '1 hr ago' },
  { email: 'li@example.com', region: 'US', state: 'reversed', label: 'Bounced', when: '3 hr ago' },
];

const signupColumns: TableColumn<Signup>[] = [
  {
    key: 'email',
    header: 'Email',
    render: (s) => <span className="mono">{s.email}</span>,
  },
  { key: 'region', header: 'Region', render: (s) => <Badge>{s.region}</Badge> },
  {
    key: 'state',
    header: 'State',
    render: (s) => <StatePill state={s.state}>{s.label}</StatePill>,
  },
  {
    key: 'when',
    header: 'Signed up',
    align: 'right',
    render: (s) => (
      <span className="mono" style={{ color: 'var(--muted)', fontSize: '.8rem' }}>
        {s.when}
      </span>
    ),
  },
];

export default function AdminDashboard() {
  return (
    <>
      <header className="nav">
        <div className="wrap nav-in">
          <Brand href="/" />
          <span className="eyebrow" style={{ marginLeft: 'auto', color: 'var(--muted)' }}>
            Operator console
          </span>
          <Button variant="ghost">Sign out</Button>
        </div>
      </header>

      <main>
        <section style={{ borderTop: 0 }}>
          <div className="wrap">
            {/* the console needs a top-level heading; SectionHead renders an h2
                and left the document with none */}
            <h1 className="sr-only">NEXUS operator console</h1>
            <SectionHead eyebrow="Waitlist" title="Operations">
              Live view of waitlist signups and delivery health. Illustrative data — the real store
              / ESP is wired in P0.2.
            </SectionHead>

            <div className="band" style={{ marginBottom: '34px' }}>
              <MetricStat value={<em>1,284</em>} label="Total signups" />
              <MetricStat value={<em>+96</em>} label="New this week" />
              <MetricStat value={<em>3.1%</em>} label="Duplicate rate" />
              <MetricStat value="Memory" label="Active store driver" />
            </div>

            <Tabs
              tabs={[
                {
                  id: 'waitlist',
                  label: `Waitlist (${SIGNUPS.length})`,
                  content: (
                    <Table
                      columns={signupColumns}
                      rows={SIGNUPS}
                      getRowKey={(s) => s.email}
                      empty="No signups yet."
                    />
                  ),
                },
                {
                  id: 'delivery',
                  label: 'Delivery health',
                  content: (
                    <div className="band">
                      <MetricStat value={<em>98.7%</em>} label="Delivery success (7d)" />
                      <MetricStat value={<em>0</em>} label="Hard bounces (24h)" />
                      <MetricStat value={<em>2</em>} label="Pending confirms" />
                      <MetricStat value="ap-southeast-2" label="Region" />
                    </div>
                  ),
                },
              ]}
            />
          </div>
        </section>
      </main>

      <Footer
        note="NEXUS internal operator console — access-controlled, not indexed."
        columns={[
          {
            heading: 'Console',
            links: [
              { label: 'Waitlist', href: '/' },
              { label: 'Analytics', href: '/' },
              { label: 'Delivery health', href: '/' },
            ],
          },
          {
            heading: 'Platform',
            links: [
              { label: 'Runbooks', href: '/' },
              { label: 'Incidents', href: '/' },
            ],
          },
        ]}
        bottomLeft="© 2026 NEXUS Commerce OS"
        bottomRight="operator console · access-controlled"
      />
    </>
  );
}
