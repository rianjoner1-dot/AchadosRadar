const test = require('node:test');
const assert = require('node:assert/strict');

test('account deletion rejects an invalid session before privileged requests', async () => {
  const { deleteSupabaseAccount } = await import('../src/modules/auth/account-deletion.js');
  const calls = [];
  const response = await deleteSupabaseAccount({
    request: new Request('https://site.test/api/account/delete', { method: 'POST', headers: { authorization: 'Bearer expired-token' } }),
    url: 'https://project.supabase.co', anonKey: 'public-anon', serviceKey: 'server-only',
    fetchImpl: async (url, init) => { calls.push({ url, init }); return new Response('', { status: 401 }); }
  });

  assert.equal(response.status, 401);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, 'https://project.supabase.co/auth/v1/user');
  assert.equal(calls[0].init.headers.authorization, 'Bearer expired-token');
});

test('valid account deletion removes only that user avatar before the Auth user', async () => {
  const { deleteSupabaseAccount } = await import('../src/modules/auth/account-deletion.js');
  const calls = [];
  const response = await deleteSupabaseAccount({
    request: new Request('https://site.test/api/account/delete', { method: 'POST', headers: { authorization: 'Bearer valid-token' } }),
    url: 'https://project.supabase.co', anonKey: 'public-anon', serviceKey: 'server-only',
    fetchImpl: async (url, init = {}) => {
      calls.push({ url, init });
      if (url.endsWith('/auth/v1/user')) return Response.json({ id: 'user/with odd chars' });
      if (url.endsWith('/storage/v1/object/avatars')) return new Response(null, { status: 404 });
      if (url.endsWith('/auth/v1/admin/users/user%2Fwith%20odd%20chars')) return new Response(null, { status: 204 });
      return new Response('unexpected request', { status: 500 });
    }
  });

  assert.equal(response.status, 204);
  assert.equal(calls.length, 3);
  assert.deepEqual(JSON.parse(calls[1].init.body), { prefixes: ['user/with odd chars/avatar.webp'] });
  assert.equal(calls[1].init.headers.authorization, 'Bearer server-only');
  assert.equal(calls[2].url, 'https://project.supabase.co/auth/v1/admin/users/user%2Fwith%20odd%20chars');
  assert.equal(calls[2].init.headers.authorization, 'Bearer server-only');
});

test('avatar cleanup failure prevents deleting the Auth user', async () => {
  const { deleteSupabaseAccount } = await import('../src/modules/auth/account-deletion.js');
  const calls = [];
  const response = await deleteSupabaseAccount({
    request: new Request('https://site.test/api/account/delete', { method: 'POST', headers: { authorization: 'Bearer valid-token' } }),
    url: 'https://project.supabase.co', anonKey: 'public-anon', serviceKey: 'server-only',
    fetchImpl: async (url) => {
      calls.push(url);
      if (url.endsWith('/auth/v1/user')) return Response.json({ id: 'user-123' });
      return new Response('storage unavailable', { status: 500 });
    }
  });

  assert.equal(response.status, 502);
  assert.equal(calls.length, 2);
  assert.equal(calls.some((url) => url.includes('/auth/v1/admin/users/')), false);
});

test('account deletion is unavailable when server configuration is incomplete', async () => {
  const { deleteSupabaseAccount } = await import('../src/modules/auth/account-deletion.js');
  let requests = 0;
  const response = await deleteSupabaseAccount({
    request: new Request('https://site.test/api/account/delete', { method: 'POST', headers: { authorization: 'Bearer valid-token' } }),
    url: 'https://project.supabase.co', anonKey: 'public-anon', serviceKey: '',
    fetchImpl: async () => { requests += 1; return Response.json({ id: 'user-123' }); }
  });

  assert.equal(response.status, 503);
  assert.equal(requests, 0);
});

test('account deletion rejects a missing bearer token without contacting Supabase', async () => {
  const { deleteSupabaseAccount } = await import('../src/modules/auth/account-deletion.js');
  let requests = 0;
  const response = await deleteSupabaseAccount({
    request: new Request('https://site.test/api/account/delete', { method: 'POST' }),
    url: 'https://project.supabase.co', anonKey: 'public-anon', serviceKey: 'server-only',
    fetchImpl: async () => { requests += 1; return new Response(null, { status: 200 }); }
  });

  assert.equal(response.status, 401);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.equal(requests, 0);
});

test('account deletion can safely retry after avatar removal but Auth deletion failure', async () => {
  const { deleteSupabaseAccount } = await import('../src/modules/auth/account-deletion.js');
  let avatarExists = true;
  let authDeleteAttempts = 0;
  const fetchImpl = async (url) => {
    if (url.endsWith('/auth/v1/user')) return Response.json({ id: 'user-123' });
    if (url.endsWith('/storage/v1/object/avatars')) {
      const existed = avatarExists;
      avatarExists = false;
      return new Response(null, { status: existed ? 200 : 404 });
    }
    if (url.endsWith('/auth/v1/admin/users/user-123')) {
      authDeleteAttempts += 1;
      return authDeleteAttempts === 1 ? new Response('temporary failure', { status: 500 }) : new Response(null, { status: 204 });
    }
    return new Response('unexpected request', { status: 500 });
  };

  const first = await deleteSupabaseAccount({
    request: new Request('https://site.test/api/account/delete', { method: 'POST', headers: { authorization: 'Bearer valid-token' } }),
    url: 'https://project.supabase.co', anonKey: 'public-anon', serviceKey: 'server-only', fetchImpl
  });
  assert.equal(first.status, 502, 'do not report success until Auth confirms deletion');
  const retry = await deleteSupabaseAccount({
    request: new Request('https://site.test/api/account/delete', { method: 'POST', headers: { authorization: 'Bearer valid-token' } }),
    url: 'https://project.supabase.co', anonKey: 'public-anon', serviceKey: 'server-only', fetchImpl
  });
  assert.equal(retry.status, 204, 'a missing avatar is an idempotent cleanup result on retry');
  assert.equal(authDeleteAttempts, 2);
});
