import React from "react";
import type { Metadata } from "next";
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
  Receipt,
  SectionHead,
  StatePill,
  Step,
} from "@nexus/ui";

export const metadata: Metadata = {
  title: "@nexus/ui — component gallery",
  description: "Live gallery of the @nexus/ui design-system primitives.",
  robots: { index: false, follow: false },
};

function Demo({ name, children }: { name: string; children: React.ReactNode }) {
  return (
    <Card style={{ padding: "22px", display: "grid", gap: "16px" }}>
      <Eyebrow>{name}</Eyebrow>
      <div
        style={{
          display: "flex",
          gap: "14px",
          flexWrap: "wrap",
          alignItems: "center",
        }}
      >
        {children}
      </div>
    </Card>
  );
}

const galleryGrid = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))",
  gap: "18px",
} as const;

export default function Gallery() {
  return (
    <>
      <main>
        <section style={{ borderTop: 0 }}>
          <div className="wrap">
            <SectionHead eyebrow="@nexus/ui" title="Component gallery">
              14 primitives, rendered live from the package. Toggle your OS
              light/dark theme to see both.
            </SectionHead>

            <div style={galleryGrid}>
              <Demo name="Button">
                <Button>Primary</Button>
                <Button variant="ghost">Ghost</Button>
                <Button href="#">Link</Button>
              </Demo>

              <Demo name="Eyebrow">
                <Eyebrow>Section label</Eyebrow>
              </Demo>

              <Demo name="StatePill">
                <StatePill state="estimated">Estimated</StatePill>
                <StatePill state="pending">Pending</StatePill>
                <StatePill state="confirmed">Confirmed</StatePill>
                <StatePill state="reversed">Reversed</StatePill>
              </Demo>

              <Demo name="PhaseTag">
                <PhaseTag code="P1" live>
                  Live
                </PhaseTag>
                <PhaseTag code="P2">Queued</PhaseTag>
              </Demo>

              <Demo name="MetricStat">
                <MetricStat value={<em>$0.00</em>} label="Custody" />
                <MetricStat value={<em>100%</em>} label="Disclosed" />
              </Demo>

              <Demo name="Brand">
                <Brand href="#" />
              </Demo>

              <Demo name="Step">
                <Step index="01" title="Ask">
                  Tell the agent what you want — in words.
                </Step>
              </Demo>

              <Demo name="FeatureCard">
                <FeatureCard icon="✓" title="Honest by metric">
                  Counts only confirmed savings.
                </FeatureCard>
              </Demo>

              <Demo name="AgentPoint">
                <AgentPoint index="01" title="Structured deal out">
                  A ranked, machine-readable offer with a signed hand-off link.
                </AgentPoint>
              </Demo>

              <Demo name="SectionHead">
                <SectionHead eyebrow="Eyebrow" title="A section title">
                  With an optional lede paragraph.
                </SectionHead>
              </Demo>
            </div>

            <div style={{ ...galleryGrid, marginTop: "18px" }}>
              <Demo name="Receipt">
                <Receipt
                  title="NEXUS · VERIFIED"
                  code="RCPT #0001"
                  rows={[
                    { label: "Best price", value: "$328.00", mono: true },
                    { label: "List price", value: "$375.12", mono: true },
                  ]}
                  totalLabel="Saved"
                  totalValue="$47.12"
                  stamp="VERIFIED ✓"
                  footer="Illustrative"
                />
              </Demo>

              <Demo name="AgentTerminal">
                <AgentTerminal session="nexus-agent · demo">
                  <div>
                    <span className="u">you ›</span> best price on the XM5
                  </div>
                  <div style={{ marginTop: "8px" }}>
                    <span className="n">nexus ›</span> $328.00 at Merchant A
                  </div>
                </AgentTerminal>
              </Demo>
            </div>
          </div>
        </section>
      </main>

      <Footer
        note="@nexus/ui — 14 shared design-system primitives. Headless-with-global-tokens."
        columns={[
          {
            heading: "Docs",
            links: [{ label: "packages/ui/README", href: "/" }],
          },
        ]}
        bottomLeft="© 2026 NEXUS Commerce OS"
        bottomRight="component gallery"
      />
    </>
  );
}
