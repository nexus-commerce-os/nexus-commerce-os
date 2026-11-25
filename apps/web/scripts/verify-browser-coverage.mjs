/**
 * Proves the browser suite actually RAN what it claims to cover.
 *
 * WHY. A green Playwright run is not evidence that the tests ran. A bad
 * `testMatch` matches nothing, a `test.skip` can be left behind, and a project
 * can quietly disappear from the config — in every case the run is green and
 * the report says "0 failed", which reads exactly like success. The same shape
 * of hole was already found once in this repo: `node --test dist` reported a
 * pass with one phantom test and no real suite.
 *
 * So this reads Playwright's JSON report and asserts the things a count can
 * actually prove:
 *
 *   · every expected viewport project ran;
 *   · the serial flows project ran;
 *   · at least the expected number of tests ran per project;
 *   · nothing was skipped unless the skip is on the allowed list.
 *
 * Run after `playwright test`, against its JSON report:
 *   node scripts/verify-browser-coverage.mjs playwright-report/report.json
 */

import { readFile } from 'node:fs/promises';

/** Must match playwright.config.ts. Duplicated on purpose: if they drift, this fails. */
const EXPECTED_WIDTHS = [320, 375, 390, 412, 768, 1024, 1440, 1920];
const FLOWS_PROJECT = 'flows';

/**
 * Lower bounds, not exact counts — a lower bound still catches "the suite
 * vanished" without failing every time a test is legitimately added.
 */
const MIN_TESTS_PER_WIDTH = 8;
const MIN_FLOW_TESTS = 6;

/**
 * The only skip this suite is allowed to report, and the reason it exists:
 * the catalog is absent from the artifact unless PUBLISH_CATALOG=1, and a test
 * that pretends to cover absent pages is worse than one that says it did not.
 * CI builds WITH the catalog, so even this should not appear there.
 */
const ALLOWED_SKIP = /catalog not published/i;

const reportPath = process.argv[2] ?? 'playwright-report/report.json';

let report;
try {
  report = JSON.parse(await readFile(reportPath, 'utf8'));
} catch (error) {
  console.error(
    `verify-browser-coverage: cannot read ${reportPath} — ${error.message}\n` +
      `Without the report there is no evidence the suite ran at all, so this fails closed.`,
  );
  process.exit(1);
}

/** Flatten the nested suite tree into one list of executed tests. */
function collect(suites, out = []) {
  for (const suite of suites ?? []) {
    for (const spec of suite.specs ?? []) {
      for (const t of spec.tests ?? []) {
        out.push({
          project: t.projectName,
          title: spec.title,
          status: t.status, // expected | unexpected | flaky | skipped
          results: t.results ?? [],
        });
      }
    }
    collect(suite.suites, out);
  }
  return out;
}

const tests = collect(report.suites);
const problems = [];

if (tests.length === 0) {
  problems.push('the report contains NO tests — a green run of nothing is not a pass');
}

const byProject = new Map();
for (const t of tests) {
  if (!byProject.has(t.project)) byProject.set(t.project, []);
  byProject.get(t.project).push(t);
}

for (const width of EXPECTED_WIDTHS) {
  const name = `w${width}`;
  const ran = byProject.get(name);
  if (!ran) {
    problems.push(`project ${name} did not run — ${width}px is unverified`);
    continue;
  }
  if (ran.length < MIN_TESTS_PER_WIDTH) {
    problems.push(
      `project ${name} ran only ${ran.length} tests, expected at least ${MIN_TESTS_PER_WIDTH}`,
    );
  }
}

const flows = byProject.get(FLOWS_PROJECT);
if (!flows) {
  problems.push(
    `project "${FLOWS_PROJECT}" did not run — the waitlist flows (success, duplicate, ` +
      `invalid, rate limit, with and without JavaScript) are unverified`,
  );
} else if (flows.length < MIN_FLOW_TESTS) {
  problems.push(
    `project "${FLOWS_PROJECT}" ran only ${flows.length} tests, expected at least ${MIN_FLOW_TESTS}`,
  );
}

for (const t of tests) {
  if (t.status !== 'skipped') continue;
  const reason = t.results.flatMap((r) => r.errors ?? []).map((e) => e.message ?? '').join(' ');
  const annotation = JSON.stringify(t.results.map((r) => r.status));
  if (!ALLOWED_SKIP.test(reason) && !ALLOWED_SKIP.test(t.title)) {
    problems.push(`[${t.project}] "${t.title}" was SKIPPED (${annotation}) — not an allowed skip`);
  }
}

if (problems.length > 0) {
  console.error(
    `verify-browser-coverage: the browser suite did not cover what it claims ` +
      `(${problems.length} problem(s)):\n  · ${problems.join('\n  · ')}`,
  );
  process.exit(1);
}

const widthCounts = EXPECTED_WIDTHS.map((w) => `${w}:${byProject.get(`w${w}`).length}`).join(' ');
console.log(
  `verify-browser-coverage: OK — ${tests.length} tests across ${byProject.size} projects, ` +
    `0 disallowed skips.\n  widths (px:tests) ${widthCounts}\n  flows ${flows.length} tests`,
);
