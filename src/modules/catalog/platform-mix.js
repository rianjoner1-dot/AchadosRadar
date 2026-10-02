/**
 * Randomly alternates marketplace groups while preserving each group's order.
 * This keeps date/price ranking intact within a store and avoids long same-store runs.
 * @template T
 * @param {T[]} products
 * @param {(max: number) => number} [pickIndex]
 * @returns {T[]}
 */
export function interleaveByPlatform(products, pickIndex = (max) => Math.floor(Math.random() * max)) {
  const queues = new Map();
  for (const product of products) {
    const platform = String(product.platform ?? 'unknown');
    const queue = queues.get(platform) ?? [];
    queue.push(product);
    queues.set(platform, queue);
  }

  const result = [];
  let previousPlatform = null;
  while (queues.size) {
    const available = [...queues.keys()];
    const alternatives = available.filter((platform) => platform !== previousPlatform);
    const choices = alternatives.length ? alternatives : available;
    const selectedIndex = Math.max(0, Math.min(choices.length - 1, pickIndex(choices.length)));
    const platform = choices[selectedIndex];
    result.push(queues.get(platform).shift());
    previousPlatform = platform;
    if (!queues.get(platform).length) queues.delete(platform);
  }
  return result;
}
