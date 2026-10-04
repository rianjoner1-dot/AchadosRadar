const TYPES = [
  ['mousepad', /\bmouse\s*pad\b/], ['teclados', /\bteclado/], ['mouses', /\bmouse/],
  ['monitores', /\bmonitor/], ['memorias', /\b(memoria|ram)\b/],
  ['armazenamento', /\b(ssd|hd|disco rigido)\b/], ['processadores', /\b(processador|cpu)\b/],
  ['placas-de-video', /\b(placa de video|gpu)\b/], ['gabinetes', /\b(gabinete|case)\b/],
  ['fontes', /\bfonte\b/], ['fones', /\b(headset|fone)\b/], ['notebooks', /\bnotebook/]
];

export function productVarietyKey(product) {
  const title = String(product.title ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  return TYPES.find(([, rule]) => rule instanceof RegExp && rule.test(title))?.[0]
    ?? product.category ?? product.sectors?.[0] ?? 'outros';
}

/** Mix presentation only; source cursor order and all product identities survive.
 * @template T
 * @param {T[]} products
 * @param {() => number} random
 * @returns {T[]}
 */
export function mixProductVariety(products, random = Math.random) {
  const queues = new Map();
  const shuffled = [...products];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.min(i, Math.max(0, Math.floor(random() * (i + 1))));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  for (const product of shuffled) {
    const key = productVarietyKey(product);
    if (!queues.has(key)) queues.set(key, []);
    queues.get(key).push(product);
  }
  const result = [];
  while (queues.size) {
    for (const [key, queue] of queues) {
      result.push(queue.shift());
      if (!queue.length) queues.delete(key);
    }
  }
  return result;
}

// Small, bounded discovery sample; normal cursor pagination still supplies all offers.
export const HOME_VARIETY_QUERIES = [
  ...['moda', 'moveis', 'eletro', 'jardim', 'bebes', 'beleza', 'pet', 'casa'].map(sector => ({ sector })),
  ...['monitor', 'processador', 'placa de video', 'ssd', 'memoria ram', 'gabinete', 'fonte', 'teclado', 'mouse'].map(q => ({ q }))
];
