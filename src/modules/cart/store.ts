import type { CartItem } from '../catalog/types';
export function cartStorageKey(userId?: string | null): string {
  return userId ? `achados_radar_cart:${userId}` : 'achados_radar_cart';
}

export function activeCartStorageKey(): string {
  return cartStorageKey(localStorage.getItem('achados_radar_cart_owner'));
}

export function setCartOwner(userId?: string | null): void {
  if (!userId) {
    localStorage.removeItem('achados_radar_cart_owner');
    document.dispatchEvent(new CustomEvent('cart:changed'));
    return;
  }
  const previousOwner = localStorage.getItem('achados_radar_cart_owner');
  let accountItems: CartItem[] = [];
  try { accountItems = JSON.parse(localStorage.getItem(cartStorageKey(userId)) || '[]'); } catch { accountItems = []; }
  const merged = new Map<string, CartItem>();
  const guestItems = previousOwner ? [] : readLocalCart(null);
  for (const item of [...accountItems, ...guestItems]) if (item.id) merged.set(item.id, item);
  if (guestItems.length) {
    localStorage.setItem(cartStorageKey(userId), JSON.stringify([...merged.values()]));
    localStorage.removeItem(cartStorageKey(null));
  }
  localStorage.setItem('achados_radar_cart_owner', userId);
  document.dispatchEvent(new CustomEvent('cart:changed'));
}

export function readLocalCart(ownerId?: string | null): CartItem[] {
  try {
    const key = ownerId === undefined ? activeCartStorageKey() : cartStorageKey(ownerId);
    const value = JSON.parse(localStorage.getItem(key) || '[]');
    return Array.isArray(value) ? value : [];
  } catch { return []; }
}

export function writeLocalCart(items: CartItem[], ownerId?: string | null): void {
  const key = ownerId === undefined ? activeCartStorageKey() : cartStorageKey(ownerId);
  localStorage.setItem(key, JSON.stringify(items));
  document.dispatchEvent(new CustomEvent('cart:changed'));
}

export function saveCartItem(item: CartItem): boolean {
  const cart = readLocalCart();
  if (cart.some((saved) => saved.id === item.id)) return false;
  writeLocalCart([...cart, { ...item, savedAt: new Date().toISOString() }]);
  return true;
}

export function removeCartItem(id: string, ownerId?: string | null): void {
  writeLocalCart(readLocalCart(ownerId).filter((item) => item.id !== id), ownerId);
}

export function removeCartItemSnapshot(snapshot: Pick<CartItem, 'id' | 'savedAt'>, ownerId?: string | null): boolean {
  const items = readLocalCart(ownerId);
  const remaining = items.filter((item) => item.id !== snapshot.id || item.savedAt !== snapshot.savedAt);
  if (remaining.length === items.length) return false;
  writeLocalCart(remaining, ownerId);
  return true;
}

export function removeCartItems(snapshot: Pick<CartItem, 'id' | 'savedAt'>[], ownerId?: string | null): void {
  if (!snapshot.length) return;
  const savedItems = new Map(snapshot.map((item) => [item.id, item.savedAt]));
  writeLocalCart(readLocalCart(ownerId).filter((item) =>
    !savedItems.has(item.id) || savedItems.get(item.id) !== item.savedAt
  ), ownerId);
}

export function clearLocalCart(ownerId?: string | null): void { writeLocalCart([], ownerId); }

export function deleteLocalCartForUser(userId: string): void {
  if (!userId) return;
  localStorage.removeItem(cartStorageKey(userId));
  document.dispatchEvent(new CustomEvent('cart:changed'));
}

export function updateCartBadge(ownerId?: string | null): void {
  const badge = document.getElementById('headerCartCount');
  if (badge) {
    const count = readLocalCart(ownerId).length;
    badge.textContent = String(count);
    badge.setAttribute('aria-label', `${count} itens salvos na lista`);
  }
}
