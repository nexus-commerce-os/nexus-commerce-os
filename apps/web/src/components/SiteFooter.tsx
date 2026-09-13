import type { ReactNode } from 'react';
import { Footer } from '@nexus/ui';

/*
 * The one footer every public page renders.
 *
 * WHY THIS EXISTS. Before this component, only the home page carried a linked
 * footer; the other sixteen pages had hand-written <footer> markup containing a
 * copyright line and nothing else. From a buying guide — the page that will
 * eventually carry affiliate links — a visitor could not reach /disclosure,
 * /privacy, /terms, /cookies, /contact or /faq at all without going back to the
 * home page first. That is a navigation defect and, for an affiliate reviewer,
 * a disclosure-visibility one.
 *
 * The link set is defined once, here. Pages pass only `note` — the short line
 * that says what is true of that page — so a page cannot accidentally ship with
 * a partial legal nav. `scripts/verify-footer.mjs` fails the build if any
 * generated page is missing one of the required links.
 */

/** Links every public page must expose, checked by scripts/verify-footer.mjs. */
export const REQUIRED_FOOTER_LINKS = [
  '/disclosure',
  '/privacy',
  '/terms',
  '/cookies',
  '/contact',
  '/about',
  '/how-we-rank',
  '/commission-blind',
] as const;

const COLUMNS = [
  {
    heading: 'Product',
    links: [
      { label: 'How it works', href: '/#how' },
      { label: 'How we rank', href: '/how-we-rank' },
      { label: 'Commission-blind', href: '/commission-blind' },
      { label: 'Verified savings', href: '/verified-savings' },
      { label: 'For developers', href: '/#agent' },
    ],
  },
  {
    heading: 'Buying guides',
    links: [
      { label: 'Over-ear headphones', href: '/guides/over-ear-headphones' },
      { label: 'How ANC works', href: '/guides/how-anc-works' },
      { label: 'OLED TVs', href: '/guides/oled-tv' },
      { label: 'SSDs', href: '/guides/ssd' },
      { label: 'Laptops', href: '/guides/laptop' },
      { label: 'Mechanical keyboards', href: '/guides/mechanical-keyboard' },
    ],
  },
  {
    heading: 'Company',
    links: [
      { label: 'About', href: '/about' },
      { label: 'Contact', href: '/contact' },
      { label: 'FAQ', href: '/faq' },
      { label: 'Join the waitlist', href: '/#cta' },
    ],
  },
  {
    heading: 'Legal',
    links: [
      { label: 'Affiliate disclosure', href: '/disclosure' },
      { label: 'Privacy', href: '/privacy' },
      { label: 'Terms', href: '/terms' },
      { label: 'Cookies', href: '/cookies' },
    ],
  },
];

export type SiteFooterProps = {
  /** The short line at the bottom right, stating what is true of this page. */
  note: ReactNode;
};

export function SiteFooter({ note }: SiteFooterProps) {
  return (
    <Footer
      note={
        <>
          A pure referral and affiliate intelligence layer. Codename NEXUS — the internal
          architecture name; HonestTotal is the public brand. Illustrative figures shown.
        </>
      }
      columns={COLUMNS}
      bottomLeft="© 2026 HonestTotal"
      bottomRight={note}
    />
  );
}
