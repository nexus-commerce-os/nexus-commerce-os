/*
 * The ONE email validator. Imported by the API route and by the landing page,
 * because two copies is how the bug below survived in one of them.
 *
 * ──── What this fixes ──────────────────────────────────────────────────────
 *
 * CodeQL alert #1, `js/polynomial-redos` (high), reported the pattern that used
 * to live in `app/api/waitlist/route.ts`:
 *
 *     /^[^@\s]+@[^@\s]+\.[^@\s]+$/
 *
 * Its last two quantifiers BOTH accept `.`, so on a string that fails to match
 * the engine retries every split point between them. The input is `email` from
 * an unauthenticated POST body, and there was no length cap. Measured, with a
 * body of `a@` + `"."*n` + `@`:
 *
 *     n =  10,000     116 ms        n =  40,000   1,855 ms
 *     n =  20,000     462 ms        n =  60,000   4,167 ms
 *     n = 200,000  45,862 ms
 *
 * Quadratic, and every millisecond is the event loop BLOCKED rather than
 * waiting. A handful of concurrent 60 KB posts takes the server down.
 *
 * The same pattern was also sitting in `app/page.tsx` as the client-side gate.
 * There it is not a server DoS — it burns the visitor's own CPU — but leaving
 * the two sides disagreeing is its own bug: the client would accept
 * `user@example..com`, the server would refuse it, and the visitor would get a
 * 422 with no way to understand why. Hence one module, two importers.
 *
 * ──── Why this pattern is linear ───────────────────────────────────────────
 *
 *     /^[^@\s]+@[^@\s.]+(?:\.[^@\s.]+)+$/
 *
 * The domain is one or more DOT-FREE labels separated by dots. Because a label
 * cannot contain `.`, every split point is forced and there is nothing to
 * backtrack over. The same inputs now take 0.019 ms at n = 60,000 and 0.102 ms
 * at n = 200,000. The worst hostile shape found — 100,000 alternating labels in
 * a 200 KB string — is 3.4 ms.
 *
 * It accepts NOTHING the old pattern rejected. Compared over 597,890 inputs
 * (every string up to length 6 over `a b @ . - _ + space tab`, plus named
 * realistic shapes), every difference is one-directional: the old form wrongly
 * accepted addresses with an EMPTY DOMAIN LABEL, because it let `.` into the
 * label itself.
 *
 *     user@example..com    accepted before, refused now
 *     user@.example.com    accepted before, refused now
 *
 * (`user@example.` was already refused by both — a trailing dot leaves nothing
 * for the final quantifier — so it is not one of the differences.) No valid
 * address changes behaviour.
 *
 * ──── Why the length cap comes FIRST ───────────────────────────────────────
 *
 * RFC 5321 §4.5.3.1 bounds a forward path at 254 octets. There was no cap at
 * all, so the endpoint would accept — and store — a 15,000-character address.
 * Checking length before the pattern bounds the work no matter what the
 * pattern later becomes, which is the defence that survives the next person
 * editing it. `scripts/verify-email-regex.mjs` asserts that order explicitly.
 */

/** RFC 5321 §4.5.3.1 — the maximum length of a forward path. */
export const MAX_EMAIL_LENGTH = 254;

/**
 * Linear-time structural check. See the file header for why each piece is
 * shaped the way it is, and what it deliberately does NOT accept.
 */
export const EMAIL_PATTERN = /^[^@\s]+@[^@\s.]+(?:\.[^@\s.]+)+$/;

/**
 * True when `value` is a plausible address, in time bounded by
 * {@link MAX_EMAIL_LENGTH} regardless of input.
 *
 * This is deliberately a STRUCTURAL check, not a deliverability check: no
 * regex can tell whether a mailbox exists, and pretending otherwise rejects
 * real people. Confirmation is the email we send, not the pattern.
 *
 * Does not trim. Callers trim first, so that the length they cap is the length
 * they store.
 */
export function isValidEmail(value: string): boolean {
  return value.length <= MAX_EMAIL_LENGTH && EMAIL_PATTERN.test(value);
}
