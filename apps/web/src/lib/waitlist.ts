// Waitlist persistence — provider-adapter pattern (ADR-0010: every provider is
// adapter-wrapped; no provider lock-in). The concrete driver is selected from the
// environment at runtime, so swapping the store/ESP never touches the route.
//
// Drivers:
//   • default (no env)      → MemoryWaitlistStore  (dev/scaffold; per-process, non-durable)
//   • WAITLIST_ESP_URL set  → HttpEspWaitlistStore (POST to a Mailchimp/ConvertKit-style webhook)
// A real DB driver (e.g. Postgres) implements the same WaitlistStore interface.

export type WaitlistEntry = {
  email: string;
  source: string;
  createdAt: string; // ISO-8601
};

export type AddResult = { status: 'added' | 'duplicate' };

export interface WaitlistStore {
  add(entry: WaitlistEntry): Promise<AddResult>;
}

/** Default driver — in-process, non-durable, dedups by lowercased email. */
class MemoryWaitlistStore implements WaitlistStore {
  private readonly seen = new Set<string>();

  add(entry: WaitlistEntry): Promise<AddResult> {
    const key = entry.email.toLowerCase();
    if (this.seen.has(key)) return Promise.resolve({ status: 'duplicate' });
    this.seen.add(key);
    return Promise.resolve({ status: 'added' });
  }
}

/** ESP driver — forwards the entry to an email-service-provider webhook. */
class HttpEspWaitlistStore implements WaitlistStore {
  constructor(
    private readonly url: string,
    private readonly token: string | undefined,
  ) {}

  async add(entry: WaitlistEntry): Promise<AddResult> {
    const res = await fetch(this.url, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...(this.token ? { authorization: `Bearer ${this.token}` } : {}),
      },
      body: JSON.stringify(entry),
    });
    if (!res.ok) throw new Error(`Waitlist ESP responded ${res.status}`);
    // ESPs own their own dedup; treat any 2xx as accepted.
    return { status: 'added' };
  }
}

let store: WaitlistStore | null = null;

/** Lazily build (and cache) the configured store. */
export function getWaitlistStore(): WaitlistStore {
  if (store) return store;
  const espUrl = process.env.WAITLIST_ESP_URL;
  store = espUrl
    ? new HttpEspWaitlistStore(espUrl, process.env.WAITLIST_ESP_TOKEN)
    : new MemoryWaitlistStore();
  return store;
}
