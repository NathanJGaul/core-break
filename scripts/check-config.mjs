import { readFile } from 'node:fs/promises';
import { exit } from 'node:process';
import { VERSION as apiVersion } from '../worker/index.js';

function parseJsonc(text) {
  let withoutComments = '';
  let inString = false;
  let escaped = false;
  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    const next = text[index + 1];
    if (inString) {
      withoutComments += character;
      if (escaped) escaped = false;
      else if (character === '\\') escaped = true;
      else if (character === '"') inString = false;
    } else if (character === '"') {
      inString = true;
      withoutComments += character;
    } else if (character === '/' && next === '/') {
      index += 1;
      while (index + 1 < text.length && text[index + 1] !== '\n') index += 1;
    } else if (character === '/' && next === '*') {
      index += 2;
      while (index + 1 < text.length && !(text[index] === '*' && text[index + 1] === '/')) index += 1;
      index += 1;
    } else {
      withoutComments += character;
    }
  }

  let json = '';
  inString = false;
  escaped = false;
  for (let index = 0; index < withoutComments.length; index += 1) {
    const character = withoutComments[index];
    if (inString) {
      json += character;
      if (escaped) escaped = false;
      else if (character === '\\') escaped = true;
      else if (character === '"') inString = false;
    } else if (character === '"') {
      inString = true;
      json += character;
    } else if (character === ',') {
      let next = index + 1;
      while (/\s/.test(withoutComments[next] ?? '')) next += 1;
      if (withoutComments[next] !== '}' && withoutComments[next] !== ']') json += character;
    } else {
      json += character;
    }
  }
  return JSON.parse(json);
}

const local = process.argv.includes('--local');
const [wranglerText, packageText] = await Promise.all([
  readFile(new URL('../wrangler.jsonc', import.meta.url), 'utf8'),
  readFile(new URL('../package.json', import.meta.url), 'utf8')
]);
const pkg = JSON.parse(packageText);
const failures = [];
let wrangler;
try {
  wrangler = parseJsonc(wranglerText);
} catch {
  failures.push('wrangler.jsonc is not valid JSONC');
}
const syncNamespace = (Array.isArray(wrangler?.kv_namespaces) ? wrangler.kv_namespaces : []).find((namespace) => namespace?.binding === 'SYNC');
const coordinatorBinding = (Array.isArray(wrangler?.durable_objects?.bindings) ? wrangler.durable_objects.bindings : []).find((binding) => binding?.name === 'SYNC_COORDINATOR' && binding?.class_name === 'SyncCoordinator');
const hasCoordinatorMigration = (Array.isArray(wrangler?.migrations) ? wrangler.migrations : []).some((migration) => Array.isArray(migration?.new_sqlite_classes) && migration.new_sqlite_classes.includes('SyncCoordinator'));
if (apiVersion !== pkg.version) failures.push(`API version ${apiVersion ?? 'missing'} does not match package version ${pkg.version}`);
if (!syncNamespace) failures.push('missing SYNC KV binding');
if (!coordinatorBinding) failures.push('missing SyncCoordinator Durable Object binding');
if (!hasCoordinatorMigration) failures.push('missing forward Durable Object migration');
if (!pkg.engines?.node || !/^>=22(?:\.0\.0)?$/.test(pkg.engines.node)) failures.push('Node >=22 engine is required');
if (!local && syncNamespace?.id === 'REPLACE_WITH_YOUR_KV_NAMESPACE_ID') failures.push('placeholder KV namespace ID is not deployable');
if (failures.length) {
  console.error(`Configuration preflight failed${local ? ' (local mode)' : ''}:`);
  for (const failure of failures) console.error(`- ${failure}`);
  exit(1);
}
console.log(`Configuration preflight passed${local ? ' (local placeholder permitted)' : ''}.`);
