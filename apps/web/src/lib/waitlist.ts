// Waitlist persistence — provider-adapter pattern (ADR-0010: every provider is
// adapter-wrapped; no provider lock-in). The concrete driver is selected from the
// environment at runtime, so swapping the store/ESP never touches the route.
//
// Drivers:
//   • WAITLIST_ESP_URL set  → HttpEspWaitlistStore (POST to a Mailchimp/ConvertKit-style webhook)
//   • otherwise, non-prod   → MemoryWaitlistStore  (dev only; per-process, non-durable)
//   • otherwise, PRODUCTION → refuses to start. See WHY FAIL CLOSED below.
// A real DB driver (e.g. Postgres) implements the same WaitlistStore interface.
//
// ──── WHY FAIL CLOSED ───────────────────────────────────────────────────────
//
// The memory driver is a dev convenience, and as a production default it is the
// worst possible failure mode: every sign-up returns 200, the visitor is
// thanked, the page promises "one email the moment we open in your region" —
// and the address is gone at the next cold start. Nothing errors, nothing is
// logged, no dashboard turns red. A launch could run for weeks and lose every
// lead before anyone noticed.
//
// So in production an unconfigured store is a BOOT ERROR, not a silent
// downgrade. A site that refuses to serve is recoverable in minutes; a list of
// customers that was never written is not recoverable at all.

export type WaitlistEntry = {
  email: string;
  source: string;
  createdAt: string; // ISO-8601
};

/*
 * `pending` exists because a provider may accept an address WITHOUT it being
 * subscribed yet — double opt-in, where the person must still click a link in
 * a confirmation email. Telling that person "You're on the list" is false, and
 * if they never confirm they silently miss the launch email.
 *
 * Loops' double opt-in is ON for this account, and MEASURED not to gate the
 * create API today: a contact posted to /contacts/create comes back
 * `subscribed: true, optInStatus: null`. Their docs say that will change --
 * "API endpoints like Create contact and Update contact are not yet gated.
 * Coverage will expand to these endpoints soon." -- with no date and no
 * promise of notice. So this is DETECTED per response, never assumed from a
 * dashboard setting, in either direction.
 */
export type AddResult = { status: 'added' | 'duplicate' | 'pending' };

export interface WaitlistStore {
  add(entry: WaitlistEntry): Promise<AddResult>;
}

/** Thrown when production has no durable destination configured. */
export class WaitlistNotConfiguredError extends Error {
  readonly _tag = 'WaitlistNotConfiguredError';
  constructor() {
    super(
      'WAITLIST_ESP_URL is not set. The in-memory waitlist store is for ' +
        'development only: in production it would accept sign-ups, thank the ' +
        'visitor, and lose the address at the next cold start. Set ' +
        'WAITLIST_ESP_URL (and WAITLIST_ESP_TOKEN if the provider needs one) ' +
        'to a durable destination.',
    );
    this.name = 'WaitlistNotConfiguredError';
  }
}

/** Dev-only driver — in-process, non-durable, dedups by lowercased email. */
class MemoryWaitlistStore implements WaitlistStore {
  private readonly seen = new Set<string>();

  add(entry: WaitlistEntry): Promise<AddResult> {
    const key = entry.email.toLowerCase();
    if (this.seen.has(key)) return Promise.resolve({ status: 'duplicate' });
    this.seen.add(key);
    return Promise.resolve({ status: 'added' });
  }
}

/**
 * How long to wait for the ESP before giving up.
 *
 * Without a deadline a hung provider holds the serverless invocation until the
 * platform's own timeout, which burns the function budget and leaves the
 * visitor watching a spinner. Five seconds is far above a healthy webhook and
 * far below any platform limit, so a slow provider becomes a fast, honest 502
 * the visitor can retry.
 */
export const ESP_TIMEOUT_MS = 5_000;

/** ESP driver — forwards the entry to an email-service-provider webhook. */
class HttpEspWaitlistStore implements WaitlistStore {
  constructor(
    private readonly url: string,
    private readonly token: string | undefined,
    private readonly timeoutMs: number = ESP_TIMEOUT_MS,
  ) {}

