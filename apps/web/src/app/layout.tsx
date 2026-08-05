import React from 'react';
import type { Metadata } from 'next';
import '@nexus/ui/styles.css';

export const metadata: Metadata = {
  /*
   * Without this, every per-page `alternates.canonical` renders as a relative
   * href — measured on the live site, which served `<link rel="canonical"
   * href="/about">`. Relative canonicals are tolerated by Google and rejected
   * by roughly everything else that reads them, including the affiliate
   * reviewers this site has to satisfy. It also gives og:url and og:image a
   * real origin to resolve against.
   */
  metadataBase: new URL('https://honesttotal.com'),
  /*
   * The home page is a client component, so it cannot export `metadata` and
   * had no canonical at all — while www.honesttotal.com and the apex both
   * serve it, byte for byte, as verified against production. That is textbook
   * duplicate content, and the sitemap we submitted lists the apex, so the
   * ambiguity is worth removing rather than leaving to Google to guess.
   *
   * Declaring it here is safe: every content page sets its own
   * `alternates.canonical`, which overrides this, and the only route that does
   * not — the /ui component gallery — is already `robots: { index: false }`.
   */
  alternates: { canonical: '/' },
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

/*
 * Impact expects `value=`, not the `content=` that React's <meta> typings (and
 * Next's metadata API) allow, so the attributes are spread from a plain string
 * map — a Record<string, string> carries no excess-property check, which lets
 * the tag render byte-for-byte as the verifier expects it.
 */
const IMPACT_SITE_VERIFICATION: Record<string, string> = {
  name: 'impact-site-verification',
  value: '4f3e9f5c-7803-410c-95b9-bb36ab0d19c3',
  // `content` duplicates `value` deliberately. Impact's snippet uses `value`,
  // but a verifier written against the HTML spec would look for `content`,
  // which is the only attribute standard on <meta>. Emitting both costs
  // nothing and removes one guess about why verification fails.
  content: '4f3e9f5c-7803-410c-95b9-bb36ab0d19c3',
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
         * Impact partner-property ownership verification. Written as raw JSX
         * rather than through Next's `metadata.other` because Impact expects
         * `value=`, and the metadata API only emits `content=`. The value is
         * not a secret — it is served publicly in every page's source, which
         * is exactly how the verifier reads it.
         */}
        <meta {...IMPACT_SITE_VERIFICATION} />
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
