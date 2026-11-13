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

/** Every fact the owner must supply before these pages may go live. */
export const PLACEHOLDERS = {
  operator: '[OPERATOR LEGAL NAME]',
  address: '[OPERATOR REGISTERED ADDRESS]',
  contact: '[CONTACT EMAIL ADDRESS]',
  esp: '[EMAIL SERVICE PROVIDER NAME]',
  espCountry: '[EMAIL PROVIDER HOSTING COUNTRY/REGION]',
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
