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
    /*
     * `suppressHydrationWarning` is required, not incidental: the inline script
     * below sets `data-theme` on this element before React hydrates, so the
     * client markup legitimately differs from the server's. It suppresses the
     * warning for this element's attributes only — not for its subtree — which
     * is the documented pattern for a no-flash theme script.
     */
    <html lang="en" suppressHydrationWarning>
      <head>
        {/*
         * Applies the saved theme before first paint.
         *
         * The toggle writes to localStorage, but React only runs after hydration
         * — so without this a visitor who chose dark would get a white flash on
         * every navigation before it corrected itself. Reading storage here, in
         * a blocking inline script, is the standard way to avoid that; it is
         * deliberately tiny and wrapped, because a thrown error in <head> would
         * take the page down and a colour preference is never worth that.
         */}
        <script
          dangerouslySetInnerHTML={{
            __html:
              "try{var t=localStorage.getItem('nexus-theme');" +
              "if(t==='dark'||t==='light')document.documentElement.setAttribute('data-theme',t)}catch(e){}",
          }}
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
