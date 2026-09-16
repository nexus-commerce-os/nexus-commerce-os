import type { MetadataRoute } from 'next';

/*
 * Everything public is crawlable; the only excluded path is the waitlist API,
 * which serves no content. The internal /ui component gallery stays crawlable
 * but out of the sitemap — harmless if found, not worth promoting.
 */

export const dynamic = 'force-static';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: '*', allow: '/', disallow: ['/api/'] }],
    sitemap: 'https://honesttotal.com/sitemap.xml',
  };
}
