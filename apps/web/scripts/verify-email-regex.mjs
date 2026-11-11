#!/usr/bin/env node
/*
 * Fitness function for the waitlist endpoint's address check.
 *
 * WHY IT READS THE ROUTE RATHER THAN IMPORTING IT. The route is a `.ts` module
 * that only Next compiles, and this package has no test runner and no build
 * output a script could import. The alternative — restating the pattern here —
 * would test a copy and pass forever while the shipped pattern rotted. So the
 * literal is extracted from the source and exercised directly: if someone
 * edits `EMAIL_RE`, this runs against the edit. Zero dependencies, run by
 * `pnpm test` — which this package gains here, having had no tests at all.
 *
 * WHAT IT GUARDS. The pattern CodeQL flagged (js/polynomial-redos, high) let an
 * unauthenticated POST body of `a@` + `"."*n` + `@` burn quadratic time in the
 * regex engine — measured at 4.2 seconds of blocked event loop for a 60KB body.
 * A scanner going quiet is not evidence that it is fixed, so this asserts the
 * two things that are: the validator still classifies the same inputs the same
 * way, and it runs in time that cannot blow up.
 *
 * Exits non-zero on any failure, so `pnpm test` fails the CI stage.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const ROUTE = join(here, "..", "src", "app", "api", "waitlist", "route.ts");

const failures = [];
const check = (ok, message) => {
  if (!ok) failures.push(message);
};

/* ── extract the shipped pattern and cap ──────────────────────────────────── */

const source = readFileSync(ROUTE, "utf8");

const reMatch = source.match(/^const EMAIL_RE = (\/.*\/[gimsuy]*);$/m);
if (!reMatch) {
  console.error(
    `FAIL  could not find a top-level \`const EMAIL_RE = /.../;\` in ${ROUTE}.\n` +
      "      If the validator moved, move this check with it — do not delete it.",
  );
  process.exit(1);
}
const capMatch = source.match(/^const MAX_EMAIL_LENGTH = (\d+);$/m);
if (!capMatch) {
  console.error(
    `FAIL  could not find \`const MAX_EMAIL_LENGTH = <number>;\` in ${ROUTE}.\n` +
      "      The length cap is what bounds the work regardless of the pattern.",
  );
  process.exit(1);
}

const body = reMatch[1];
const lastSlash = body.lastIndexOf("/");
const EMAIL_RE = new RegExp(body.slice(1, lastSlash), body.slice(lastSlash + 1));
const MAX_EMAIL_LENGTH = Number(capMatch[1]);

console.log(`pattern : ${EMAIL_RE}`);
console.log(`cap     : ${MAX_EMAIL_LENGTH}`);

/* The validator exactly as the route applies it, cap first. */
const accepts = (value) => value.length <= MAX_EMAIL_LENGTH && EMAIL_RE.test(value);

/* ── 1. the pattern must be linear, not polynomial ───────────────────────── */

/*
 * The budget is loose on purpose. It is not a benchmark; it is a trip wire a
 * quadratic pattern cannot pass even on a slow, loaded runner, while a linear
 * one clears it by three orders of magnitude. The pre-fix pattern took 1,855 ms
 * at n = 40,000 and so fails this at the first size.
 */
const BUDGET_MS = 500;
const hostile = [
  ["dots then a second @", (n) => `a@${".".repeat(n)}@`],
  ["dots then a space", (n) => `a@${".".repeat(n)} `],
  ["one long label then @", (n) => `a@${"b".repeat(n)}@`],
  ["alternating labels", (n) => `a@${"b.".repeat(Math.floor(n / 2))}@`],
  ["no @ at all", (n) => "a".repeat(n)],
  ["only @", (n) => "@".repeat(n)],
  ["only dots", (n) => ".".repeat(n)],
];

/*
 * Sizes ascend and the loop STOPS at the first breach for a shape. Without
 * that, a quadratic pattern does not fail the check — it hangs it: measured
 * against the pre-fix pattern, n = 200,000 took 45.9 SECONDS for a single
 * input, so the script ran past two minutes and would hit a CI job timeout
 * instead of reporting a clean failure. Breaking early turns that into a
 * ~3-second failure with the measurement attached.
 */
