import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const lock=path.join(root,'data/collection-background.lock');
await fs.mkdir(path.dirname(lock),{recursive:true});
let handle;
try{handle=await fs.open(lock,'wx');}catch{
 const pid=Number(await fs.readFile(lock,'utf8'));
 if(!Number.isSafeInteger(pid)||pid<1)throw new Error('Lock inválido; verificação manual necessária.');
 let alive=true;try{process.kill(pid,0);}catch(e){if(e.code==='ESRCH')alive=false;}
 if(alive)throw new Error('Já existe um coletor ativo.');
 await fs.unlink(lock);handle=await fs.open(lock,'wx');
}
await handle.writeFile(String(process.pid));
let child;
const run=script=>new Promise((resolve,reject)=>{
 child=spawn(process.execPath,['--env-file-if-exists=.env',...script],{cwd:root,stdio:'inherit',windowsHide:true});
 child.once('error',reject);child.once('exit',code=>code===0?resolve():reject(new Error(`Etapa ${script[0]} terminou com código ${code}`)));
});
let stopped=false;
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>{stopped=true;child?.kill();});
try{
 do{
  try{
   await run(['scripts/download-awin-kabum.mjs']);
   await run(['scripts/import-kabum-feed.mjs','data/awin-kabum.csv.gz']);
   // Code 1 preserves successful observations and records pending items.
   await fs.unlink(path.join(root,'data/catalogo_kabum_verified.json.batch.json')).catch(error => { if(error.code !== 'ENOENT')throw error; });
   try{await run(['scripts/collect-kabum-background.mjs','--limit=500','--concurrency=3']);}
   catch(e){console.warn(e.message);}
   if(stopped)break;
   await run(['scripts/import-catalog.mjs','data/catalogo_kabum_verified.json.batch.json','--concurrency=4','--summary']);
  }catch(e){console.error(e.message);if(process.argv.includes('--once')){process.exitCode=1;break;}}
  if(process.argv.includes('--once'))break;
  // Release to the event loop and respond promptly to shutdown signals.
  for(let second=0;second<60&&!stopped;second++)await new Promise(r=>setTimeout(r,1000));
 }while(!stopped);
}finally{await handle.close();await fs.unlink(lock);}
