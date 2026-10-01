const test = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const path = require('node:path');

test('backend integration refuses any project other than the configured development Supabase before creating clients', () => {
  const script = path.join(__dirname, '../scripts/backend-auth-integration.mjs');
  const result = spawnSync(process.execPath, [script], {
    encoding: 'utf8',
    env: {
      ...process.env,
      PUBLIC_SUPABASE_URL: 'https://unrelated-project.supabase.co',
      PUBLIC_SUPABASE_ANON_KEY: 'test-anon-key',
      SUPABASE_SERVICE_ROLE_KEY: 'test-service-key',
      SUPABASE_PROJECT_REF: 'unrelated-project'
    }
  });

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /só pode acessar o projeto Supabase de desenvolvimento/);
  assert.equal(result.stdout, '');
});
