import { NextResponse } from 'next/server';
import { getWaitlistStore } from '@/lib/waitlist';
// why one module and not a literal here: the landing page needs the SAME check,
// and the duplicate copy is how the ReDoS survived in one of the two places.
import { isValidEmail } from '@/lib/email';

// Server-side waitlist endpoint. The client posts { email }; we validate on the
// server (never trust the client) and persist via the configured store adapter
// (ADR-0010 — every provider adapter-wrapped; see src/lib/waitlist.ts). No PII is
// logged here; durability is the store's concern, and in production the store
// REFUSES to be non-durable (see lib/waitlist.ts).

/*
 * `company` is the honeypot. The form renders it hidden from sight and from
 * assistive tech, so a person never fills it; a bot that scrapes the form and
 * submits every field it finds does. It is checked and DISCARDED here — never
 * stored, never logged, never forwarded to the provider — so catching a bot
 * collects no extra data about anyone.
 */
type WaitlistBody = { email?: unknown; company?: unknown };

export async function POST(request: Request): Promise<NextResponse> {
  let body: WaitlistBody;
  try {
    body = (await request.json()) as WaitlistBody;
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid request body.' }, { status: 400 });
  }

  /*
   * Checked FIRST, and answered with the ordinary success shape.
   *
   * A distinct error would tell whoever is probing exactly which field to stop
   * sending; an indistinguishable 200 teaches them nothing and costs a real
   * visitor nothing, because a real visitor cannot reach this branch. Nothing
   * is stored and the provider is never called.
   *
   * The page performs the same check before it POSTs, which saves a request.
   * THIS one is the defence: the client-side check is trivially bypassed by
   * posting straight to this route, which was verified by doing exactly that
   * and watching a bot's address reach the provider.
   */
  if (typeof body.company === 'string' && body.company.trim() !== '') {
    return NextResponse.json(
      { ok: true, status: 'added', message: "You're on the list." },
      { status: 200 },
    );
  }

  const email = typeof body.email === 'string' ? body.email.trim() : '';
  if (!isValidEmail(email)) {
    return NextResponse.json(
      { ok: false, error: 'Please enter a valid email address.' },
      { status: 422 },
    );
  }

  try {
    const result = await getWaitlistStore().add({
      email,
      source: 'web',
      createdAt: new Date().toISOString(),
    });
    return NextResponse.json(
      {
        ok: true,
        status: result.status,
        message:
          result.status === 'duplicate' ? "You're already on the list." : "You're on the list.",
      },
      { status: 200 },
    );
  } catch {
    return NextResponse.json(
      { ok: false, error: 'Could not save right now — please try again.' },
      { status: 502 },
    );
  }
}

export function GET(): NextResponse {
  return NextResponse.json({ ok: false, error: 'Method not allowed — use POST.' }, { status: 405 });
}
