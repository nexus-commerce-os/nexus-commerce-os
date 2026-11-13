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

type WaitlistBody = { email?: unknown };

export async function POST(request: Request): Promise<NextResponse> {
  let body: WaitlistBody;
  try {
    body = (await request.json()) as WaitlistBody;
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid request body.' }, { status: 400 });
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
