import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { copyFile, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';

const PLACEHOLDER_NAMESPACE_ID = 'REPLACE_WITH_YOUR_KV_NAMESPACE_ID';
const SYNC_NAMESPACE_ID = /("binding"\s*:\s*"SYNC"[^}]*?"id"\s*:\s*)"[^"]*"/;
const PREFLIGHT_INPUTS = ['scripts/check-config.mjs', 'worker/version.js', 'package.json', 'public/sw.js'];

function runCheck(root, ...args) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ['scripts/check-config.mjs', ...args], { cwd: root });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk) => { stdout += chunk; });
    child.stderr.on('data', (chunk) => { stderr += chunk; });
    child.on('error', reject);
    child.on('close', (status) => resolve({ status, stdout, stderr }));
  });
}

// The preflight reads its inputs relative to its own location, so the test runs a copy of it next to a
// wrangler.jsonc whose SYNC namespace id is the placeholder. This keeps the test independent of the real id.
async function withPlaceholderRoot(run) {
  const root = await mkdtemp(join(tmpdir(), 'core-break-preflight-'));
  try {
    for (const file of PREFLIGHT_INPUTS) {
      await mkdir(dirname(join(root, file)), { recursive: true });
      await copyFile(file, join(root, file));
    }
    const wrangler = await readFile('wrangler.jsonc', 'utf8');
    assert.match(wrangler, SYNC_NAMESPACE_ID, 'wrangler.jsonc has no SYNC KV namespace id to replace with the placeholder');
    const withPlaceholder = wrangler.replace(SYNC_NAMESPACE_ID, (_, head) => `${head}"${PLACEHOLDER_NAMESPACE_ID}"`);
    await writeFile(join(root, 'wrangler.jsonc'), withPlaceholder);
    return await run(root);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

test('configuration preflight distinguishes local checks from deployment placeholders', async () => {
  const local = await runCheck(process.cwd(), '--local');
  assert.equal(local.status, 0);
  assert.match(local.stdout, /Configuration preflight passed/);

  await withPlaceholderRoot(async (placeholder) => {
    const placeholderLocal = await runCheck(placeholder, '--local');
    assert.equal(placeholderLocal.status, 0);
    assert.match(placeholderLocal.stdout, /Configuration preflight passed/);

    const deploy = await runCheck(placeholder);
    assert.equal(deploy.status, 1);
    assert.match(deploy.stderr, /placeholder KV namespace ID is not deployable/);
  });
});
