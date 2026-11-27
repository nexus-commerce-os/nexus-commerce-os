/*
 * The job a scheduler invokes.
 *
 * `runCycle` is tested elsewhere. What is tested here is everything AROUND it
 * that an unattended, time-boxed, observable job needs: refusing bad
 * configuration before touching the network, bounding the whole run, telling
 * a scheduler the difference between "nothing to do" and "something broke",
 * and never letting a demonstration path be reachable by configuration alone.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  InMemoryOfferStore,
  InMemorySourceState,
  runSync,
  summarise,
  validateSources,
} from '../dist/index.js';

const AT = new Date('2026-11-26T12:00:00Z');
const clock =
  (d = AT) =>
  () =>
    d;
const silent = () => {};

const https = (over = {}) => ({
  id: 'provider-feed',
  merchantId: 'provider',
  transport: 'https',
  url: 'https://feeds.example.com/products.csv',
  format: 'csv',
  schedule: { everyMinutes: 60 },
  credentialRef: null,
  enabled: true,
  ...over,
});

const fixture = (over = {}) =>
  https({
    id: 'fixture-demo',
    merchantId: 'demo',
    transport: 'fixture',
    url: '/tmp/demo.zip',
    ...over,
  });

const ok = (attempts = 1) => ({
  status: 'unchanged',
  validators: {},
  fetchedAt: AT.toISOString(),
  attempts,
});
const broken = (reason = 'down') => ({
  status: 'failed',
  reason,
  retryable: true,
  fetchedAt: AT.toISOString(),
  attempts: 3,
});

const run = (sources, options = {}) =>
  runSync(sources, new InMemoryOfferStore(), new InMemorySourceState(), {
    now: clock(),
    log: silent,
    ...options,
  });

test('a fixture source cannot run on configuration alone', async () => {
  // The whole point of the opt-in. If a config row could enable it, "for
  // demonstrations only" would be a comment rather than a control.
  const result = await run([fixture()]);
  assert.equal(result.exitCode, 2, 'invalid configuration must exit 2');
  assert.equal(result.report.outcomes.length, 0, 'nothing may run');
});

test('a fixture source runs when it is explicitly permitted', async () => {
  const result = await run([fixture()], { allowFixtures: true, retrieve: async () => ok() });
  assert.notEqual(result.exitCode, 2);
});

test('a fixture id must announce itself', async () => {
  const problems = validateSources([fixture({ id: 'innocuous-name' })], true);
  assert.ok(
    problems.some((p) => /must start with "fixture-"/.test(p)),
    `a fixture must be obvious in a log line: ${problems.join('; ')}`,
  );
});

test('a duplicate source id is refused before anything runs', async () => {
  const problems = validateSources([https(), https()], false);
  assert.ok(
    problems.some((p) => /duplicate source id/.test(p)),
    problems.join('; '),
  );
});

test('a credential pasted into the reference field is refused', async () => {
  const problems = validateSources(
    [https({ credentialRef: 'sk_live_9f!x', auth: { kind: 'bearer' } })],
    false,
  );
  assert.ok(
    problems.some((p) => /NAME of a secret/i.test(p)),
    problems.join('; '),
  );
});

test('the exit code distinguishes "nothing to do" from "something broke"', async () => {
  const quiet = await run([https()], { retrieve: async () => ok() });
  assert.equal(quiet.exitCode, 0, 'an unchanged feed is not an alert');
  assert.equal(quiet.health.failed, 0);

  const loud = await run([https()], { retrieve: async () => broken('connection refused') });
  assert.equal(loud.exitCode, 1, 'a failed source must be an alert');
  assert.equal(loud.health.failed, 1);
  assert.match(loud.health.failing[0].reason, /connection refused/);
});

test('a disabled source is neither run nor counted as a failure', async () => {
  const result = await run([https({ enabled: false })], {
    retrieve: async () => {
      throw new Error('a disabled source must not be fetched');
    },
  });
  assert.equal(result.exitCode, 0);
  assert.equal(result.health.failed, 0);
});

test('the deadline defers sources instead of aborting one mid-write', async () => {
  // Time advances past the deadline after the first source is admitted.
  let calls = 0;
  const moving = () => new Date(AT.getTime() + calls++ * 5_000);

  const sources = [https({ id: 'a', merchantId: 'ma' }), https({ id: 'b', merchantId: 'mb' })];
  const result = await runSync(sources, new InMemoryOfferStore(), new InMemorySourceState(), {
    now: moving,
    log: silent,
    deadlineMs: 1,
    retrieve: async () => ok(),
  });

  assert.equal(result.deadlineHit, true, 'the deadline must be reported, not silent');
  assert.ok(result.report.outcomes.length < sources.length, 'a source should have been deferred');
  // Deferral is safe BECAUSE `isDue` measures from the last success: a source
  // that never ran is simply still due next cycle. No backlog to replay.
  assert.equal(result.exitCode, 0, 'running out of time is not a failure');
});

test('force bypasses the schedule and nothing else', async () => {
  const store = new InMemoryOfferStore();
  const state = new InMemorySourceState();
  await state.set('provider-feed', { lastSuccessAt: AT, validators: {} });

  const skipped = await runSync([https()], store, state, {
    now: clock(),
    log: silent,
    retrieve: async () => ok(),
  });
  assert.equal(skipped.report.outcomes[0].outcome, 'skipped');

  const forced = await runSync([https()], store, state, {
    now: clock(),
    log: silent,
    force: true,
    retrieve: async () => ok(),
  });
  assert.notEqual(forced.report.outcomes[0].outcome, 'skipped', 'force must actually run it');
});

test('every run emits a start line, a line per source, and a finish line', async () => {
  const events = [];
  await run([https({ id: 'a', merchantId: 'ma' }), https({ id: 'b', merchantId: 'mb' })], {
    log: (e) => events.push(e),
    retrieve: async () => ok(),
  });
  const names = events.map((e) => e.event);
  assert.equal(names.filter((n) => n === 'sync.start').length, 1);
  assert.equal(names.filter((n) => n === 'sync.source').length, 2);
  assert.equal(names.filter((n) => n === 'sync.finish').length, 1);

  const start = events.find((e) => e.event === 'sync.start');
  assert.ok(Array.isArray(start.fixtures), 'the start line must name any fixture sources in play');
});

test('no log line carries a credential', async () => {
  const events = [];
  await run([https({ credentialRef: 'CJ_FEED_KEY', auth: { kind: 'bearer' } })], {
    log: (e) => events.push(e),
    retrieve: async () => ok(),
    retrieveOptions: { resolveCredential: async () => 'super-secret-value' },
  });
  const text = JSON.stringify(events);
  assert.ok(!text.includes('super-secret-value'), 'a secret reached the structured log');
});

test('the health summary counts every outcome exactly once', () => {
  const health = summarise([
    { outcome: 'imported', sourceId: 'a', reason: '' },
    { outcome: 'unchanged', sourceId: 'b', reason: '' },
    { outcome: 'skipped', sourceId: 'c', reason: '' },
    { outcome: 'failed', sourceId: 'd', reason: 'boom' },
  ]);
  assert.equal(health.total, 4);
  assert.equal(health.imported + health.unchanged + health.skipped + health.failed, 4);
  assert.deepEqual(health.failing, [{ sourceId: 'd', reason: 'boom' }]);
});
