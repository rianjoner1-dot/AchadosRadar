const json = (status, body) => new Response(JSON.stringify(body), {
  status,
  headers: {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'x-content-type-options': 'nosniff'
  }
});

const isUuid = (value) => typeof value === 'string'
  && /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(value);

export async function handleAdminMetrics({ request, url, key, isDemo, fetchImpl = fetch }) {
  const token = request.headers.get('authorization')?.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!token || token.length > 4096) return json(401, { error: 'Entre na sua conta para continuar.' });
  if (isDemo || !url || !key) return json(503, { error: 'Painel administrativo indisponível.' });

  try {
    const authResponse = await fetchImpl(`${url}/auth/v1/user`, {
      headers: { apikey: key, authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(5000)
    });
    if (!authResponse.ok) return json(401, { error: 'Sua sessão expirou. Entre novamente.' });
    const user = await authResponse.json();
    if (!isUuid(user?.id)) return json(401, { error: 'Sessão inválida.' });

    const daysParam = new URL(request.url).searchParams.get('days');
    const days = [7, 30, 90].includes(Number(daysParam)) ? Number(daysParam) : 30;
    const metricsResponse = await fetchImpl(`${url}/rest/v1/rpc/get_admin_product_metrics`, {
      method: 'POST',
      headers: { apikey: key, authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      body: JSON.stringify({ days_back: days }),
      signal: AbortSignal.timeout(8000), cache: 'no-store'
    });
    if (metricsResponse.status === 401 || metricsResponse.status === 403) {
      return json(403, { error: 'Esta conta não tem acesso ao painel administrativo.' });
    }
    if (!metricsResponse.ok) return json(503, { error: 'Não foi possível carregar as métricas.' });
    return json(200, await metricsResponse.json());
  } catch {
    return json(503, { error: 'Não foi possível carregar as métricas agora.' });
  }
}