for (const [label, make] of hostile) {
  for (const n of [10_000, 50_000, 200_000]) {
    const input = make(n);
    const started = process.hrtime.bigint();
    /*
     * Deliberately EMAIL_RE.test, not accepts(): the cap would reject these on
     * length and the pattern would never run, which is correct in production
     * and useless as a test of the pattern. This measures the pattern itself,
     * so the guarantee survives someone raising or removing the cap.
     */
    const matched = EMAIL_RE.test(input);
    const ms = Number(process.hrtime.bigint() - started) / 1e6;
    check(matched === false, `${label} (n=${n}) unexpectedly MATCHED`);
    if (ms >= BUDGET_MS) {
      failures.push(
        `${label} (n=${n}) took ${ms.toFixed(1)}ms, budget ${BUDGET_MS}ms — the pattern is not linear`,
      );
      break;
    }
  }
}

/* A long VALID address must still be fast — guards against "fix" by length alone. */
{
  const long = `${"a".repeat(100_000)}@${"b".repeat(100_000)}.example`;
  const started = process.hrtime.bigint();
  const matched = EMAIL_RE.test(long);
  const ms = Number(process.hrtime.bigint() - started) / 1e6;
  check(matched === true, "a long but structurally valid address must still match the pattern");
  check(ms < BUDGET_MS, `a long valid address took ${ms.toFixed(1)}ms`);
}

/* ── 2. behaviour: what must be accepted ─────────────────────────────────── */

const MUST_ACCEPT = [
  "a@b.co",
  "first.last@example.invalid",
  "x+tag@mail.example.invalid",
  "o'brien@example.invalid",
  "user_name@sub.domain.example.invalid",
  "a@b.c.d.e.f",
  "a@xn--80ak6aa92e.invalid",
  "UPPER@EXAMPLE.INVALID",
  "a@b-c.example",
  `${"a".repeat(60)}@${"b".repeat(60)}.example`,
];
for (const value of MUST_ACCEPT) {
  check(accepts(value), `must accept ${JSON.stringify(value)}`);
}

/* ── 3. behaviour: what must be refused, and why ─────────────────────────── */

const MUST_REFUSE = [
  ["no domain dot", "a@b"],
  ["nothing before the @", "@b.co"],
  ["nothing after the @", "a@"],
  ["no @ at all", "ab.co"],
  ["two @", "a@@b.co"],
  ["two @ apart", "a@b@c.co"],
  ["empty", ""],
  ["a space inside", "a b@c.co"],
  ["a leading space (the route trims, but the pattern must not rely on it)", " a@b.co"],
  ["a tab", "a\tb@c.co"],
  ["a newline", "a@b.co\n"],
  ["trailing dot", "a@b."],
  ["leading dot in the domain", "a@.b"],
  ["an empty label", "a@b..co"],
  ["only dots", "a@.."],
  ["over the length cap", `${"a".repeat(250)}@${"b".repeat(250)}.example`],
];
for (const [why, value] of MUST_REFUSE) {
  check(!accepts(value), `must refuse (${why}): ${JSON.stringify(value)}`);
}

/* ── 4. the cap is the one that stops an oversized address ───────────────── */
{
  const overCap = `${"a".repeat(MAX_EMAIL_LENGTH)}@b.co`;
  check(overCap.length > MAX_EMAIL_LENGTH, "the fixture must exceed the cap");
  check(
    EMAIL_RE.test(overCap),
    "the fixture should be structurally valid, so the CAP is what refuses it",
  );
  check(!accepts(overCap), "an address over the cap must be refused");
}

/* ── 5. the route must apply the cap before the pattern ──────────────────── */
check(
  /email\.length\s*>\s*MAX_EMAIL_LENGTH\s*\|\|\s*!EMAIL_RE\.test\(/.test(source),
  "the route must test the length cap BEFORE the pattern (short-circuit order matters: " +
    "it is what bounds the work no matter what the pattern becomes)",
);

/* ── report ──────────────────────────────────────────────────────────────── */

if (failures.length > 0) {
  console.error(`\nFAIL  ${failures.length} problem(s) with the waitlist address check:`);
  for (const message of failures) console.error(`   - ${message}`);
  process.exit(1);
}
console.log(
  `OK    ${MUST_ACCEPT.length} accepted, ${MUST_REFUSE.length} refused, ` +
    `${hostile.length * 3} hostile inputs under ${BUDGET_MS}ms`,
);
