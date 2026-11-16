import type { MetadataRoute } from 'next';

/*
 * Crawlers may index the marketing page and the legal pages. `/ui` is an
 * internal component gallery and `/api` is not content, so neither is offered.
 *
 * Disallow is a request, not a control — the real protection for /ui is the
 * `noindex` metadata on the page and the X-Robots-Tag header in
 * next.config.mjs. This file exists so a well-behaved crawler does not waste
 * the request in the first place.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: '*', allow: '/', disallow: ['/ui', '/api/'] }],
  };
}
