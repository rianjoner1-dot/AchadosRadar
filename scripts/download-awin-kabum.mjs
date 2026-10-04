import fs from 'node:fs/promises';
import path from 'node:path';
import { parseCsv } from './awin-csv.mjs';
const raw=process.env.AWIN_FEED_LIST_URL || process.argv[2];
if(!raw)throw new Error('Defina AWIN_FEED_LIST_URL ou informe a URL Feed List.');
const list=new URL(raw);
if(list.protocol!=='https:' || list.hostname!=='ui.awin.com' || list.port || list.username || list.password
  || !/^\/productdata-darwin-download\/publisher\/3105840\/[a-f0-9]+\/1\/feedList$/i.test(list.pathname))throw new Error('Feed List inválido.');
const response=await fetch(list,{redirect:'error',signal:AbortSignal.timeout(20000)});
if(!response.ok)throw new Error(`Feed List HTTP ${response.status}`);
const [headers,...rows]=parseCsv(await response.text());
const col=name=>headers.findIndex(h=>h.trim().toLowerCase()===name.toLowerCase());
const id=col('Advertiser ID'),region=col('Primary Region'),membership=col('Membership Status'),url=col('URL'),date=col('Last Imported');
if([id,region,membership,url,date].some(i=>i<0))throw new Error('Colunas do Feed List alteradas.');
const feeds=rows.filter(row=>row[id]==='17729' && /^BR$/i.test(row[region]) && /active/i.test(row[membership]));
feeds.sort((a,b)=>String(b[date]).localeCompare(String(a[date])));
if(!feeds.length)throw new Error('Sem feed KaBuM Brasil ativo.');
const download=new URL(feeds[0][url]);
if(download.protocol!=='https:' || download.port || download.username || download.password
  || !['datafeed.api.productserve.com','productdata.awin.com','datafeed.awin.com'].includes(download.hostname))throw new Error('Host de download inválido.');
const feed=await fetch(download,{redirect:'error',signal:AbortSignal.timeout(60000)});
if(!feed.ok)throw new Error(`Download HTTP ${feed.status}`);
const buffer=Buffer.from(await feed.arrayBuffer());
if(buffer.length>60*1024*1024)throw new Error('Feed excedeu 60 MB.');
const output=path.resolve('data/awin-kabum.csv.gz');await fs.mkdir(path.dirname(output),{recursive:true});
const temp=`${output}.${process.pid}.tmp`;await fs.writeFile(temp,buffer);await fs.rename(temp,output);
await fs.writeFile(`${output}.metadata.json`,JSON.stringify({merchantId:'17729',sourceLastImported:feeds[0][date],downloadedAt:new Date().toISOString(),bytes:buffer.length}));
console.log(JSON.stringify({output,bytes:buffer.length,sourceLastImported:feeds[0][date]}));
