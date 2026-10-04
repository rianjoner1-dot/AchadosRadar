import fs from 'node:fs/promises';
import path from 'node:path';
import { runCollectionPool } from './collection-pool.mjs';
import { extractKabumPage } from './kabum-page.mjs';
import { fetchKabumProduct } from './kabum-fetch.mjs';

const arg = name => process.argv.find(value => value.startsWith(`--${name}=`))?.split('=').slice(1).join('=');
const input=arg('input') || 'data/catalogo_awin_kabum.json';
const output=arg('output') || 'data/catalogo_kabum_verified.json';
const limit=Number(arg('limit') || 500);
const concurrency=Number(arg('concurrency') || 3);
if (!Number.isSafeInteger(limit) || limit < 1) throw new Error('Limite inválido.');
const source=JSON.parse(await fs.readFile(input,'utf8'));
let saved; try { saved=JSON.parse(await fs.readFile(output,'utf8')); } catch(e) { if(e.code !== 'ENOENT') throw e; saved={products:[],failures:[]}; }
const products=new Map(saved.products.map(item => [String(item.id),item]));
const existingFailures = new Map((saved.failures || []).map(f => [String(f.id), f]));
const candidates=source.products.filter(item => item.platform === 'kabum'
  && !(Date.parse(existingFailures.get(String(item.id))?.nextRetryAt) > Date.now())
  && !(Date.parse(products.get(String(item.id))?.offerObservedAt) > Date.now()-6*3600*1000)).slice(0,limit);
let pending; try { pending=JSON.parse(await fs.readFile(`${output}.batch.json`,'utf8')).products; } catch(e) { if(e.code !== 'ENOENT') throw e; pending=[]; }
const batch = new Map(pending.map(item => [String(item.id), item]));
const started = Date.now(); let succeeded = 0, failed = 0, checkpoint = Promise.resolve(), circuitOpen = false;

const checkpointFile = async () => {
  await fs.mkdir(path.dirname(output), { recursive: true });
  const temp = `${output}.${process.pid}.tmp`;
  const snapshot = JSON.stringify({ updatedAt: new Date().toISOString(), products: [...products.values()], failures: [...existingFailures.values()] });
  const batchTemp = `${output}.batch.${process.pid}.tmp`;
  await fs.writeFile(batchTemp, JSON.stringify({ products: [...batch.values()], updatedAt: new Date().toISOString() }));
  await fs.rename(batchTemp, `${output}.batch.json`);
  await fs.writeFile(temp, snapshot);
  await fs.rename(temp, output);
};

try {
await runCollectionPool(candidates, concurrency, async item => {
  const response = await fetchKabumProduct(item);
  return extractKabumPage(response.html, item, new Date().toISOString(), response.url);
}, async result => {
  const item = candidates[result.index];
  const itemId = String(item.id);
  if (result.ok) {
    products.set(itemId, result.value);
    batch.set(itemId, result.value);
    succeeded++;
    existingFailures.delete(itemId);
  } else {
    failed++;
    const prev = existingFailures.get(itemId);
    const retryCount = (prev?.retryCount || 0) + 1;
    existingFailures.set(itemId, {
      id: itemId,
      error: result.error,
      retryCount,
      firstFailedAt: prev?.firstFailedAt || new Date().toISOString(),
      lastFailedAt: new Date().toISOString(),
      nextRetryAt: new Date(Date.now() + Math.min(24 * 3600000, 60000 * 2 ** Math.min(retryCount, 10))).toISOString()
    });
  }

  const processed = succeeded + failed;
  circuitOpen ||= processed >= 30 && failed / processed > 0.6;
  if (processed % 25 === 0) {
    checkpoint = checkpoint.then(checkpointFile);
    await checkpoint;
    console.log(JSON.stringify({ processed, succeeded, failed }));

    // Circuit breaker: se mais de 60% falhar após 30 produtos, interrompe
  }
}, { shouldStop: () => circuitOpen });
} finally {
await checkpoint;
await checkpointFile();
}
console.log(JSON.stringify({ processed: succeeded + failed, succeeded, failed, circuitOpen, seconds: Math.round((Date.now() - started) / 1000), output }));
if (failed) process.exitCode = 1;

