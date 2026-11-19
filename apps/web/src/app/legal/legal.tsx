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
   * PROVISIONAL. Supplied by the owner as the name to use, and still to be
   * checked character-for-character against official identification -- note
   * that the Loops account renders it 'Md Samsuzzaman' and the contact address
   * is samsuzzaman@, neither of which matches this spelling. A privacy notice
   * naming the controller inexactly is worth no more than one naming nobody,
   * so this must be confirmed before the pages publish.
   */
  operator: 'Md. Shamsuzzaman',
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
