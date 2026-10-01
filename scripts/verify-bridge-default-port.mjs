import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { setTimeout as delay } from 'node:timers/promises';

const projectRoot = path.resolve(import.meta.dirname, '..');
const tempRoot = await mkdtemp(path.join(os.tmpdir(), 'achados-bridge-port-'));
const catalogPath = path.join(tempRoot, 'catalog.json');
const childEnv = { ...process.env, LOCAL_CATALOG_BRIDGE_DATA: catalogPath };
delete childEnv.LOCAL_CATALOG_BRIDGE_PORT;
delete childEnv.PUBLIC_SUPABASE_URL;
delete childEnv.SUPABASE_SERVICE_ROLE_KEY;

let child;
let childStderr = '';
try {
  child = spawn(process.execPath, ['scripts/local-catalog-bridge.mjs'], {
    cwd: projectRoot,
    env: childEnv,
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true
  });
  child.stderr.on('data', (chunk) => { childStderr += chunk.toString(); });
  let output = '';
  const ready = await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error(`Bridge did not start: ${childStderr}`)), 5000);
    child.stdout.on('data', (chunk) => {
      output += chunk.toString();
      const line = output.split(/\r?\n/).find((value) => value.startsWith('{"event":"ready",'));
      if (!line) return;
      clearTimeout(timeout);
      resolve(JSON.parse(line));
    });
    child.once('error', (error) => { clearTimeout(timeout); reject(error); });
    child.once('exit', (code) => { clearTimeout(timeout); reject(new Error(`Bridge exited (${code}): ${childStderr}`)); });
  });

  assert.equal(ready.port, 6876, 'site bridge must use a port separate from the Python macro server on 6875');
  const baseUrl = `http://127.0.0.1:${ready.port}`;
  const health = await fetch(`${baseUrl}/api/health`, { signal: AbortSignal.timeout(4000) });
  assert.equal(health.status, 200);
  const extensionOrigin = `chrome-extension://${'a'.repeat(32)}`;
  const saved = await fetch(`${baseUrl}/api/save_product`, {
    method: 'POST',
    headers: { origin: extensionOrigin, 'content-type': 'application/json' },
    body: JSON.stringify({ platform: 'magalu', id: 'PORT-SMOKE', title: 'Synthetic port check', images: [] }),
    signal: AbortSignal.timeout(4000)
  });
  assert.equal(saved.status, 201);
  const catalog = JSON.parse(await readFile(catalogPath, 'utf8'));
  assert.equal(catalog.products.length, 1);
  assert.equal(catalog.products[0].id, 'PORT-SMOKE');
  console.log(JSON.stringify({ port: ready.port, health: health.status, save: saved.status, tempCatalogItems: catalog.products.length }));
} finally {
  if (child && child.exitCode === null) {
    child.kill();
    await Promise.race([new Promise((resolve) => child.once('exit', resolve)), delay(2000)]);
  }
  const resolvedTempRoot = path.resolve(os.tmpdir());
  if (path.dirname(path.resolve(tempRoot)) === resolvedTempRoot) await rm(tempRoot, { recursive: true, force: true });
}
