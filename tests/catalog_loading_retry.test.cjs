const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const page = fs.readFileSync(path.join(__dirname, '../src/pages/index.astro'), 'utf8');

test('F1: infinite catalog loading pauses after a request failure and offers manual retry', () => {
  assert.match(page, /let autoLoadEnabled = true/);
  assert.match(page, /autoLoadEnabled = false;[\s\S]*?loadMore\.textContent = 'Tentar novamente'/);
  assert.match(page, /if \(autoLoadEnabled && entries\.some\(\(entry\) => entry\.isIntersecting\)/);
  assert.match(page, /loadMore\.addEventListener\('click',[\s\S]*?autoLoadEnabled = true;[\s\S]*?void load\(false\)/);
});
