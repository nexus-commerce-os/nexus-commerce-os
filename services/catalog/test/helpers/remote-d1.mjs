/*
 * A `D1Like` backed by the REAL Cloudflare D1 HTTP API, so the contract the
 * adapter was written against can be checked against the actual platform
 * rather than against SQLite's imitation of it.
 *
 * WHY THIS EXISTS ALONGSIDE sqlite-d1.mjs. The SQLite harness is fast, free
 * and runs on every push, but its header already admits three things it cannot
 * prove: D1's network behaviour, whether `batch()` rolls back the way SQLite
 * does, and the 100-bound-parameter limit that SQLite does not enforce. This
 * harness answers those by asking Cloudflare.
 *
 * ONE HONEST DIVERGENCE, STATED UP FRONT. The D1 HTTP API refuses bound
 * parameters when a request carries multiple statements —
 *
 *     {"code":7400,"message":"The request is malformed: params with multiple
 *      statements is not supported"}
 *
 * — measured, not assumed. So `batch()` here CANNOT be the single atomic
 * request that a Worker's D1 binding gives it; it is a sequence of separate
 * requests, and a failure part-way through leaves the earlier ones committed.
 *
 * That makes this transport STRICTLY WEAKER than production, which is the only
 * reason it is acceptable: a contract that holds under a non-atomic batch also
 * holds under an atomic one. The reverse would not be true, and a harness that
 * quietly provided atomicity the real binding lacked would be the dangerous
 * direction. Real `batch()` atomicity is exercised from inside a Worker
 * instead — see docs/engineering/d1-database.md.
 */

const API = 'https://api.cloudflare.com/client/v4';

export class D1HttpError extends Error {
  constructor(status, errors, sql) {
    const first = errors?.[0];
    super(first ? `${first.message} (code ${first.code})` : `D1 HTTP ${status}`);
    this.name = 'D1HttpError';
    this.status = status;
    this.errors = errors ?? [];
    this.code = first?.code;
    // The statement, NOT the bindings: a binding can be a merchant price or a
    // credential, and an error message is the easiest place to leak one.
    this.sql = sql;
  }
}

/** Reads the credentials for the opt-in integration run, or returns null. */
export function remoteD1Config(env = process.env) {
  const accountId = env.HONESTTOTAL_D1_ACCOUNT_ID;
  const apiToken = env.HONESTTOTAL_D1_API_TOKEN;
  if (!accountId || !apiToken) return null;
  return { accountId, apiToken, databaseId: env.HONESTTOTAL_D1_DATABASE_ID };
}

async function request(config, path, init = {}) {
  const res = await fetch(`${API}/accounts/${config.accountId}${path}`, {
    ...init,
    headers: {
      authorization: `Bearer ${config.apiToken}`,
      'content-type': 'application/json',
      ...(init.headers ?? {}),
    },
  });
  const body = await res.json().catch(() => ({ success: false, errors: [] }));
  return { status: res.status, body };
}

/**
 * Creates a THROWAWAY database for one test run. Isolation by namespacing
 * inside a shared database would leave every test one forgotten WHERE clause
 * away from reading another's rows; a separate database cannot.
 */
export async function createThrowawayDatabase(config, name) {
  const { status, body } = await request(config, '/d1/database', {
    method: 'POST',
    body: JSON.stringify({ name }),
  });
  if (!body.success) throw new D1HttpError(status, body.errors, 'CREATE DATABASE');
  return body.result.uuid;
}

export async function deleteDatabase(config, databaseId) {
  const { status, body } = await request(config, `/d1/database/${databaseId}`, {
    method: 'DELETE',
  });
  if (!body.success) throw new D1HttpError(status, body.errors, 'DROP DATABASE');
}

/** Totals from `meta`, which is how the write budget in d1-database.md is set. */
export class UsageMeter {
  rowsRead = 0;
  rowsWritten = 0;
  requests = 0;

  record(meta) {
    this.requests += 1;
    this.rowsRead += Number(meta?.rows_read ?? 0);
    this.rowsWritten += Number(meta?.rows_written ?? 0);
  }
}

export function createRemoteD1(config, databaseId, meter = new UsageMeter()) {
  const path = `/d1/database/${databaseId}/query`;

  const send = async (sql, params) => {
    const { status, body } = await request(config, path, {
      method: 'POST',
      body: JSON.stringify(params === undefined ? { sql } : { sql, params }),
    });
    if (!body.success) throw new D1HttpError(status, body.errors, sql);
    const one = body.result?.[0] ?? {};
    meter.record(one.meta);
    return { results: one.results ?? [], success: true, meta: one.meta ?? {} };
  };

  const statement = (sql, bound) => ({
    bind(...values) {
      return statement(sql, values);
    },
    all() {
      return send(sql, bound ?? []);
    },
    run() {
      return send(sql, bound ?? []);
    },
    async first() {
      const out = await send(sql, bound ?? []);
      return out.results[0] ?? null;
    },
    // Used by batch() below, which cannot combine statements into one request.
    __send: () => send(sql, bound ?? []),
  });

  return {
    meter,
    databaseId,
    prepare: (sql) => statement(sql, undefined),
    async batch(statements) {
      // See the header: sequential, not atomic. Deliberately weaker than the
      // Workers binding rather than pretending to match it.
      const out = [];
      for (const s of statements) out.push(await s.__send());
      return out;
    },
    async exec(sql) {
      // Multiple statements, no bindings — the one shape the HTTP API accepts
      // as a unit, and measurably atomic. Used for schema setup.
      return send(sql, undefined);
    },
  };
}
