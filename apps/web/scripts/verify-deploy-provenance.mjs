/**
 * Refuses to deploy code that CI has not seen.
 *
 * WHY THIS EXISTS. On 25 November 2026 production was deployed straight from a
 * working tree: the build and the artifact checks were run by hand, then
 * `wrangler deploy`, before the commit was pushed, before the pull request
 * existed and before CI had run. The change turned out to be fine, which is
 * luck, not process. Nothing in this repository stopped it — `wrangler.toml`
 * says so in as many words: the only real enforcement is custody of the API
 * token plus branch protection, and whoever is typing holds the token.
 *
 * So this closes the accidental path. It asserts that what is about to be
 * uploaded is a commit that exists on the remote, on a branch allowed to ship,
 * with no uncommitted edits, and whose CI finished green.
 *
 * HONEST LIMIT, in the same spirit as the note in wrangler.toml: this is
 * defence in depth, not a boundary. It runs on the wrangler CLI path, so it
 * catches the mistake an engineer actually makes. It cannot stop a dashboard
 * upload, and anyone determined can delete this file. It is here to make the
 * careless deploy impossible, not the deliberate one.
 */

import { execFileSync } from 'node:child_process';

const DEPLOY_COMMANDS = ['deploy', 'versions upload', 'versions deploy'];
const SHIPPABLE_BRANCHES = ['release/product-catalog', 'main'];

const wranglerCommand = process.env.WRANGLER_COMMAND ?? '';
const isDeploy = DEPLOY_COMMANDS.some((c) => wranglerCommand.includes(c));

if (!isDeploy) {
  console.log(`verify-deploy-provenance: not a deploy (${wranglerCommand || 'no command'}) — skipped`);
  process.exit(0);
}

/*
 * Inside GitHub Actions the workflow has already required `ci-gate`, and the
 * run asking about itself would never be "completed". The clean-tree and
 * pushed-commit checks below still apply there.
 */
const inCi = process.env.GITHUB_ACTIONS === 'true';

const git = (...args) => execFileSync('git', args, { encoding: 'utf8' }).trim();
const problems = [];

let head = '';
try {
  head = git('rev-parse', 'HEAD');
} catch {
  problems.push('not a git checkout — refusing to deploy something with no provenance at all');
}

if (head) {
  const dirty = git('status', '--porcelain');
  if (dirty) {
    // `git status --porcelain` is "XY<space>path", but X and Y vary in width
    // between staged and unstaged entries, so take everything after the first
    // run of whitespace rather than a fixed offset.
    const files = dirty
      .split('\n')
      .map((l) => l.trim().split(/\s+/).slice(1).join(' '))
      .filter(Boolean)
      .slice(0, 8);
    problems.push(
      `the working tree has uncommitted changes, so this deploy would ship code that is ` +
        `in no commit and therefore in no review and no CI run: ${files.join(', ')}`,
    );
  }

  // `git branch -r --contains` is the question that matters: is this exact
  // commit on the remote? A local branch name proves nothing.
  let remoteBranches = [];
  try {
    remoteBranches = git('branch', '-r', '--contains', head)
      .split('\n')
      .map((l) => l.trim().replace(/^origin\//, ''))
      .filter(Boolean);
  } catch {
    /* handled by the emptiness check below */
  }

  if (remoteBranches.length === 0) {
    problems.push(
      `commit ${head.slice(0, 8)} is not on the remote — push it and let CI run before it ships`,
    );
  } else if (!remoteBranches.some((b) => SHIPPABLE_BRANCHES.includes(b))) {
    problems.push(
      `commit ${head.slice(0, 8)} is on ${remoteBranches.join(', ')}, none of which ship. ` +
        `Production comes from ${SHIPPABLE_BRANCHES.join(' or ')}.`,
    );
  } else if (!inCi) {
    // Ask GitHub what CI concluded for this exact commit.
    let conclusion = null;
    try {
      const raw = execFileSync(
        'gh',
        ['api', `repos/{owner}/{repo}/commits/${head}/check-runs`, '--jq', '[.check_runs[] | select(.name=="ci-gate")] | .[0] | .status + "/" + (.conclusion // "none")'],
        { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] },
      ).trim();
      conclusion = raw || null;
    } catch {
      problems.push(
        'could not ask GitHub what CI concluded for this commit. This check fails closed: ' +
          'a deploy gate that gives up when it cannot see is not a gate.',
      );
    }
    if (conclusion && conclusion !== 'completed/success') {
      problems.push(
        `ci-gate for ${head.slice(0, 8)} is "${conclusion}", not completed/success — ` +
          `the mandatory checks have not passed for the code being deployed`,
      );
    }
  }
}

if (problems.length > 0) {
  console.error(
    `verify-deploy-provenance: refusing to deploy.\n  · ${problems.join('\n  · ')}\n\n` +
      `This exists because production was once deployed from an uncommitted working tree, ` +
      `ahead of its own pull request and CI run.`,
  );
  process.exit(1);
}

console.log(
  `verify-deploy-provenance: OK — ${head.slice(0, 8)} is pushed, on a shipping branch, ` +
    `clean, and ${inCi ? 'running inside CI' : 'green in CI'}.`,
);
