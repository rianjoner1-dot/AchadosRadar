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

const SECTOR_LABELS = {
  eletronicos: 'Eletrônicos',
  moda: 'Moda',
  moveis: 'Móveis',
  'pc-gamer': 'PC Gamer',
  eletro: 'Eletro',
  jardim: 'Jardim',
  bebes: 'Bebês',
  beleza: 'Beleza',
  pet: 'Pet',
  casa: 'Casa'
};

function normalizeCategory(value) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('pt-BR')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function getCategoryOptions(product) {
  const options = [];
  const marketplaceCategory = String(product?.category ?? '').trim();
  if (marketplaceCategory) {
    const key = normalizeCategory(marketplaceCategory);
    if (key) options.push({ key, label: marketplaceCategory });
  }
  for (const sector of Array.isArray(product?.sectors) ? product.sectors : []) {
    const key = normalizeCategory(sector);
    if (key && !options.some((option) => option.key === key)) {
      options.push({ key, label: SECTOR_LABELS[sector] ?? String(sector) });
    }
  }
  return options;
}

/**
 * Creates up to three product lanes, each with at most five offers. A category
 * is used once across the whole selection, so lanes and rotation frames remain
 * category-distinct whenever the catalog has enough classified products.
 */
export function selectSpotlightCarouselGroups(products, carouselCount = 3, slidesPerCarousel = 5, excludedProductIds = []) {
  if (!Array.isArray(products) || !Number.isInteger(carouselCount) || carouselCount < 1 ||
      !Number.isInteger(slidesPerCarousel) || slidesPerCarousel < 1) return [];

  const maxSlides = Math.min(slidesPerCarousel, 5);
  const groups = Array.from({ length: carouselCount }, () => []);
  const usedCategories = new Set();
  const candidates = selectSpotlightOffers(products, products.length, excludedProductIds);
  let nextGroup = 0;

  for (const entry of candidates) {
    const category = getCategoryOptions(entry.product).find((option) => !usedCategories.has(option.key));
    if (!category) continue;
    let targetGroup = -1;
    for (let offset = 0; offset < groups.length; offset += 1) {
      const index = (nextGroup + offset) % groups.length;
      if (groups[index].length < maxSlides) { targetGroup = index; break; }
    }
    if (targetGroup < 0) break;
    groups[targetGroup].push({ ...entry, categoryKey: category.key, categoryLabel: category.label });
    usedCategories.add(category.key);
    nextGroup = (targetGroup + 1) % groups.length;
  }

  return groups.filter((group) => group.length > 0);
}
