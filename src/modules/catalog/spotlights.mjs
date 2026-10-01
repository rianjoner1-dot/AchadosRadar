function observedDiscount(offer) {
  const price = offer?.price;
  const oldPrice = offer?.old_price;
  if (!Number.isFinite(price) || price <= 0 || !Number.isFinite(oldPrice) || oldPrice <= price) return null;
  const percent = Math.round(((oldPrice - price) / oldPrice) * 100);
  return percent > 0 ? percent : null;
}

export function selectSpotlightOffers(products, limit = 3, excludedProductIds = []) {
  if (!Array.isArray(products) || !Number.isInteger(limit) || limit < 1) return [];
  const excluded = new Set(excludedProductIds);
  const inStock = products.filter((product) => product?.id && !excluded.has(product.id) && product.offer?.stock_status === 'in_stock' && Number.isFinite(product.offer.price) && product.offer.price > 0);
  const discounted = inStock
    .map((product) => ({ product, discountPercent: observedDiscount(product.offer) }))
    .filter((entry) => entry.discountPercent !== null)
    .sort((a, b) => b.discountPercent - a.discountPercent);
  const selected = [...discounted];
  const selectedIds = new Set(selected.map(({ product }) => product.id));
  for (const product of inStock) {
    if (selectedIds.has(product.id)) continue;
    selected.push({ product, discountPercent: null });
    selectedIds.add(product.id);
  }
  return selected.slice(0, limit);
}
