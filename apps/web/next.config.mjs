/** @type {import('next').NextConfig} */

/*
 * Security headers.
 *
 * ──── WHY script-src ALLOWS 'unsafe-inline', MEASURED NOT ASSUMED ──────────
 *
 * It did not, and that broke the site. With `script-src 'self'`, tested in a
 * real browser against a production build:
 *
 *     inline <script> tags in the page   5  (3,338 bytes)
 *     self.__next_f.push payloads ran    NO
 *     form.__reactProps$                 absent
 *     verdict                            NOT HYDRATED — the form was dead
 *
 * Next's App Router streams its RSC payload through inline
 * `<script>self.__next_f.push(...)</script>` tags. Block them and React never
 * hydrates: the page still RENDERS, so it looks completely fine, and the
 * waitlist button silently does nothing for every visitor. That is the worst
 * kind of breakage and exactly why this was tested rather than reasoned about.
 *
 * A per-request nonce is the textbook fix and was implemented and tested next.
 * It also failed, for a reason worth recording: a nonce cannot appear in
 * statically prerendered HTML, because that HTML is generated once at build
 * time. Next therefore stamped no nonce, and `'strict-dynamic'` — which makes
 * the browser ignore `'self'` — then blocked the external bundles too, leaving
 * the page worse off than before. Making the nonce work requires
 * `force-dynamic` on every page, which throws away static delivery of a 7.6 kB
 * marketing page to defend against an injection vector this site does not have.
 *
 * So: 'unsafe-inline' for scripts, deliberately, with the surface it exposes
 * written down. This site renders no user-generated content, reflects no query
 * parameter, and loads no third-party script. The only visitor input is an
 * email address, which is returned as JSON and rendered by React as text, so it
 * is escaped. There is no HTML sink for an attacker to reach.
 *
 * REVISIT THIS the moment any of those stops being true — user-generated
 * content, a reflected parameter, a third-party tag, or an `innerHTML` call.
 * At that point the nonce plus dynamic rendering becomes worth its cost, and
 * this comment is the record of what it costs.
 *
 * Everything else stays locked down, and each of these is doing real work
 * independently of script-src: object-src blocks plugin execution, base-uri
 * blocks a <base> tag rewriting every relative URL, form-action stops a form
 * being repointed at an attacker, and frame-ancestors is the clickjacking
 * defence that modern browsers actually honour.
 */
const CSP = [
  "default-src 'self'",
  // See the note above. Tested: without 'unsafe-inline' the page does not hydrate.
  "script-src 'self' 'unsafe-inline'",
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
