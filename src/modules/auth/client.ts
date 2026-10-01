import { createClient, type User } from '@supabase/supabase-js';
import type { CartItem } from '../catalog/types';
import { cartStorageKey } from '../cart/store';
import { prepareAvatarBlob, versionAvatarUrl } from './avatar.mjs';

import { getPublicSupabaseConfig } from '../shared/config';

const { url, key, isReady } = getPublicSupabaseConfig();
export const authReady = isReady;

export const supabase = authReady ? createClient(url, key, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: 'pkce' }
}) : null;

export async function currentUser(): Promise<User | null> {
  if (!supabase) return null;
  const { data: { session }, error: sessionError } = await supabase.auth.getSession();
  if (sessionError) throw sessionError;
  if (!session) return null;
  const { data, error } = await supabase.auth.getUser();
  if (error) throw error;
  return data.user;
}

function validateRemoteCartRows(value: unknown): Array<{ product_id: string; products?: unknown }> {
  if (!Array.isArray(value)) throw new Error('Resposta inválida ao sincronizar o carrinho.');
  for (const row of value) {
    if (!row || typeof row !== 'object' || typeof row.product_id !== 'string' || !/^[0-9a-f]{8}-[0-9a-f-]{27,}$/i.test(row.product_id)) {
      throw new Error('Resposta inválida ao sincronizar o carrinho.');
    }
    const related = Array.isArray(row.products) ? row.products[0] : row.products;
    if (related == null) continue;
    if (typeof related !== 'object' || related.id !== row.product_id || !['magalu', 'mercadolivre'].includes(related.platform) || typeof related.title !== 'string' || !related.title.trim()) {
      throw new Error('Resposta inválida ao sincronizar o carrinho.');
    }
  }
  return value as Array<{ product_id: string; products?: unknown }>;
}

export async function syncCartForUser(userId: string): Promise<void> {
  return syncCartForUserAttempt(userId, 1);
}

async function syncCartForUserAttempt(userId: string, retriesOnLocalChange: number): Promise<void> {
  if (!supabase) return;
  const { data: { user: sessionUser }, error: sessionError } = await supabase.auth.getUser();
  if (sessionError) throw sessionError;
  if (sessionUser?.id !== userId) return;
  const accountKey = cartStorageKey(userId);
  const ownerKey = 'achados_radar_cart_owner';
  const guestCartKey = 'achados_radar_cart';
  const guestCartSnapshot = localStorage.getItem(guestCartKey);
  const accountCartSnapshot = localStorage.getItem(accountKey);
  const currentOwner = localStorage.getItem(ownerKey);
  const parseCart = (raw: string | null): CartItem[] => {
    try {
      const parsed = JSON.parse(raw || '[]');
      return Array.isArray(parsed) ? parsed : [];
    } catch { return []; }
  };
  const accountItems = parseCart(accountCartSnapshot);
  const incomingLocalItems = currentOwner ? [] : parseCart(guestCartSnapshot);
  const merged = new Map<string, CartItem>();
  for (const item of [...accountItems, ...incomingLocalItems]) if (item.id) merged.set(item.id, item);
  const { data: remote, error } = await supabase.from('cart_items').select('product_id,products(id,platform,title,product_images(url,display_order),offers(price,seller_name,installments_text,observed_at))').eq('user_id', userId);
  if (error) throw error;
  const remoteRows = validateRemoteCartRows(remote);
  const { data: { user: latestUser }, error: latestSessionError } = await supabase.auth.getUser();
  if (latestSessionError || latestUser?.id !== userId) return;
  if (localStorage.getItem(ownerKey) !== currentOwner
      || localStorage.getItem(guestCartKey) !== guestCartSnapshot
      || localStorage.getItem(accountKey) !== accountCartSnapshot) {
    if (retriesOnLocalChange > 0) return syncCartForUserAttempt(userId, retriesOnLocalChange - 1);
    return;
  }
  for (const row of remoteRows) {
    const product = Array.isArray(row.products) ? row.products[0] : row.products;
    if (!product || merged.has(row.product_id)) continue;
    const offer = Array.isArray(product.offers) ? product.offers.sort((a: { observed_at?: string }, b: { observed_at?: string }) => Date.parse(b.observed_at ?? '') - Date.parse(a.observed_at ?? ''))[0] : null;
    const image = Array.isArray(product.product_images) ? [...product.product_images].sort((a: { display_order: number }, b: { display_order: number }) => a.display_order - b.display_order)[0]?.url : '';
    merged.set(row.product_id, { id: row.product_id, platform: product.platform, title: product.title, price: offer?.price ?? null, priceFormatted: typeof offer?.price === 'number' ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(offer.price) : 'Preço indisponível', image: image ?? '', sellerName: offer?.seller_name ?? '', installments: offer?.installments_text ?? '' });
  }
  localStorage.setItem(accountKey, JSON.stringify([...merged.values()]));
  if (!currentOwner) localStorage.removeItem(guestCartKey);
  localStorage.setItem(ownerKey, userId);

  const productIds = [...merged.keys()].filter((id) => /^[0-9a-f]{8}-[0-9a-f-]{27,}$/i.test(id));
  if (!productIds.length) return;
  const known = new Set(remoteRows.map((row) => row.product_id));
  const toInsert = productIds.filter((productId) => !known.has(productId)).map((product_id) => ({ user_id: userId, product_id }));
  if (toInsert.length) {
    const { error: insertError } = await supabase.from('cart_items').upsert(toInsert, { onConflict: 'user_id,product_id', ignoreDuplicates: true });
    if (insertError) throw insertError;
  }
}

