import type { APIRoute } from 'astro';
export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
  const accessToken = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  const url = import.meta.env.PUBLIC_SUPABASE_URL?.replace(/\/$/, '');
  const anonKey = import.meta.env.PUBLIC_SUPABASE_ANON_KEY;
  const serviceKey = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env?.SUPABASE_SERVICE_ROLE_KEY;
  if (!accessToken || !url || !anonKey || !serviceKey) return new Response('Not configured', { status: 503 });
  try {
    const userResponse = await fetch(`${url}/auth/v1/user`, { headers: { apikey: anonKey, authorization: `Bearer ${accessToken}` }, signal: AbortSignal.timeout(5000) });
    if (!userResponse.ok) return new Response('Unauthorized', { status: 401 });
    const user = await userResponse.json();
    if (!user.id) return new Response('Unauthorized', { status: 401 });
    const avatarDelete = await fetch(`${url}/storage/v1/object/avatars`, {
      method: 'DELETE', headers: { apikey: serviceKey, authorization: `Bearer ${serviceKey}`, 'content-type': 'application/json' },
      body: JSON.stringify({ prefixes: [`${user.id}/avatar.webp`] }), signal: AbortSignal.timeout(5000)
    });
    if (!avatarDelete.ok && avatarDelete.status !== 404) return new Response('Avatar delete failed', { status: 502 });
    const deleteResponse = await fetch(`${url}/auth/v1/admin/users/${encodeURIComponent(user.id)}`, {
      method: 'DELETE', headers: { apikey: serviceKey, authorization: `Bearer ${serviceKey}` }, signal: AbortSignal.timeout(5000)
    });
    if (!deleteResponse.ok) return new Response('Delete failed', { status: 502 });
    return new Response(null, { status: 204, headers: { 'cache-control': 'no-store' } });
  } catch { return new Response('Delete unavailable', { status: 503 }); }
};