  async add(entry: WaitlistEntry): Promise<AddResult> {
    let res: Response;
    try {
      res = await fetch(this.url, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          ...(this.token ? { authorization: `Bearer ${this.token}` } : {}),
        },
        body: JSON.stringify(entry),
        signal: AbortSignal.timeout(this.timeoutMs),
      });
    } catch (cause) {
      // Deliberately NOT rethrown with `{ cause }`: a fetch failure's message
      // carries the request URL, and an ESP webhook URL is often itself the
      // secret. The timeout and the failure are reported; the URL never is.
      const timedOut =
        typeof cause === 'object' &&
        cause !== null &&
        (cause as { name?: string }).name === 'TimeoutError';
      throw new Error(
        timedOut
          ? `Waitlist ESP did not respond within ${this.timeoutMs}ms`
          : 'Waitlist ESP request failed',
      );
    }
    /*
     * A CONFLICT IS NOT A FAILURE — it is the most ordinary thing a waitlist
     * sees: somebody signing up twice.
     *
     * Checked against the providers' own documentation rather than assumed.
     * Loops answers a repeat address with `409 Email or userId already exists`;
     * Buttondown answers with 400 unless a collision header is sent. Treating
     * either as an error would hand a returning visitor a 502 and
     * "Could not save right now - please try again", which is both wrong and
     * the thing they are most likely to do.
     *
     * 409 is the status HTTP defines for exactly this, so it is mapped on
     * status alone, with no provider-specific parsing. `duplicate` is already a
     * value the route understands: it answers "You're already on the list."
     *
     * A provider that signals duplicates some other way (Buttondown's 400) is
     * NOT guessed at here — a 400 can equally mean a malformed address, and
     * quietly swallowing that would hide a real bug. Such a provider needs its
     * own adapter.
     */
    if (res.status === 409) return { status: 'duplicate' };
    if (!res.ok) throw new Error(`Waitlist ESP responded ${res.status}`);

    /*
     * 202 Accepted is what HTTP already means by "taken, not yet complete", so
     * it is mapped on status alone -- no provider-specific parsing, same rule
     * as the 409 above.
     */
    if (res.status === 202) return { status: 'pending' };

    /*
     * Otherwise look for an opt-in signal in the body, but only if one is
     * actually there. This is deliberately a READ of fields that may or may
     * not exist, not a requirement that they do: today Loops returns a bare
     * `{success, id}` and this finds nothing, so behaviour is unchanged. If a
     * provider starts reporting an unconfirmed contact, the visitor is told
     * the truth without waiting for us to ship a fix.
     *
     * Parsing is best-effort: a non-JSON or unreadable body must never turn a
     * successful sign-up into an error, because the address IS already stored
     * by this point.
     */
    const signal = await readOptInSignal(res);
    if (signal === 'pending') return { status: 'pending' };

    // Any other 2xx is an accepted sign-up; the provider owns its own dedup.
    return { status: 'added' };
  }
}

/**
 * Best-effort: does this response say the contact is accepted but NOT yet
 * subscribed? Returns 'pending', or null when the body says nothing about it.
 *
 * `optInStatus` and `subscribed` are the two shapes an ESP realistically uses,
 * and both are read defensively -- absent, null, or an unexpected type all mean
 * "no signal", never "pending". Erring towards `added` is correct: today no
 * provider we talk to gates the create call, and inventing a confirmation step
 * that does not exist would be its own lie.
 *
 * `subscribed: false` is the weaker of the two signals, because it could also
 * describe a contact who previously UNSUBSCRIBED rather than one who has yet
 * to confirm. It is still read, because on a CREATE response the unconfirmed
 * reading is far the likelier, and because the alternative -- "You're on the
 * list" to someone who is not on it -- is the worse of the two errors. With
 * Loops the ambiguity cannot arise: an address already in the audience comes
 * back 409 and is handled above as a duplicate, long before this runs.
 */
async function readOptInSignal(res: Response): Promise<'pending' | null> {
  let body: unknown;
  try {
    body = await res.clone().json();
  } catch {
    return null; // not JSON, or already consumed -- say nothing
  }
  if (typeof body !== 'object' || body === null) return null;
  const record = body as { optInStatus?: unknown; subscribed?: unknown };
  if (typeof record.optInStatus === 'string' && record.optInStatus.toLowerCase() === 'pending') {
    return 'pending';
  }
  if (record.subscribed === false) return 'pending';
  return null;
}

let store: WaitlistStore | null = null;

/**
 * Lazily build (and cache) the configured store.
 *
 * Throws {@link WaitlistNotConfiguredError} in production when no durable
 * destination is set. `NODE_ENV` is what Next sets for a production build, so
 * this is the same signal the framework itself already trusts.
 */
export function getWaitlistStore(): WaitlistStore {
  if (store) return store;
  const espUrl = process.env.WAITLIST_ESP_URL;
  if (espUrl) {
    store = new HttpEspWaitlistStore(espUrl, process.env.WAITLIST_ESP_TOKEN);
    return store;
  }
  if (process.env.NODE_ENV === 'production') {
    // Deliberately not cached: if the variable is supplied and the instance
    // recycles, the next boot should succeed rather than stay poisoned.
    throw new WaitlistNotConfiguredError();
  }
  store = new MemoryWaitlistStore();
  return store;
}

/** Test seam — drops the cached driver so a test can change the environment. */
export function resetWaitlistStoreForTests(): void {
  store = null;
}
