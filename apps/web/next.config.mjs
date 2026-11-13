/** @type {import('next').NextConfig} */

/*
 * Security headers.
 *
 * The CSP is the only interesting one. This site has no analytics, no pixels,
 * no third-party scripts and no remote images — so `default-src 'self'` is
 * actually achievable rather than aspirational, and it is worth locking down
 * now, while it is true, instead of after something has been bolted on.
 *
 * `'unsafe-inline'` IS present for styles, and that is a real concession: the
 * landing page sets inline `style={{...}}` on several elements and Next injects
 * its own style tags. Scripts carry no such exemption.
 *
 * `frame-ancestors 'none'` rather than X-Frame-Options alone, because CSP is
 * what modern browsers honour; the legacy header stays for older ones.
 */
const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data:",
  "font-src 'self' data:",
  // The waitlist POSTs to this origin; the ESP is called server-side only.
  "connect-src 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "base-uri 'none'",
  "object-src 'none'",
  'upgrade-insecure-requests',
].join('; ');

const SECURITY_HEADERS = [
  { key: 'Content-Security-Policy', value: CSP },
  // why 2 years + preload-ready: HTTPS-only is not a transition here, the site
  // has never been served over HTTP.
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  // Nothing here needs a camera, a microphone or a location, so say so.
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=()' },
  { key: 'X-DNS-Prefetch-Control', value: 'off' },
  { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
];

const nextConfig = {
  reactStrictMode: true,
  // Workspace packages ship raw TS (main: src/index.ts) — let Next transpile them.
  transpilePackages: ['@nexus/ui'],
  // Linting is owned by the workspace `eslint src` (root flat config), not `next lint`.
  // eslint-config-next is intentionally not a dependency, so skip Next's build-time lint.
  eslint: { ignoreDuringBuilds: true },
  // why: the framework version is a free gift to anyone fingerprinting the stack.
  poweredByHeader: false,
  async headers() {
    return [
      { source: '/:path*', headers: SECURITY_HEADERS },
      {
        // The component gallery is an internal tool. The page also carries
        // `robots: { index: false }`, but a header covers it even if the page
        // is reached in a way that skips the metadata.
        source: '/ui/:path*',
        headers: [{ key: 'X-Robots-Tag', value: 'noindex, nofollow' }],
      },
      { source: '/ui', headers: [{ key: 'X-Robots-Tag', value: 'noindex, nofollow' }] },
    ];
  },
};

export default nextConfig;
