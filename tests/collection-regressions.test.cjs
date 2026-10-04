const test=require('node:test'); const assert=require('node:assert/strict');
test('pagination preserves a partial page and advances beyond hidden images',async()=>{
 const {attachCatalogPageProgress,getCatalogPageProgress}=await import('../src/modules/catalog/page-progress.js');
 const source=Array.from({length:20},(_,i)=>({id:String(i),created_at:'2026-10-04',offer:{price:i}}));
 const hidden=attachCatalogPageProgress([],source,20);
 assert.equal(getCatalogPageProgress(hidden,20).exhausted,false);
 assert.equal(getCatalogPageProgress(hidden,20).cursor.id,'19');
 assert.equal(getCatalogPageProgress(source.slice(0,3),20).exhausted,true);
});
test('CSV supports multiline descriptions, escaped quotes and rejects truncated files',async()=>{
 const {parseCsv}=await import('../scripts/awin-csv.mjs');
 assert.deepEqual(parseCsv('id,description\r\n1,"line 1\nline ""2"""\r\n'),[['id','description'],['1','line 1\nline "2"']]);
 assert.throws(()=>parseCsv('id\n"broken'),/incompleto/);
});
test('collection queue isolates failures and bounds active requests',async()=>{
 const {runCollectionPool}=await import('../scripts/collection-pool.mjs'); let active=0,max=0; const results=[];
 await runCollectionPool([0,1,2,3,4],2,async n=>{active++;max=Math.max(max,active);await new Promise(r=>setTimeout(r,5));active--;if(n===2)throw Error('offline');return n;},r=>results.push(r));
 assert.equal(max,2);assert.equal(results.length,5);assert.equal(results.filter(r=>r.ok).length,4);
});
test('Awin rejects wrong merchant, publisher, nested destination and nonstandard ports',async()=>{
 const {isAllowedAffiliateUrl}=await import('../src/modules/outbound/allowlist.mjs');
 const url=new URL('https://www.awin1.com/cread.php');url.search=new URLSearchParams({awinmid:'17729',awinaffid:'3105840',ued:'https://www.kabum.com.br/produto/123/item'});
 assert.equal(isAllowedAffiliateUrl('kabum',url.href),true);
 for(const [key,value] of [['awinmid','79974'],['awinaffid','1'],['ued','https://evil.test/produto/123']]){const bad=new URL(url);bad.searchParams.set(key,value);assert.equal(isAllowedAffiliateUrl('kabum',bad.href),false);}
 url.port='444';assert.equal(isAllowedAffiliateUrl('kabum',url.href),false);
});
test('Kabum background extraction validates SKU and never fabricates installments',async()=>{
 const {extractKabumPage}=await import('../scripts/kabum-page.mjs');
 const p={id:123,title:'SSD',available:true,prices:{priceWithDiscount:90,price:100,oldPrice:120},medias:[{type:'image',images:{gg:'https://images.kabum.com.br/produtos/fotos/123/ssd.jpg'}}]};
 const html=`<script id="__NEXT_DATA__">${JSON.stringify({props:{pageProps:{product:p}}})}</script>`;
 const source={id:'123',originalUrl:'https://www.kabum.com.br/produto/123/ssd'};
 const result=extractKabumPage(html,source);assert.equal(result.price,90);assert.equal(result.cardPrice,100);assert.equal(result.installments,null);assert.equal(result.stockStatus,'in_stock');
 assert.throws(()=>extractKabumPage(html,{...source,id:'124'}),/Identidade/);
 assert.throws(()=>extractKabumPage('<html>Robot check</html>',source),/estruturados/);
});
