/*
 * Shared shell for the legal pages.
 *
 * PLACEHOLDERS ARE DELIBERATE AND LOUD. Operator legal name, mailing address,
 * contact address, email provider, governing law and hosting provider are facts
 * only the owner has. Inventing them
 * would be worse than leaving them blank: a privacy notice naming the wrong
 * controller is not a smaller problem than one naming none, and a plausible
 * fake address is the kind of thing nobody notices before launch. So every
 * unknown is a bracketed upper-case token that renders visibly, and
 * `scripts/release-gate.mjs` refuses a release while one is still present — the
 * pages cannot ship half-filled by accident.
 *
 * All of them are now confirmed EXCEPT `contact`, which stays blank until mail
 * to the address has actually been received. Publishing a contact address that
 * silently bounces is worse than publishing none: the privacy notice promises a
 * reply within 30 days on it.
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
  /*
   * Supplied by the owner. Rendered in postal order, smallest unit first.
   *
   * This is a building at a public institution, not a registered office --
   * there is no registered office, because there is no company. The owner has
   * now given it twice, including the building, having been asked to confirm
   * they can receive post addressed to HonestTotal here.
   *
   * It must match the physical address in the Loops email footer, which is a
   * separate anti-spam requirement on every message sent. If one is corrected,
   * correct the other.
   */
  address: 'Self Help Building, Rural Development Academy, Sherpur, Bogura, Bangladesh',
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
  /*
   * CONFIRMED by the owner, not inferred. This was deliberately left blank
   * while unknown: governing law cannot be deduced from where the visitors are
   * or from the operator's mailing address, and guessing it would have made the
   * one sentence in the Terms that decides which law applies a fabrication.
   *
   * The clause in `terms/page.tsx` is the owner's own wording and is expressly
   * WITHOUT PREJUDICE to mandatory consumer-protection and privacy rights
   * elsewhere. Choosing Bangladesh law does not, and must not be written to,
   * strip a reader in the UK or the EU of rights they cannot contract away --
   * which is why the old "and its courts have jurisdiction" was removed rather
   * than kept alongside it.
   */
  jurisdiction: 'Bangladesh',
  /*
   * MEASURED and now CONFIRMED by an owner decision: the site stays on the
   * Cloudflare Worker and the Vercel migration is postponed.
   *
   * This page used to state flatly that the site is "served by Vercel". That
   * was false: honesttotal.com is served by a Cloudflare Worker, confirmed by
   * `Server: cloudflare` with no `x-vercel-id` on any path. Naming the wrong
   * company as the one handling every visitor's IP address is exactly the kind
   * of error a privacy notice exists to avoid, so it was gated rather than
   * guessed until the hosting decision was actually made.
   *
   * IF THE HOSTING EVER CHANGES, THIS SENTENCE BECOMES FALSE THE SAME DAY:
   *   Vercel, DNS-only           -> "Vercel"
   *   Vercel behind Cloudflare   -> BOTH process every request, and BOTH must
   *                                 be named here. A proxy does not replace a
   *                                 processor, it adds one.
   */
  host: 'Cloudflare',
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
