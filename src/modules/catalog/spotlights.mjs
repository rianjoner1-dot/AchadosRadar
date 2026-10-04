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

const TITLE_CATEGORY_RULES = [
  ['pc-gamer', /\b(pc gamer|notebook gamer|placa de video|teclado gamer|mouse gamer|headset gamer)\b/],
  ['moda', /\b(vestido|blusa|camisa|calca|shorts?|saia|conjunto feminino|lingerie|tenis|sapat(o|ilha)|sandalia|bolsa|jaqueta|casaco|meia|roupa)\b/],
  ['moveis', /\b(sofa|rack|painel|cama|colchao|guarda roupa|mesa|cadeira|poltrona|estante|armario)\b/],
  ['eletronicos', /\b(celular|smartphone|fone|televisao|smart tv|camera|tablet|monitor|roteador|eletronico)\b/],
  ['eletro', /\b(geladeira|lavadora|purificador|air fryer|fritadeira|liquidificador|cafeteira|microondas|ventilador|sanduicheira|mixer)\b/],
  ['jardim', /\b(jardim|planta|mangueira|rocadeira|ferramenta)\b/],
  ['bebes', /\b(bebe|fralda|carrinho de bebe|mamadeira)\b/],
  ['beleza', /\b(maquiagem|perfume|skincare|cabelo|cosmetico|creme facial)\b/],
  ['pet', /\b(pet|cachorro|gato|racao|coleira|arranhador)\b/],
  ['casa', /\b(cozinha|copo|prato|panela|toalha|lencol|organizador)\b/]
];

function getCategoryOptions(product) {
  const options = [];
  const title = normalizeCategory(product?.title).replace(/-/g, ' ');
  const titleCategory = TITLE_CATEGORY_RULES.find(([, pattern]) => pattern.test(title))?.[0];
  if (titleCategory) options.push({ key: titleCategory, label: SECTOR_LABELS[titleCategory] });
  for (const sector of Array.isArray(product?.sectors) ? product.sectors : []) {
    const key = normalizeCategory(sector);
    if (key && !options.some((option) => option.key === key)) {
      options.push({ key, label: SECTOR_LABELS[sector] ?? String(sector) });
    }
  }
  const marketplaceCategory = String(product?.category ?? '').trim();
  if (marketplaceCategory) {
    const key = normalizeCategory(marketplaceCategory);
    if (key && !options.some((option) => option.key === key)) options.push({ key, label: marketplaceCategory });
  }
  return options;
}

/**
 * Creates up to three category lanes with up to five offers per lane. Each lane
 * stays in one category while its product rotates, matching the three-card
 * merchandising strip without mixing unrelated offers in a carousel.
 */
export function selectSpotlightCarouselGroups(products, carouselCount = 3, slidesPerCarousel = 5, excludedProductIds = []) {
  if (!Array.isArray(products) || !Number.isInteger(carouselCount) || carouselCount < 1 ||
      !Number.isInteger(slidesPerCarousel) || slidesPerCarousel < 1) return [];

  const maxSlides = Math.min(slidesPerCarousel, 5);
  const categoryGroups = new Map();
  const candidates = selectSpotlightOffers(products, products.length, excludedProductIds);
  for (const entry of candidates) {
    const category = getCategoryOptions(entry.product)[0];
    if (!category) continue;
    const group = categoryGroups.get(category.key) ?? { category, entries: [] };
    if (group.entries.length < maxSlides) group.entries.push({ ...entry, categoryKey: category.key, categoryLabel: category.label });
    categoryGroups.set(category.key, group);
  }
  return [...categoryGroups.values()]
    .filter((group) => group.entries.length > 0)
    .sort((a, b) => b.entries.length - a.entries.length)
    .slice(0, carouselCount)
    .map((group) => group.entries);
}