export async function removeRemoteCartItem(productId: string, expectedUserId?: string | null): Promise<void> {
  if (!supabase || expectedUserId === null) return;
  const user = await currentUser();
  if (!user) {
    if (expectedUserId) throw new Error('A sessão da conta mudou. Atualize a lista e tente novamente.');
    return;
  }
  const ownerId = expectedUserId ?? user.id;
  if (user.id !== ownerId) throw new Error('A sessão da conta mudou. Atualize a lista e tente novamente.');
  const { data, error } = await supabase.from('cart_items').delete().eq('user_id', ownerId).eq('product_id', productId).select('product_id');
  if (error) throw error;
  if (!data?.some((row: { product_id?: string }) => row.product_id === productId)) {
    const confirmedUser = await currentUser();
    if (confirmedUser?.id !== ownerId) throw new Error('A sessão da conta mudou. Atualize a lista e tente novamente.');
  }
}

export async function clearRemoteCart(expectedUserId?: string | null): Promise<void> {
  if (!supabase || expectedUserId === null) return;
  const user = await currentUser();
  if (!user) {
    if (expectedUserId) throw new Error('A sessão da conta mudou. Atualize a lista e tente novamente.');
    return;
  }
  const ownerId = expectedUserId ?? user.id;
  if (user.id !== ownerId) throw new Error('A sessão da conta mudou. Atualize a lista e tente novamente.');
  const { data, error } = await supabase.from('cart_items').delete().eq('user_id', ownerId).select('product_id');
  if (error) throw error;
  if (!data?.length) {
    const confirmedUser = await currentUser();
    if (confirmedUser?.id !== ownerId) throw new Error('A sessão da conta mudou. Atualize a lista e tente novamente.');
  }
}

export async function uploadAvatar(user: User, file: File): Promise<string> {
  if (!supabase) throw new Error('Supabase não está configurado.');
  const blob = await prepareAvatarBlob(file);
  const path = `${user.id}/avatar.webp`;
  const { error } = await supabase.storage.from('avatars').upload(path, blob, { contentType: 'image/webp', cacheControl: '0', upsert: true });
  if (error) throw error;
  const { data } = supabase.storage.from('avatars').getPublicUrl(path);
  return versionAvatarUrl(data.publicUrl);
}
