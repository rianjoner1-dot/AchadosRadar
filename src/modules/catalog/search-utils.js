/**
 * @param {string} value
 * @returns {string}
 */
export function normalizeSearch(value) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR').replace(/[^a-z0-9]/g, '');
}

/**
 * @param {string} left
 * @param {string} right
 * @param {number} limit
 * @returns {boolean}
 */
function editDistanceWithin(left, right, limit) {
  if (Math.abs(left.length - right.length) > limit) return false;
  let previous = Array.from({ length: right.length + 1 }, (_, index) => index);
  for (let row = 1; row <= left.length; row++) {
    const current = [row];
    let rowMin = row;
    for (let column = 1; column <= right.length; column++) {
      const cost = left[row - 1] === right[column - 1] ? 0 : 1;
      const value = Math.min(current[column - 1] + 1, previous[column] + 1, previous[column - 1] + cost);
      current.push(value);
      rowMin = Math.min(rowMin, value);
    }
    if (rowMin > limit) return false;
    previous = current;
  }
  return previous[right.length] <= limit;
}

function normalizeCatalogWords(value) {
  return String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR')
    .replace(/[^a-z0-9]+/g, ' ').trim().split(/\s+/).filter(Boolean);
}

const SEARCH_ALIASES = {
  celular: ['celular', 'smartphone'],
  smartphone: ['smartphone', 'celular'],
  fone: ['fone', 'headphone', 'headset', 'earbud'],
  headphone: ['headphone', 'headphones', 'fone', 'headset', 'earbud'],
  headphones: ['headphones', 'headphone', 'fone', 'headset', 'earbud'],
  headset: ['headset', 'headphone', 'fone', 'earbud'],
  geladeira: ['geladeira', 'refrigerador'],
  refrigerador: ['refrigerador', 'geladeira'],
  airfryer: ['airfryer', 'fritadeira'],
  fritadeira: ['fritadeira', 'airfryer']
};

/**
 * @param {string} query
 * @param {string} title
 * @param {string} category
 * @returns {boolean}
 */
export function matchesDemoProduct(query, title, category = '') {
  const terms = normalizeCatalogWords(query);
  if (!terms.length) return true;
  const words = normalizeCatalogWords(`${title} ${category}`);
  const longTerms = terms.filter((term) => term.length > 2);
  const shortTerms = terms.filter((term) => term.length <= 2);
  const shortTermsMatch = shortTerms.every((term) => words.includes(term));
  const normalizedQuery = terms.join(' ');

  // Preserve the explicit compound synonym while requiring ordinary words to
  // match as tokens (so "fone" cannot match inside "telefone").
  if (['air fryer', 'airfryer', 'fritadeira'].includes(normalizedQuery) &&
      (words.join('').includes('airfryer') || words.includes('fritadeira'))) return true;

  const matchesLongTerm = (term) => {
    const variants = SEARCH_ALIASES[term] ?? [term];
    return variants.some((variant) => words.some((word) => {
      if (word === variant || word.startsWith(variant)) return true;
      const tolerance = variant.length >= 8 ? 2 : variant.length >= 5 ? 1 : 0;
      return tolerance > 0 && editDistanceWithin(variant, word, tolerance);
    }));
  };

  return shortTermsMatch && longTerms.every(matchesLongTerm);
}

const DEMO_SECTOR_TERMS = {
  eletronicos: ['eletron', 'smartphone', 'celular', 'fone', 'bluetooth', 'tv', 'notebook', 'laptop', 'computador', 'tablet', 'monitor', 'teclado', 'mouse', 'camera', 'impressora', 'roteador', 'webcam', 'headset', 'hardware', 'placa de video', 'gpu', 'caixa de som'],
  moda: ['roupa', 'vestido', 'blusa', 'camisa', 'camiseta', 'calca', 'shorts', 'short', 'saia', 'moda', 'bolsa', 'tenis', 'sapato', 'sandalia', 'jaqueta', 'blazer', 'lingerie', 'meia'],
  moveis: ['moveis', 'sofa', 'rack', 'cama', 'mesa', 'guarda roupa', 'estante', 'cadeira', 'escrivaninha', 'armario', 'poltrona'],
  'pc-gamer': ['gamer', 'gaming', 'pc gamer', 'placa de video', 'gpu', 'gabinete gamer', 'teclado gamer', 'mouse gamer'],
  eletro: ['eletrodomestico', 'eletroportatil', 'air fryer', 'airfryer', 'fritadeira', 'geladeira', 'fogao', 'microondas', 'liquidificador', 'cafeteira', 'batedeira', 'sanduicheira', 'mixer', 'ventilador', 'ar condicionado', 'lava louca', 'lavadora', 'maquina de lavar', 'ferro de passar'],
  jardim: ['jardim', 'jardinagem', 'planta', 'vaso', 'mangueira', 'piscina', 'churrasqueira', 'ferramenta de jardim', 'gramado'],
  bebes: ['bebe', 'bebes', 'infantil', 'carrinho de bebe', 'cadeirinha', 'berco', 'fralda', 'mamadeira', 'chupeta', 'banheira infantil'],
  beleza: ['beleza', 'perfume', 'secador', 'chapinha', 'skincare', 'maquiagem', 'hidratante', 'cosmetico', 'shampoo', 'modelador de cabelo'],
  pet: ['pet', 'racao', 'gato', 'cachorro', 'arranhador', 'tapete higienico', 'coleira', 'brinquedo pet', 'areia sanitaria'],
  casa: ['casa', 'cozinha', 'limpeza', 'organizador', 'aspirador', 'decoracao', 'utensilio', 'panela', 'toalha', 'travesseiro', 'tapete', 'roupa de cama', 'lampada', 'utilidades domesticas']
};

/**
 * Mirrors the server's broad sector rules for the offline demo catalog.
 * @param {string} sector
 * @param {string} title
 * @param {string} category
 * @returns {boolean}
 */
export function matchesDemoSector(sector, title, category = '') {
  if (!sector) return true;
  const terms = DEMO_SECTOR_TERMS[sector];
  if (!terms) return false;
  const words = `${title} ${category}`.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR').split(/[^a-z0-9]+/).filter(Boolean);
  const normalized = words.join(' ');
  return terms.some((term) => {
    const normalizedTerm = term.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR');
    return normalizedTerm.includes(' ')
      ? ` ${normalized} `.includes(` ${normalizedTerm} `)
      : words.includes(normalizedTerm) || (normalizedTerm.endsWith('s') && words.includes(normalizedTerm.slice(0, -1)));
  });
}
