// The noindex header, and the one safe way to attach it to a Response.
//
// WHY THIS IS A SEPARATE MODULE AND NOT PART OF worker/preview.ts.
// The Workers runtime treats EVERY named export of a Worker's entry module as
// a Worker entrypoint. Exporting a plain string from the entrypoint fails the
// deploy at startup, not at build time:
//
//   Uncaught TypeError: Incorrect type for map entry 'ROBOTS_TAG':
//   the provided value is not of type 'function or ExportedHandler'.
//
// That is what happened when these two lived in preview.ts. `wrangler deploy
// --dry-run` does not catch it — the bundle compiles fine — so it was only
// caught by actually starting the runtime with `wrangler dev`. Keeping them
// here lets the entrypoint export nothing but `default`, and lets this logic
// still be imported and tested.

/** The directive, in one place, so tests and the Worker cannot disagree. */
export const ROBOTS_TAG = 'noindex, nofollow';

/**
 * Copy a response and add `X-Robots-Tag`.
 *
 * A Response returned by `env.ASSETS.fetch()` has immutable headers, so
 * `response.headers.set(...)` throws; rebuilding is the only reliable route.
 * Every response is rebuilt rather than only the HTML-looking ones, because a
 * rule with an exception list is a rule something eventually falls outside of
 * — and the responses most likely to be forgotten, sitemap.xml and the 404,
 * are exactly the ones that carry no `<meta>` tag to fall back on.
 *
 * The `null` body for 101/204/205/304 is required: the Response constructor
 * throws if a body is supplied with those statuses, and `env.ASSETS.fetch`
 * does return 304 when a conditional request matches.
 */
export function withNoindex(response: Response): Response {
  const headers = new Headers(response.headers);
  headers.set('X-Robots-Tag', ROBOTS_TAG);

  const { status } = response;
  const bodyless = status === 101 || status === 204 || status === 205 || status === 304;

  return new Response(bodyless ? null : response.body, {
    status,
    statusText: response.statusText,
    headers,
  });
}
