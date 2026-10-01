const privateResponse = (body, status) => new Response(body, { status, headers: { 'cache-control': 'no-store' } });

export async function deleteSupabaseAccount({ request, url, anonKey, serviceKey, fetchImpl = fetch }) {
  const accessToken = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  if (!url || !anonKey || !serviceKey) return privateResponse('Not configured', 503);
  if (!accessToken) return privateResponse('Unauthorized', 401);

  try {
    const userResponse = await fetchImpl(`${url}/auth/v1/user`, {
      headers: { apikey: anonKey, authorization: `Bearer ${accessToken}` },
      signal: AbortSignal.timeout(5000)
    });
    if (!userResponse.ok) return privateResponse('Unauthorized', 401);
    const user = await userResponse.json();
    if (!user.id) return privateResponse('Unauthorized', 401);

    const avatarDelete = await fetchImpl(`${url}/storage/v1/object/avatars`, {
      method: 'DELETE',
      headers: { apikey: serviceKey, authorization: `Bearer ${serviceKey}`, 'content-type': 'application/json' },
      body: JSON.stringify({ prefixes: [`${user.id}/avatar.webp`] }),
      signal: AbortSignal.timeout(5000)
    });
    if (!avatarDelete.ok && avatarDelete.status !== 404) return privateResponse('Avatar delete failed', 502);

    const deleteResponse = await fetchImpl(`${url}/auth/v1/admin/users/${encodeURIComponent(user.id)}`, {
      method: 'DELETE', headers: { apikey: serviceKey, authorization: `Bearer ${serviceKey}` }, signal: AbortSignal.timeout(5000)
    });
    if (!deleteResponse.ok) return privateResponse('Delete failed', 502);
    return privateResponse(null, 204);
  } catch {
    return privateResponse('Delete unavailable', 503);
  }
}
