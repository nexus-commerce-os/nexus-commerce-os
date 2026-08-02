// Cloudflare Worker that serves honesttotal.com.
//
// It does two things and nothing else:
//   1. POST /api/waitlist  — validate an email server-side and persist it to KV
//   2. everything else     — hand off to the static assets built by `next build`
//
// WHY A WORKER RATHER THAN A PURE STATIC SITE
// The marketing page posts to /api/waitlist. Under `output: 'export'` Next has
// no server to answer that, so the route lives here instead. The client calls
// the same same-origin path it always did, so no browser code changed.
//
// WHY KV RATHER THAN THE SCAFFOLD'S STORE
// The P0.1 scaffold kept addresses in process memory, which is right for a
// scaffold and wrong in production: every isolate restart would silently drop
// them while the page still told the visitor "You're on the list." Telling
// someone they are on a list that does not exist is not a bug we are willing to
// ship on a site whose entire claim is honesty. That module had no other
// consumer once the Next route moved here, so it was removed rather than left
// as dead code; an ESP driver, if wanted later, implements WaitlistStore here.

import {
  EMAIL_RE,
  type AddResult,
  type WaitlistEntry,
  type WaitlistStore,
} from '../src/lib/waitlist-contract';

export interface Env {
  ASSETS: Fetcher;
  WAITLIST: KVNamespace;
}

/**
 * KV-backed driver — same `WaitlistStore` interface as every other driver
 * (ADR-0010: providers are adapter-wrapped, so swapping the store never
 * reaches the caller).
 *
 * Dedup is a read-then-write, and KV is eventually consistent, so two requests
 * racing on the same address can both be recorded. That is the right trade
 * here: a duplicate row is harmless and fixable downstream, whereas the
 * alternatives (a lock, or a strongly-consistent store) would cost real
 * latency to prevent a cosmetic problem.
 */
class KvWaitlistStore implements WaitlistStore {
  constructor(private readonly kv: KVNamespace) {}

  async add(entry: WaitlistEntry): Promise<AddResult> {
    const key = `email:${entry.email.toLowerCase()}`;
    if ((await this.kv.get(key)) !== null) return { status: 'duplicate' };
    await this.kv.put(key, JSON.stringify(entry));
    return { status: 'added' };
  }
}

const json = (body: unknown, status: number): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  });

async function handleWaitlist(request: Request, env: Env): Promise<Response> {
  if (request.method !== 'POST') {
    return json({ ok: false, error: 'Method not allowed — use POST.' }, 405);
  }

  let body: { email?: unknown };
  try {
    body = (await request.json()) as { email?: unknown };
  } catch {
    return json({ ok: false, error: 'Invalid request body.' }, 400);
  }

  // Re-validated here even though the form validates too: the browser check is
  // a courtesy to the visitor, not a control. Anything can post to this path.
  const email = typeof body.email === 'string' ? body.email.trim() : '';
  if (!EMAIL_RE.test(email)) {
    return json({ ok: false, error: 'Please enter a valid email address.' }, 422);
  }

  try {
    const result = await new KvWaitlistStore(env.WAITLIST).add({
      email,
      source: 'web',
      createdAt: new Date().toISOString(),
    });
    return json(
      {
        ok: true,
        status: result.status,
        message:
          result.status === 'duplicate' ? "You're already on the list." : "You're on the list.",
      },
      200,
    );
  } catch {
    // The address is deliberately absent from this response and from any log
    // line: a failed write must not turn into a PII leak.
    return json({ ok: false, error: 'Could not save right now — please try again.' }, 502);
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const { pathname } = new URL(request.url);

    // TEMPORARY, paired with run_worker_first in wrangler.toml: records who
    // fetches the homepage so an external verifier's request can be told apart
    // from "no request ever arrived". Method, path and user-agent only — no
    // addresses, no headers that could carry personal data. Remove once the
    // Impact property is verified.
    if (pathname === '/') {
      console.log(
        `page-fetch ${request.method} ${pathname} ua=${request.headers.get('user-agent') ?? 'none'}`,
      );
    }

    if (pathname === '/api/waitlist') return handleWaitlist(request, env);
    return env.ASSETS.fetch(request);
  },
};
