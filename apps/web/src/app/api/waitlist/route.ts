import { NextResponse } from "next/server";
import { getWaitlistStore } from "@/lib/waitlist";

// Server-side waitlist endpoint. The client posts { email }; we validate on the
// server (never trust the client) and persist via the configured store adapter
// (ADR-0010 — every provider adapter-wrapped; see src/lib/waitlist.ts). No PII is
// logged here; the driver decides durability (memory by default, ESP when set).

/*
 * Address check. Two properties matter here, and the second one is a security
 * property, not a validation one.
 *
 * 1. The domain is one or more DOT-FREE labels separated by dots. The previous
 *    form was `/^[^@\s]+@[^@\s]+\.[^@\s]+$/`, whose last two quantifiers both
 *    accepted `.` — so on a string that FAILS to match, the engine retried
 *    every split point between them. CodeQL reported it as js/polynomial-redos
 *    (high) and the measurement agrees: with a body of `a@` + `"."*n` + `@`,
 *    which cannot match, this endpoint spent
 *
 *        n = 10,000  ->   116 ms      n = 40,000  ->  1,855 ms
 *        n = 20,000  ->   462 ms      n = 60,000  ->  4,167 ms
 *
 *    of BLOCKED EVENT LOOP per request — quadratic, unauthenticated, and from
 *    a 60KB POST body. A handful of concurrent requests stalls the server.
 *    Forbidding `.` inside a label makes every split deterministic: the same
 *    inputs now take 0.019 ms at n = 60,000 and 0.102 ms at n = 200,000.
 *
 *    It accepts no string the old form rejected. Compared exhaustively over
 *    597,890 inputs (every string up to length 6 over `a b @ . - _ + space
 *    tab`, plus named realistic shapes), the ONLY differences are addresses
 *    the old form wrongly accepted because a DOMAIN LABEL COULD BE EMPTY: it
 *    let `.` into the label itself, so `user@example..com` and
 *    `user@.example.com` both matched. Those are invalid and are now refused.
 *    (`user@example.` was already refused by both — a trailing dot leaves
 *    nothing for the final quantifier, so it is not one of the differences.)
 *    No valid address changes behaviour.
 *
 * 2. The length cap comes FIRST, and is the reason the regex's cost can never
 *    matter again. RFC 5321 §4.5.3.1 bounds a path at 254 octets; the old code
 *    had no cap at all and would happily accept — and store — a 15,000-
 *    character address. Rejecting on length before matching bounds the work
 *    regardless of what the pattern does, which is the defence that survives
 *    the next person editing the pattern.
 */
const MAX_EMAIL_LENGTH = 254;
const EMAIL_RE = /^[^@\s]+@[^@\s.]+(?:\.[^@\s.]+)+$/;

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
  if (email.length > MAX_EMAIL_LENGTH || !EMAIL_RE.test(email)) {
    return NextResponse.json(
      { ok: false, error: "Please enter a valid email address." },
      { status: 422 },
    );
  }

  try {
    const result = await getWaitlistStore().add({
      email,
      source: "web",
      createdAt: new Date().toISOString(),
    });
    return NextResponse.json(
      {
        ok: true,
        status: result.status,
        message:
          result.status === "duplicate"
            ? "You're already on the list."
            : "You're on the list.",
      },
      { status: 200 },
    );
  } catch {
    return NextResponse.json(
      { ok: false, error: "Could not save right now — please try again." },
      { status: 502 },
    );
  }
}

export function GET(): NextResponse {
  return NextResponse.json(
    { ok: false, error: "Method not allowed — use POST." },
    { status: 405 },
  );
}
