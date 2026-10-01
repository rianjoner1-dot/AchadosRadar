import { getPublicSupabaseConfig } from '../shared/config';

const config = getPublicSupabaseConfig();
const viewKeyPrefix = 'achados_radar_product_view:';
const viewsInFlight = new Set<string>();

/** Counts one product view per tab session; no visitor ID is sent or stored server-side. */
export async function recordProductView(productId: string): Promise<void> {
  if (!config.isReady || !/^[0-9a-f]{8}-[0-9a-f-]{27,}$/i.test(productId)) return;
  const key = `${viewKeyPrefix}${productId}`;
  try {
    if (sessionStorage.getItem(key)) return;
  } catch {
    // Continue without tab-level persistence when storage is unavailable.
  }
  if (viewsInFlight.has(key)) return;
  viewsInFlight.add(key);
  try {
    const response = await fetch(`${config.url}/rest/v1/rpc/record_product_metric`, {
      method: 'POST',
      headers: { apikey: config.key, authorization: `Bearer ${config.key}`, 'content-type': 'application/json' },
      body: JSON.stringify({ target_product_id: productId, metric_kind: 'view' }),
      keepalive: true,
      signal: AbortSignal.timeout(4000)
    });
    if (response.ok) {
      try { sessionStorage.setItem(key, '1'); }
      catch { /* Keep browsing when storage is unavailable. */ }
    }
  } catch {
    // Analytics failure must never interrupt catalog browsing.
  } finally {
    viewsInFlight.delete(key);
  }
}
