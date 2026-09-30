// src/modules/shared/config.ts
// Configuração pública do catálogo e autenticação Supabase para cliente e SSR.
// NUNCA incluir chaves privadas (service_role ou secret_key) neste módulo.

export const DEFAULT_SUPABASE_URL = 'https://rvepsyvhsqumfpemhbba.supabase.co';
export const DEFAULT_SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ2ZXBzeXZoc3F1bWZwZW1oYmJhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTA3MzQ5MDEsImV4cCI6MjEwNjMxMDkwMX0.rdrULPRxlDhMq0x8vP1Dhf-FKVp40D5rOUeuKhSo4ww';

export function getPublicSupabaseConfig() {
  const isDemo = import.meta.env?.PUBLIC_CATALOG_DEMO === 'true';
  const rawUrl = (import.meta.env?.PUBLIC_SUPABASE_URL || DEFAULT_SUPABASE_URL) as string;
  const url = rawUrl.replace(/\/$/, '');
  const key = (import.meta.env?.PUBLIC_SUPABASE_ANON_KEY || DEFAULT_SUPABASE_ANON_KEY) as string;
  return {
    url,
    key,
    isDemo,
    isReady: !isDemo && Boolean(url && key)
  };
}
