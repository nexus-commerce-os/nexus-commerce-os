/*
 * Fitness function for the one email validator.
 *
 * WHY IT TESTS THE COMPILED MODULE. `src/lib/email.ts` is the single source
 * both the API route and the landing page import, so exercising its build
 * output tests exactly what ships. An earlier version of this check parsed the
 * regex literal out of `route.ts`; that stopped being the right target the
 * moment the validator moved into a shared module — and the reason it moved is
 * that a SECOND copy of the vulnerable pattern was living in `page.tsx` and
 * survived the route being fixed.
 *
 * WHAT IT GUARDS. CodeQL alert #1, `js/polynomial-redos` (high). The old
 * pattern let an unauthenticated POST body burn quadratic time in the regex
 * engine — measured at 45.9 SECONDS of blocked event loop for a 200 KB body.
 * A scanner going quiet is not evidence that it is fixed, so this asserts the
 * two things that are: the validator still classifies the same inputs the same
 * way, and it runs in time that cannot blow up.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { EMAIL_PATTERN, MAX_EMAIL_LENGTH, isValidEmail } from '../dist/lib/email.js';

/* ─── the pattern must be linear, not polynomial ────────────────────────── */

/*
 * The budget is loose on purpose. It is not a benchmark; it is a trip wire a
 * quadratic pattern cannot pass even on a slow, loaded runner, while a linear
 * one clears it by three orders of magnitude. The pre-fix pattern took
 * 1,855 ms at n = 40,000, so it fails this at the first size.
 *
 * Sizes ascend and the loop STOPS at the first breach. Without that, a
 * quadratic pattern does not fail this check — it hangs it: 45.9 seconds for a
 * single n = 200,000 input ran the old script past two minutes, which would hit
 * a CI job timeout instead of reporting a clean failure.
 */
const BUDGET_MS = 500;

const HOSTILE = [
  ['dots then a second @', (n) => `a@${'.'.repeat(n)}@`],
  ['dots then a space', (n) => `a@${'.'.repeat(n)} `],
  ['one long label then @', (n) => `a@${'b'.repeat(n)}@`],
  ['alternating labels', (n) => `a@${'b.'.repeat(Math.floor(n / 2))}@`],
  ['no @ at all', (n) => 'a'.repeat(n)],
  ['only @', (n) => '@'.repeat(n)],
  ['only dots', (n) => '.'.repeat(n)],
];

test('a hostile string cannot make the pattern blow up', () => {
  for (const [label, make] of HOSTILE) {
    for (const n of [10_000, 50_000, 200_000]) {
      const input = make(n);
      const started = process.hrtime.bigint();
      /*
       * Deliberately EMAIL_PATTERN, not isValidEmail(): the cap would refuse
       * these on length and the pattern would never run, which is correct in
       * production and useless as a test OF THE PATTERN. This measures the
       * pattern itself, so the guarantee survives someone raising the cap.
       */
      const matched = EMAIL_PATTERN.test(input);
      const ms = Number(process.hrtime.bigint() - started) / 1e6;
      assert.equal(matched, false, `${label} (n=${n}) unexpectedly MATCHED`);
      if (ms >= BUDGET_MS) {
        assert.fail(
          `${label} (n=${n}) took ${ms.toFixed(1)}ms, budget ${BUDGET_MS}ms — the pattern is not linear`,
        );
      }
    }
  }
});

test('a long but structurally valid address is still accepted, and fast', () => {
  // Guards against "fixing" the ReDoS by refusing long strings outright.
  const long = `${'a'.repeat(100_000)}@${'b'.repeat(100_000)}.example`;
  const started = process.hrtime.bigint();
  assert.equal(EMAIL_PATTERN.test(long), true);
  assert.ok(Number(process.hrtime.bigint() - started) / 1e6 < BUDGET_MS);
});

/* ─── behaviour: what must be accepted ──────────────────────────────────── */

