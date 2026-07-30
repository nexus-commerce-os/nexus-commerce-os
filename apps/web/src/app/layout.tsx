import React from 'react';
import type { Metadata } from 'next';
import '@nexus/ui/styles.css';

export const metadata: Metadata = {
  title: "NEXUS Commerce OS — the buyer's side of shopping",
  description:
    "An AI buying agent that finds the genuinely best price across authorized merchants, hands you off to check out directly, and counts a saving only once it's verified. Ranking is by value — never by who pays us most.",
  applicationName: 'NEXUS Commerce OS',
  // The growth loop is a screenshot of a verified saving (docs/03 §7), so a
  // shared link must carry its own preview rather than rendering as a bare URL.
  openGraph: {
    type: 'website',
    siteName: 'NEXUS Commerce OS',
    title: 'We only make money when you save money.',
    description:
      'An AI buying agent that finds the genuinely best price across authorized merchants and counts a saving only once it is verified. Commission-blind ranking, no payment custody.',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'We only make money when you save money.',
    description:
      'Commission-blind ranking, no payment custody, and savings that only count once verified.',
  },
  robots: { index: true, follow: true },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
