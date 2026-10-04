import fs from 'node:fs';

const raw = JSON.parse(fs.readFileSync('data/catalogo_macro.json', 'utf8'));
const cat = raw.products || [];
console.log('Total products in catalogo_macro.json:', cat.length);

const statuses = {};
const platforms = {};
const unavailableProducts = [];

cat.forEach((p, idx) => {
  const plat = p.platform || p.store || 'unknown';
  platforms[plat] = (platforms[plat] || 0) + 1;
  const ls = p.link?.status || (p.affiliate_link ? 'has_affiliate_link' : 'no_link');
  statuses[ls] = (statuses[ls] || 0) + 1;
  
  if (p.link?.status && p.link.status !== 'active') {
    unavailableProducts.push({
      idx,
      title: p.title || p.product_name,
      platform: plat,
      url: p.canonical_url || p.url,
      linkStatus: p.link.status,
      linkReason: p.link.status_reason || ''
    });
  }
});

console.log('Platforms:', platforms);
console.log('Link Statuses:', statuses);
console.log('Unavailable products count:', unavailableProducts.length);
if (unavailableProducts.length > 0) {
  console.log('Sample unavailable:', JSON.stringify(unavailableProducts.slice(0, 5), null, 2));
}
