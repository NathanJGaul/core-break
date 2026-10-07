import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';

function runCheck(...args) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ['scripts/check-config.mjs', ...args], { cwd: process.cwd() });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk) => { stdout += chunk; });
    child.stderr.on('data', (chunk) => { stderr += chunk; });
    child.on('error', reject);
    child.on('close', (status) => resolve({ status, stdout, stderr }));
  });
}

test('configuration preflight distinguishes local checks from deployment placeholders', async () => {
  const local = await runCheck('--local');
  assert.equal(local.status, 0);
  assert.match(local.stdout, /Configuration preflight passed/);

  const deploy = await runCheck();
  assert.equal(deploy.status, 1);
  assert.match(deploy.stderr, /placeholder KV namespace ID is not deployable/);
});
