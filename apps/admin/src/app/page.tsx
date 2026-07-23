import {
  Brand,
  Button,
  Card,
  Eyebrow,
  Footer,
  MetricStat,
  SectionHead,
  StatePill,
} from "@nexus/ui";
import type { SavingsState } from "@nexus/ui";

// Illustrative operator data. P0.2 wires this to the real waitlist store + analytics.
type Signup = {
  email: string;
  region: string;
  state: SavingsState;
  label: string;
  when: string;
};

const SIGNUPS: Signup[] = [
  { email: "jane@example.com", region: "US", state: "confirmed", label: "Confirmed", when: "2 min ago" },
  { email: "amir@example.pk", region: "PK", state: "pending", label: "Pending", when: "14 min ago" },
  { email: "sofia@example.eu", region: "EU", state: "confirmed", label: "Confirmed", when: "38 min ago" },
  { email: "ken@example.au", region: "AU", state: "pending", label: "Pending", when: "1 hr ago" },
  { email: "li@example.com", region: "US", state: "reversed", label: "Bounced", when: "3 hr ago" },
];

const rowStyle = {
  display: "grid",
  gridTemplateColumns: "1fr auto auto auto",
  gap: "16px",
  alignItems: "center",
  padding: "13px 18px",
} as const;

export default function AdminDashboard() {
  return (
    <>
      <header className="nav">
        <div className="wrap nav-in">
          <Brand href="/" />
          <span
            className="eyebrow"
            style={{ marginLeft: "auto", color: "var(--muted)" }}
          >
            Operator console
          </span>
          <Button variant="ghost">Sign out</Button>
        </div>
      </header>

      <main>
        <section style={{ borderTop: 0 }}>
          <div className="wrap">
            <SectionHead eyebrow="Waitlist" title="Operations">
              Live view of waitlist signups and delivery health. Illustrative
              data — the real store / ESP is wired in P0.2.
            </SectionHead>

            <div className="band">
              <MetricStat value={<em>1,284</em>} label="Total signups" />
              <MetricStat value={<em>+96</em>} label="New this week" />
              <MetricStat value={<em>3.1%</em>} label="Duplicate rate" />
              <MetricStat value="Memory" label="Active store driver" />
            </div>

            <div style={{ marginTop: "34px" }}>
              <Eyebrow>Recent signups</Eyebrow>
              <div style={{ display: "grid", gap: "10px", marginTop: "16px" }}>
                {SIGNUPS.map((s) => (
                  <Card key={s.email} style={rowStyle}>
                    <span className="mono">{s.email}</span>
                    <span className="muted mono" style={{ fontSize: ".8rem" }}>
                      {s.region}
                    </span>
                    <StatePill state={s.state}>{s.label}</StatePill>
                    <span className="muted mono" style={{ fontSize: ".78rem" }}>
                      {s.when}
                    </span>
                  </Card>
                ))}
              </div>
            </div>
          </div>
        </section>
      </main>

      <Footer
        note="NEXUS internal operator console — access-controlled, not indexed."
        columns={[
          {
            heading: "Console",
            links: [
              { label: "Waitlist", href: "/" },
              { label: "Analytics", href: "/" },
              { label: "Delivery health", href: "/" },
            ],
          },
          {
            heading: "Platform",
            links: [
              { label: "Runbooks", href: "/" },
              { label: "Incidents", href: "/" },
            ],
          },
        ]}
        bottomLeft="© 2026 NEXUS Commerce OS"
        bottomRight="operator console · access-controlled"
      />
    </>
  );
}
