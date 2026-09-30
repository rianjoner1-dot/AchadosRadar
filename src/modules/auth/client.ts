import { createClient, type User } from '@supabase/supabase-js';
import type { CartItem } from '../catalog/types';
import { cartStorageKey, readLocalCart } from '../cart/store';

const url = import.meta.env.PUBLIC_SUPABASE_URL;
const key = import.meta.env.PUBLIC_SUPABASE_ANON_KEY;
export const authReady = Boolean(url && key);

export const supabase = authReady ? createClient(url!, key!, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: 'pkce' }
}) : null;

export async function currentUser(): Promise<User | null> {
  if (!supabase) return null;
  const { data, error } = await supabase.auth.getUser();
  if (error) return null;
  return data.user;
}

export async function syncCartForUser(userId: string): Promise<void> {
  if (!supabase) return;
  const accountKey = cartStorageKey(userId);
  const currentOwner = localStorage.getItem('achados_radar_cart_owner');
  const incomingLocalItems = !currentOwner || currentOwner === userId ? readLocalCart() : [];
  let accountItems: CartItem[] = [];
  try { accountItems = JSON.parse(localStorage.getItem(accountKey) || '[]'); } catch { accountItems = []; }
  const merged = new Map<string, CartItem>();
  for (const item of [...accountItems, ...incomingLocalItems]) if (item.id) merged.set(item.id, item);
  const { data: remote, error } = await supabase.from('cart_items').select('product_id,products(id,platform,title,product_images(url,display_order),offers(price,seller_name,installments_text,observed_at))').eq('user_id', userId);
  if (error) throw error;
  for (const row of remote ?? []) {
    const product = Array.isArray(row.products) ? row.products[0] : row.products;
    if (!product || merged.has(row.product_id)) continue;
    const offer = Array.isArray(product.offers) ? product.offers.sort((a: { observed_at?: string }, b: { observed_at?: string }) => Date.parse(b.observed_at ?? '') - Date.parse(a.observed_at ?? ''))[0] : null;
    const image = Array.isArray(product.product_images) ? [...product.product_images].sort((a: { display_order: number }, b: { display_order: number }) => a.display_order - b.display_order)[0]?.url : '';
    merged.set(row.product_id, { id: row.product_id, platform: product.platform, title: product.title, price: offer?.price ?? null, priceFormatted: typeof offer?.price === 'number' ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(offer.price) : 'Preço indisponível', image: image ?? '', sellerName: offer?.seller_name ?? '', installments: offer?.installments_text ?? '' });
  }
  localStorage.setItem(accountKey, JSON.stringify([...merged.values()]));
  localStorage.removeItem('achados_radar_cart');
  localStorage.setItem('achados_radar_cart_owner', userId);

  const productIds = [...merged.keys()].filter((id) => /^[0-9a-f]{8}-[0-9a-f-]{27,}$/i.test(id));
  if (!productIds.length) return;
  const known = new Set((remote ?? []).map((row) => row.product_id));
  const toInsert = productIds.filter((productId) => !known.has(productId)).map((product_id) => ({ user_id: userId, product_id }));
  if (toInsert.length) {
    const { error: insertError } = await supabase.from('cart_items').upsert(toInsert, { onConflict: 'user_id,product_id', ignoreDuplicates: true });
    if (insertError) throw insertError;
  }
}

export async function removeRemoteCartItem(productId: string): Promise<void> {
  if (!supabase) return;
  const user = await currentUser();
  if (!user) return;
  const { error } = await supabase.from('cart_items').delete().eq('user_id', user.id).eq('product_id', productId);
  if (error) throw error;
}

export async function clearRemoteCart(): Promise<void> {
  if (!supabase) return;
  const user = await currentUser();
  if (!user) return;
  const { error } = await supabase.from('cart_items').delete().eq('user_id', user.id);
  if (error) throw error;
}

export async function uploadAvatar(user: User, file: File): Promise<string> {
  if (!supabase) throw new Error('Supabase não está configurado.');
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 5 * 1024 * 1024) throw new Error('Escolha uma foto JPEG, PNG ou WebP com até 5 MB.');
  const image = await createImageBitmap(file);
  const scale = Math.min(1, 512 / Math.max(image.width, image.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(image.width * scale);
  canvas.height = Math.round(image.height * scale);
  canvas.getContext('2d')!.drawImage(image, 0, 0, canvas.width, canvas.height);
  image.close();
  const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob((result) => result ? resolve(result) : reject(new Error('Não foi possível processar a foto.')), 'image/webp', .78));
  if (blob.size > 100 * 1024) throw new Error('A foto otimizada precisa ficar abaixo de 100 KB. Tente uma imagem menor.');
  const path = `${user.id}/avatar.webp`;
  const { error } = await supabase.storage.from('avatars').upload(path, blob, { contentType: 'image/webp', upsert: true });
  if (error) throw error;
  const { data } = supabase.storage.from('avatars').getPublicUrl(path);
  return data.publicUrl;
}
