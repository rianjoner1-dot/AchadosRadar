import type { APIRoute } from 'astro';
import { handleAffiliateRedirect } from '../../../modules/outbound/redirect-handler.mjs';

import { getPublicSupabaseConfig } from '../../../modules/shared/config';

export const prerender = false;
export const GET: APIRoute = async ({ params }) => {
  const { url, key, isDemo } = getPublicSupabaseConfig();
  if (isDemo) return new Response(JSON.stringify({ message: 'Modo de demonstração: compras estão desativadas.' }), { status: 503, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } });
  return handleAffiliateRedirect({ id: params.id, url, key });
};
