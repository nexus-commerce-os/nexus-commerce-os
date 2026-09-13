// Waitlist contract — the parts shared by the browser build and the Cloudflare
// Worker that serves the site.
//
// This module deliberately touches NO runtime environment: no `process.env`, no
// `fetch`, no platform globals. That is what lets the Worker (typed against
// @cloudflare/workers-types) and the Next app (typed against DOM + Node) import
// the same validation rule instead of each keeping its own copy. Two copies of
// an email regex drift, and the drift shows up as a form that accepts an
// address the server then rejects.

export type WaitlistEntry = {
  email: string;
  source: string;
  createdAt: string; // ISO-8601
};

export type AddResult = { status: 'added' | 'duplicate' };

export interface WaitlistStore {
  add(entry: WaitlistEntry): Promise<AddResult>;
}

/**
 * Deliberately permissive: one `@`, a dot in the domain, no whitespace.
 *
 * Stricter client-side email validation rejects addresses that are genuinely
 * valid (plus-addressing, new TLDs, quoted locals), and the only authoritative
 * check is sending mail to it anyway.
 */
export const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
