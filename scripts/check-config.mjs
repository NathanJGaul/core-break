import { readFile } from 'node:fs/promises';
import { exit } from 'node:process';

const local = process.argv.includes('--local');
const [wrangler, packageText, workerText] = await Promise.all([
  readFile(new URL('../wrangler.jsonc', import.meta.url), 'utf8'),
  readFile(new URL('../package.json', import.meta.url), 'utf8'),
  readFile(new URL('../worker/index.js', import.meta.url), 'utf8')
]);
const pkg = JSON.parse(packageText);
const apiVersion = workerText.match(/const VERSION = '([^']+)'/)?.[1];
const failures = [];
if (apiVersion !== pkg.version) failures.push(`API version ${apiVersion ?? 'missing'} does not match package version ${pkg.version}`);
if (!wrangler.includes('"binding": "SYNC"')) failures.push('missing SYNC KV binding');

if (!wrangler.includes('"name": "SYNC_COORDINATOR"') || !wrangler.includes('"class_name": "SyncCoordinator"')) failures.push('missing SyncCoordinator Durable Object binding');
if (!wrangler.includes('"new_sqlite_classes": ["SyncCoordinator"]')) failures.push('missing forward Durable Object migration');
if (!pkg.engines?.node || !/^>=22(?:\.0\.0)?$/.test(pkg.engines.node)) failures.push('Node >=22 engine is required');
if (!local && wrangler.includes('REPLACE_WITH_YOUR_KV_NAMESPACE_ID')) failures.push('placeholder KV namespace ID is not deployable');
if (failures.length) {
  console.error(`Configuration preflight failed${local ? ' (local mode)' : ''}:`);
  for (const failure of failures) console.error(`- ${failure}`);
  exit(1);
}
console.log(`Configuration preflight passed${local ? ' (local placeholder permitted; use npm run check:deploy before deploy)' : ''}.`);
