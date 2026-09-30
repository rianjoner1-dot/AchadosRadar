import type { CartItem } from '../catalog/types';
export function cartStorageKey(userId?: string | null): string {
  return userId ? `achados_radar_cart:${userId}` : 'achados_radar_cart';
}

export function activeCartStorageKey(): string {
  return cartStorageKey(localStorage.getItem('achados_radar_cart_owner'));
}

export function readLocalCart(): CartItem[] {
  try {
    const value = JSON.parse(localStorage.getItem(activeCartStorageKey()) || '[]');
    return Array.isArray(value) ? value : [];
  } catch { return []; }
}

export function writeLocalCart(items: CartItem[]): void {
  localStorage.setItem(activeCartStorageKey(), JSON.stringify(items));
  document.dispatchEvent(new CustomEvent('cart:changed'));
}

export function saveCartItem(item: CartItem): boolean {
  const cart = readLocalCart();
  if (cart.some((saved) => saved.id === item.id)) return false;
  writeLocalCart([...cart, { ...item, savedAt: new Date().toISOString() }]);
  return true;
}

export function removeCartItem(id: string): void {
  writeLocalCart(readLocalCart().filter((item) => item.id !== id));
}

export function clearLocalCart(): void { writeLocalCart([]); }

export function updateCartBadge(): void {
  const badge = document.getElementById('headerCartCount');
  if (badge) {
    const count = readLocalCart().length;
    badge.textContent = String(count);
    badge.setAttribute('aria-label', `${count} itens salvos na lista`);
  }
}
