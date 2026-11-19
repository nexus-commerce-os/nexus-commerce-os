/*
 * Shared shell for the legal pages.
 *
 * PLACEHOLDERS ARE DELIBERATE AND LOUD. Operator legal name, address, contact
 * address and the email provider are facts only the owner has. Inventing them
 * would be worse than leaving them blank: a privacy notice naming the wrong
 * controller is not a smaller problem than one naming none, and a plausible
 * fake address is the kind of thing nobody notices before launch. So every
 * unknown is a bracketed upper-case token that renders visibly, and
 * `test/legal.test.mjs` fails the build if one of them is still present — the
 * page cannot ship half-filled by accident.
 */
import React from 'react';
import type { ReactNode } from 'react';

/**
 * The facts the pages need. A bracketed upper-case token is one the owner has
 * not supplied yet; `scripts/release-gate.mjs` scans for exactly that shape and
 * fails a production build while any remain.
 *
 * HonestTotal is run by an INDIVIDUAL, not a registered company. So there is no
 * registered office and no company number, and nothing here may imply one.
 * `address` is deliberately not called a registered address.
 */
export const PLACEHOLDERS = {
  /*
   * CONFIRMED by the owner against official identification: no full stop after
   * Md, and Sam rather than Sham. This is also the spelling the Loops account
   * and the contact address already use, so all three now agree.
   *
   * The identification itself is not recorded anywhere in this repository, and
   * must not be -- the pages need the name, nothing else.
   *
   * HonestTotal is the public brand. This is the individual behind it.
   */
  operator: 'Md Samsuzzaman',
  address: '[OPERATOR ADDRESS]',
  contact: '[CONTACT EMAIL ADDRESS]',
  /*
   * Resolved from the provider's own documentation, not inferred: the
   * subprocessor page states "All subprocessors below process data in the
   * United States, for the duration of the contract", and the legal entity
   * behind Loops is Astrodon Corporation. This is the provider actually
   * configured in Vercel and verified against the live API.
   */
  esp: 'Loops (Astrodon Corporation)',
  espCountry: 'the United States',
  jurisdiction: '[GOVERNING JURISDICTION]',
  /*
   * MEASURED, and currently unanswerable, which is why it is a placeholder.
   *
   * This page used to state flatly that the site is "served by Vercel". That
   * was false: honesttotal.com is served by a Cloudflare Worker, confirmed by
   * `Server: cloudflare` with no `x-vercel-id` on any path. Naming the wrong
   * company as the one handling every visitor's IP address is exactly the kind
   * of error a privacy notice exists to avoid.
   *
   * The true answer depends on a hosting decision that has not been made:
   *   Cloudflare Worker (today)    -> "Cloudflare"
   *   Vercel, DNS-only             -> "Vercel"
   *   Vercel behind Cloudflare     -> BOTH process the request, and both must
   *                                   be named here.
   *
   * So it is gated rather than guessed. The gate now blocks on it.
   */
  host: '[HOSTING PROVIDER]',
} as const;

export function LegalPage({
  title,
  updated,
  children,
}: {
  title: string;
  updated: string;
  children: ReactNode;
}) {
  return (
    <main className="wrap" style={{ maxWidth: '46rem', padding: '3rem 1rem 5rem' }}>
      <p style={{ margin: '0 0 0.5rem' }}>
        <a href="/">← HonestTotal</a>
      </p>
      <h1 style={{ margin: '0 0 0.25rem' }}>{title}</h1>
      <p style={{ margin: '0 0 2rem', opacity: 0.7, fontSize: '0.9rem' }}>Last updated {updated}</p>
      <div style={{ lineHeight: 1.7 }}>{children}</div>
    </main>
  );
}
