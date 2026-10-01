import type { APIRoute } from 'astro';
import { getPublicSupabaseConfig } from '../../../modules/shared/config';
import { deleteSupabaseAccount } from '../../../modules/auth/account-deletion.js';
export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
  const { url, key: anonKey, isDemo } = getPublicSupabaseConfig();
  const serviceKey = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env?.SUPABASE_SERVICE_ROLE_KEY;
  if (isDemo) return new Response('Modo de demonstração: exclusão remota desativada.', { status: 503, headers: { 'cache-control': 'no-store' } });
  return deleteSupabaseAccount({ request, url, anonKey, serviceKey });
};
