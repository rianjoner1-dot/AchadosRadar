const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const projectRoot = path.resolve(__dirname, '..');
const migrationDirectory = path.join(projectRoot, 'supabase/migrations');
const verifierPath = path.join(projectRoot, 'scripts/verify-remote-schema.sql');

test('read-only remote schema verifier lists every local migration exactly once', () => {
  const localVersions = fs.readdirSync(migrationDirectory)
    .filter((name) => name.endsWith('.sql'))
    .map((name) => name.match(/^(\d{14})_.+\.sql$/)?.[1])
    .filter(Boolean)
    .sort();
  const verifier = fs.readFileSync(verifierPath, 'utf8');
  const listedVersions = [...verifier.matchAll(/'([0-9]{14})'/g)].map((match) => match[1]).sort();
  const expectedCount = Number(verifier.match(/SELECT count\(\*\)\s*=\s*(\d+)/i)?.[1]);

  assert.ok(localVersions.length > 0, 'local migrations must exist');
  assert.equal(new Set(listedVersions).size, listedVersions.length, 'the verifier must not count one version twice');
  assert.deepEqual(listedVersions, localVersions, 'the read-only remote audit must detect every local migration');
  assert.equal(expectedCount, localVersions.length, 'the remote count must match the local migration inventory');
});
