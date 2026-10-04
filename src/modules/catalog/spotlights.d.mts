import type { CatalogProduct } from './client';

export interface SpotlightOffer {
  product: CatalogProduct;
  discountPercent: number | null;
}

export function selectSpotlightOffers(products: CatalogProduct[], limit?: number, excludedProductIds?: Iterable<string>): SpotlightOffer[];

export interface SpotlightCarouselOffer extends SpotlightOffer {
  categoryKey: string;
  categoryLabel: string;
}

export function selectSpotlightCarouselGroups(products: CatalogProduct[], carouselCount?: number, slidesPerCarousel?: number, excludedProductIds?: Iterable<string>, diversifyTypes?: boolean): SpotlightCarouselOffer[][];
