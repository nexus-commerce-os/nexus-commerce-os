import { NextResponse } from "next/server";

// A concrete, server-side waitlist endpoint. The client posts { email }; we
// validate on the server (never trust the client) and acknowledge.
//
// P0.2 TODO: persist to the waitlist store / email-service-provider behind an
// adapter (ADR-0010 — every provider adapter-wrapped). For the P0.1 scaffold we
// validate + accept; no PII is logged and no third-party call is made.

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

type WaitlistBody = { email?: unknown };

export async function POST(request: Request): Promise<NextResponse> {
  let body: WaitlistBody;
  try {
    body = (await request.json()) as WaitlistBody;
  } catch {
    return NextResponse.json(
      { ok: false, error: "Invalid request body." },
      { status: 400 },
    );
  }

  const email = typeof body.email === "string" ? body.email.trim() : "";
  if (!EMAIL_RE.test(email)) {
    return NextResponse.json(
      { ok: false, error: "Please enter a valid email address." },
      { status: 422 },
    );
  }

  // (persistence intentionally deferred — see file header)
  return NextResponse.json(
    { ok: true, message: "You're on the list." },
    { status: 200 },
  );
}

export function GET(): NextResponse {
  return NextResponse.json(
    { ok: false, error: "Method not allowed — use POST." },
    { status: 405 },
  );
}
