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

export type AddResult = { status: 'added' | 'duplicate' };

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
    if (!res.ok) throw new Error(`Waitlist ESP responded ${res.status}`);
    // ESPs own their own dedup; treat any 2xx as accepted.
    return { status: 'added' };
  }
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
