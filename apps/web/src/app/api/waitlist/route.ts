import { NextResponse } from "next/server";
import { getWaitlistStore } from "@/lib/waitlist";

// Server-side waitlist endpoint. The client posts { email }; we validate on the
// server (never trust the client) and persist via the configured store adapter
// (ADR-0010 — every provider adapter-wrapped; see src/lib/waitlist.ts). No PII is
// logged here; the driver decides durability (memory by default, ESP when set).

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
