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

/**
 * @param {string} query
 * @param {string} title
 * @param {string} seller
 * @returns {boolean}
 */
export function matchesDemoProduct(query, title, seller = '') {
  const terms = query.trim().split(/\s+/).map(normalizeSearch).filter(Boolean);
  if (!terms.length) return true;
  const words = `${title} ${seller}`.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR').split(/[^a-z0-9]+/).filter(Boolean);
  return terms.every((term) => {
    const tolerance = term.length >= 8 ? 2 : term.length >= 4 ? 1 : 0;
    return words.some((word) => word.includes(term) || (tolerance > 0 && editDistanceWithin(term, word, tolerance)));
  });
}
