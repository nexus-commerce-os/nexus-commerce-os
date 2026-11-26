/*
 * `node:sqlite` arrived in Node 22.5. On an older runtime the contract suite
 * died with `ERR_UNKNOWN_BUILTIN_MODULE: node:sqlite` at module load — which is
 * how this suite passed locally on Node 24 and failed in CI on Node 20.17,
 * a divergence the suite itself should have named.
 *
 * ESM evaluates imports in source order, so importing this module BEFORE
 * `node:sqlite` turns that crash into a sentence.
 */
const MINIMUM = [22, 5];
const [major, minor] = process.versions.node.split('.').map(Number);

if (major < MINIMUM[0] || (major === MINIMUM[0] && minor < MINIMUM[1])) {
  throw new Error(
    `this suite needs node:sqlite, added in Node ${MINIMUM.join('.')}; ` +
      `running Node ${process.versions.node}. CI pins the version in ` +
      `.github/workflows/ci.yml (env.NODE_VERSION) and .nvmrc — if they disagree ` +
      `with package.json engines.node, that is the bug.`,
  );
}