test('every realistic address is accepted', () => {
  for (const value of [
    'a@b.co',
    'first.last@example.invalid',
    'x+tag@example.invalid',
    "o'brien@example.invalid",
    'user_name@sub.domain.example.invalid',
    'a@b.c.d.e.f',
    'a@xn--80ak6aa92e.invalid',
    'UPPER@EXAMPLE.INVALID',
    'a@b-c.example',
    `${'a'.repeat(60)}@${'b'.repeat(60)}.example`,
  ]) {
    assert.equal(isValidEmail(value), true, value);
  }
});

/* ─── behaviour: what must be refused, and why ──────────────────────────── */

test('every unsafe or malformed address is refused', () => {
  for (const [why, value] of [
    ['no domain dot', 'a@b'],
    ['nothing before the @', '@b.co'],
    ['nothing after the @', 'a@'],
    ['no @ at all', 'ab.co'],
    ['two @', 'a@@b.co'],
    ['two @ apart', 'a@b@c.co'],
    ['empty', ''],
    ['a space inside', 'a b@c.co'],
    ['a leading space (callers trim, but the check must not rely on it)', ' a@b.co'],
    ['a tab', 'a\tb@c.co'],
    ['a newline', 'a@b.co\n'],
    ['trailing dot', 'a@b.'],
    ['leading dot in the domain', 'a@.b'],
    ['an empty label', 'a@b..co'],
    ['only dots', 'a@..'],
  ]) {
    assert.equal(isValidEmail(value), false, `${why}: ${JSON.stringify(value)}`);
  }
});

/* ─── the cap, and the order it is applied in ───────────────────────────── */

test('the cap is what refuses an oversized address', () => {
  assert.equal(MAX_EMAIL_LENGTH, 254, 'RFC 5321 §4.5.3.1');
  const overCap = `${'a'.repeat(MAX_EMAIL_LENGTH)}@b.co`;
  assert.ok(overCap.length > MAX_EMAIL_LENGTH);
  assert.equal(EMAIL_PATTERN.test(overCap), true, 'the fixture is structurally valid');
  assert.equal(isValidEmail(overCap), false, 'so the CAP must be what refuses it');
});

test('the cap is applied BEFORE the pattern, so the work is bounded either way', () => {
  /*
   * The order matters more than the cap: it is what keeps the endpoint bounded
   * no matter what the pattern becomes later. Proven behaviourally rather than
   * by reading the source — an over-cap hostile string must be refused in
   * constant time, which is only possible if length is checked first.
   */
  const hostile = `a@${'.'.repeat(500_000)}@`;
  const started = process.hrtime.bigint();
  assert.equal(isValidEmail(hostile), false);
  const ms = Number(process.hrtime.bigint() - started) / 1e6;
  assert.ok(ms < 5, `over-cap input took ${ms.toFixed(3)}ms — the cap is not being checked first`);
});

/* ─── one validator, not two ────────────────────────────────────────────── */

test('neither the route nor the page carries its own copy of the pattern', async () => {
  /*
   * The regression that created this file: `page.tsx` kept its own copy of the
   * old pattern and stayed vulnerable after `route.ts` was fixed, and the two
   * then disagreed about `user@example..com`. A grep is a blunt instrument, but
   * it is the one that would have caught it.
   */
  const { readFileSync } = await import('node:fs');
  const { fileURLToPath } = await import('node:url');
  const { dirname, join } = await import('node:path');
  const here = dirname(fileURLToPath(import.meta.url));

  for (const rel of ['src/app/api/waitlist/route.ts', 'src/app/page.tsx']) {
    const source = readFileSync(join(here, '..', rel), 'utf8');
    assert.equal(
      /EMAIL_RE\s*=\s*\//.test(source),
      false,
      `${rel} declares its own email pattern — import isValidEmail from '@/lib/email' instead`,
    );
    assert.match(source, /from ['"]@\/lib\/email['"]/, `${rel} must use the shared validator`);
  }
});
