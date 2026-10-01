import type { APIRoute } from 'astro';
import { handleAdminMetrics } from '../../../modules/analytics/admin-metrics-handler.mjs';
import { getPublicSupabaseConfig } from '../../../modules/shared/config';

export const prerender = false;

export const GET: APIRoute = async ({ request }) => {
  return handleAdminMetrics({ request, ...getPublicSupabaseConfig() });
};
