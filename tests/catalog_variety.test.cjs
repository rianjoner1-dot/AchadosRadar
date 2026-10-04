const test=require('node:test');const assert=require('node:assert/strict');
test('homepage diversity alternates product types even within one store and sector',async()=>{
 const {mixProductVariety,productVarietyKey}=await import('../src/modules/catalog/variety.js');
 const products=[...Array.from({length:15},(_,i)=>({id:`k${i}`,title:'Teclado gamer',platform:'kabum',sectors:['eletronicos']})),{id:'m',title:'Monitor',platform:'kabum',sectors:['eletronicos']},{id:'s',title:'SSD',platform:'kabum',sectors:['eletronicos']}];
 const mixed=mixProductVariety(products,()=>0.5);assert.equal(mixed.length,products.length);assert.equal(new Set(mixed.map(p=>p.id)).size,products.length);assert.equal(new Set(mixed.slice(0,3).map(productVarietyKey)).size,3);assert.deepEqual(products.map(p=>p.id).slice(0,2),['k0','k1']);
});
test('homepage highlights split electronics into distinct product types',async()=>{
 const {selectSpotlightCarouselGroups}=await import('../src/modules/catalog/spotlights.mjs');
 const products=['Teclado gamer','Monitor gamer','SSD'].map((title,i)=>({id:String(i),title,sectors:['eletronicos'],offer:{price:100,stock_status:'in_stock'}}));
 const groups=selectSpotlightCarouselGroups(products,3,5,[],true);assert.equal(groups.length,3);assert.equal(new Set(groups.map(g=>g[0].categoryKey)).size,3);
});
