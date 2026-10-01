import type { CatalogProduct } from './client';

export interface SpotlightOffer {
  product: CatalogProduct;
  discountPercent: number | null;
}

export function selectSpotlightOffers(products: CatalogProduct[], limit?: number): SpotlightOffer[];
