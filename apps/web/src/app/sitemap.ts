import type { MetadataRoute } from 'next';

/*
 * Built at export time into a static sitemap.xml. The list is maintained by
 * hand on purpose: with five-odd routes, an explicit list a reviewer can read
 * beats a clever crawler of the filesystem — and a page missing from here is
 * a deliberate decision, not an accident.
 */

export const dynamic = 'force-static';

const BASE = 'https://honesttotal.com';

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: `${BASE}/`, changeFrequency: 'weekly', priority: 1 },
    { url: `${BASE}/how-we-rank`, changeFrequency: 'monthly', priority: 0.9 },
    { url: `${BASE}/verified-savings`, changeFrequency: 'monthly', priority: 0.9 },
    { url: `${BASE}/commission-blind`, changeFrequency: 'monthly', priority: 0.9 },
    { url: `${BASE}/guides/over-ear-headphones`, changeFrequency: 'monthly', priority: 0.8 },
    { url: `${BASE}/guides/how-anc-works`, changeFrequency: 'monthly', priority: 0.8 },
    { url: `${BASE}/guides/oled-tv`, changeFrequency: 'monthly', priority: 0.8 },
    { url: `${BASE}/guides/ssd`, changeFrequency: 'monthly', priority: 0.8 },
    { url: `${BASE}/guides/laptop`, changeFrequency: 'monthly', priority: 0.8 },
    { url: `${BASE}/guides/mechanical-keyboard`, changeFrequency: 'monthly', priority: 0.8 },
    { url: `${BASE}/about`, changeFrequency: 'monthly', priority: 0.5 },
    { url: `${BASE}/disclosure`, changeFrequency: 'monthly', priority: 0.5 },
    { url: `${BASE}/privacy`, changeFrequency: 'monthly', priority: 0.4 },
    { url: `${BASE}/terms`, changeFrequency: 'monthly', priority: 0.4 },
    { url: `${BASE}/cookies`, changeFrequency: 'monthly', priority: 0.3 },
    { url: `${BASE}/contact`, changeFrequency: 'monthly', priority: 0.6 },
    { url: `${BASE}/faq`, changeFrequency: 'monthly', priority: 0.8 },
  ];
}
