// src/modules/catalog/types.ts

export type PlatformType = 'mercadolivre' | 'magalu';

export interface Product {
  id: string;
  platform: PlatformType;
  title: string;
  price: number;
  priceFormatted: string;
  oldPrice?: number | null;
  oldPriceFormatted?: string;
  discountPercent?: string;
  sellerName?: string;
  sellerId?: string;
  storeName?: string;
  storeAffiliateId?: string;
  image: string;
  shipping?: string;
  installments?: string;
  coupon?: string;
  stockQuantity?: number | null;
  stockStatus?: 'in_stock' | 'out_of_stock' | 'unknown';
  url?: string;
}

export interface CartItem {
  id: string;
  platform: PlatformType;
  title: string;
  price: number | null;
  priceFormatted: string;
  image: string;
  sellerName?: string;
  sellerId?: string;
  storeName?: string;
  storeAffiliateId?: string;
  installments?: string;
  shipping?: string;
  url?: string;
  savedAt?: string;
}
