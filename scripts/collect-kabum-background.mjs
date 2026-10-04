import fs from 'node:fs/promises';
import path from 'node:path';
import { runCollectionPool } from './collection-pool.mjs';
import { extractKabumPage } from './kabum-page.mjs';

const arg = name => process.argv.find(value => value.startsWith(`--${name}=`))?.split('=').slice(1).join('=');
const input=arg('input') || 'data/catalogo_awin_kabum.json';
const output=arg('output') || 'data/catalogo_kabum_verified.json';
const limit=Number(arg('limit') || 500);
const concurrency=Number(arg('concurrency') || 3);
if (!Number.isSafeInteger(limit) || limit < 1) throw new Error('Limite inválido.');
const source=JSON.parse(await fs.readFile(input,'utf8'));
let saved; try { saved=JSON.parse(await fs.readFile(output,'utf8')); } catch(e) { if(e.code !== 'ENOENT') throw e; saved={products:[],failures:[]}; }
const products=new Map(saved.products.map(item => [String(item.id),item]));
const candidates=source.products.filter(item => item.platform === 'kabum'
  && !(Date.parse(products.get(String(item.id))?.offerObservedAt) > Date.now()-6*3600*1000)).slice(0,limit);
const failures=[], batch=[]; const started=Date.now(); let succeeded=0, failed=0, checkpoint=Promise.resolve();
const checkpointFile = async () => {
  await fs.mkdir(path.dirname(output),{recursive:true});
  const temp=`${output}.${process.pid}.tmp`;
  await fs.writeFile(temp,JSON.stringify({updatedAt:new Date().toISOString(),products:[...products.values()],failures}));
  await fs.rename(temp,output);
  const batchTemp=`${output}.batch.${process.pid}.tmp`;
  await fs.writeFile(batchTemp,JSON.stringify({products:batch,updatedAt:new Date().toISOString()}));
  await fs.rename(batchTemp,`${output}.batch.json`);
};
await runCollectionPool(candidates,concurrency,async item => {
  const url=new URL(item.originalUrl);
  if(url.protocol !== 'https:' || url.port || url.username || url.password || !['www.kabum.com.br','kabum.com.br'].includes(url.hostname)
    || url.pathname.match(/^\/produto\/(\d+)(?:\/|$)/)?.[1] !== String(item.id)) throw new Error('URL/identidade inválida.');
  const response=await fetch(url,{redirect:'error',signal:AbortSignal.timeout(15000)});
  if(!response.ok) throw new Error(`HTTP ${response.status}; item mantido pendente.`);
  return extractKabumPage(await response.text(),item);
},async result => {
  if(result.ok){products.set(String(result.value.id),result.value);batch.push(result.value);succeeded++;}
  else{failed++;failures.push({id:candidates[result.index].id,error:result.error,at:new Date().toISOString()});}
  if((succeeded+failed)%25===0){checkpoint=checkpoint.then(checkpointFile);await checkpoint;console.log(JSON.stringify({processed:succeeded+failed,succeeded,failed}));}
});
await checkpoint; await checkpointFile();
console.log(JSON.stringify({processed:candidates.length,succeeded,failed,seconds:Math.round((Date.now()-started)/1000),output}));
if(failed)process.exitCode=1;
