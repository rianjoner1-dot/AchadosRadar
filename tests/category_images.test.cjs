const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const page = fs.readFileSync(path.join(root, 'src/pages/index.astro'), 'utf8');
const categoryMap = page.match(/const fixedCategoryImages:[\s\S]*?=\s*\{([\s\S]*?)\n\s*\};/)?.[1] ?? '';
const imageEntries = [...categoryMap.matchAll(/'?([\w-]+)'?\s*:\s*'([^']+)'/g)];
const imagePaths = new Map(imageEntries.map((match) => [match[1], match[2]]));
const buttons = [...page.matchAll(/<button[^>]*class="sector-btn"[^>]*data-sector="([^"]*)"[^>]*>([\s\S]*?)<\/button>/g)]
  .map(([, sector, body]) => {
    const image = body.match(/<img\b([^>]*)data-sector-image="([^"]+)"([^>]*)>/);
    return image ? [sector, image[1], image[2], image[3]] : null;
  })
  .filter(Boolean);

test('every illustrated category loads its fixed local image without hidden lazy-load gating', () => {
  assert.equal(buttons.length, 10, 'all product categories should have an image (the all-products tile uses its icon)');
  for (const [sector, before, imageKey, after] of buttons) {
    const source = imagePaths.get(sector);
    assert.equal(imageKey, sector, `the ${sector} button and image key should match`);
    assert.ok(source, `the ${sector} category should map to a local asset`);
    assert.ok(fs.existsSync(path.join(root, 'public', source.replace(/^\//, ''))), `${source} should exist`);
    assert.doesNotMatch(`${before}${after}`, /\bhidden\b|loading="lazy"/, `${sector} must be allowed to load immediately`);
  }
});

test('the appliance category displays its full name while keeping the existing filter key', () => {
  assert.match(page, /data-sector="eletro"[^>]*>[\s\S]*?sector-tile-label">Eletrodomésticos/);
});
