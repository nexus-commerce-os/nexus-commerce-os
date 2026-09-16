#!/usr/bin/env node
/**
 * Standalone validation of the canonical HTTP contract.
 *
 * Runs in CI as its own gate so a malformed or drifting specification fails the
 * build even if no test happens to touch it. It proves four things: the
 * document is OpenAPI 3.1, every schema is valid JSON Schema 2020-12, every
 * $ref resolves, and every published schema is actually reachable from an
 * operation — an orphaned schema means the document and the API have parted.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import { parse } from 'yaml';

const here = dirname(fileURLToPath(import.meta.url));
const specPath = join(here, '..', 'openapi', 'identity.yaml');
const spec = parse(readFileSync(specPath, 'utf8'));
const problems = [];

if (typeof spec.openapi !== 'string' || !spec.openapi.startsWith('3.1')) {
  problems.push(`openapi must be 3.1.x, found ${JSON.stringify(spec.openapi)}`);
}
if (!spec.info?.title || !spec.info?.version) {
  problems.push('info.title and info.version are required');
}
if (!Array.isArray(spec.servers) || spec.servers.length === 0) {
  problems.push('at least one server must be declared');
}

const ajv = new Ajv2020({ strict: false, allErrors: true });
addFormats(ajv);
ajv.addSchema(spec, 'spec');

const referenced = new Set();
const operationIds = new Set();

for (const [path, methods] of Object.entries(spec.paths ?? {})) {
  for (const [method, operation] of Object.entries(methods)) {
    const where = `${method.toUpperCase()} ${path}`;

    if (!operation.operationId) {
      problems.push(`${where} has no operationId`);
    } else if (operationIds.has(operation.operationId)) {
      problems.push(`${where} reuses operationId "${operation.operationId}"`);
    } else {
      operationIds.add(operation.operationId);
    }

    if (!operation.responses || Object.keys(operation.responses).length === 0) {
      problems.push(`${where} declares no responses`);
    }

    for (const ref of refsIn(operation)) {
      referenced.add(ref);
      if (ajv.getSchema(`spec${ref}`) === undefined) {
        problems.push(`${where} references ${ref}, which does not resolve`);
      }
    }
  }
}

for (const name of Object.keys(spec.components?.schemas ?? {})) {
  const ref = `#/components/schemas/${name}`;
  try {
    ajv.compile({ $ref: `spec${ref}` });
  } catch (error) {
    problems.push(`schema ${name} is not valid JSON Schema: ${error.message.split('\n')[0]}`);
  }
}

// Orphan check: a schema reachable from no operation, directly or transitively.
const reachable = new Set();
for (const ref of referenced) {
  collect(ref, reachable);
}
for (const name of Object.keys(spec.components?.schemas ?? {})) {
  if (!reachable.has(`#/components/schemas/${name}`)) {
    problems.push(`schema ${name} is declared but unreachable from any operation`);
  }
}

function refsIn(node, found = []) {
  if (node === null || typeof node !== 'object') {
    return found;
  }
  for (const [key, value] of Object.entries(node)) {
    if (key === '$ref' && typeof value === 'string') {
      found.push(value);
    } else {
      refsIn(value, found);
    }
  }
  return found;
}

function collect(ref, into) {
  if (into.has(ref)) {
    return;
  }
  into.add(ref);
  const target = resolve(ref);
  for (const nested of refsIn(target)) {
    collect(nested, into);
  }
}

function resolve(ref) {
  return ref
    .replace(/^#\//, '')
    .split('/')
    .reduce((node, segment) => node?.[segment], spec);
}

// Responses referenced via components/responses pull in their own schemas.
for (const ref of [...referenced]) {
  collect(ref, reachable);
}

if (problems.length > 0) {
  console.error('OPENAPI VALIDATION: FAIL');
  for (const problem of problems) {
    console.error(`  - ${problem}`);
  }
  process.exit(1);
}

console.log(
  `OPENAPI VALIDATION: PASS (${spec.openapi}, ${operationIds.size} operations, ` +
    `${Object.keys(spec.components?.schemas ?? {}).length} schemas, 0 issues)`,
);
