/** Bounded queue; a failing item does not cancel other stores/items. */
export async function runCollectionPool(items, concurrency, handler, onResult = async () => {}) {
  if (!Number.isInteger(concurrency) || concurrency < 1 || concurrency > 8) throw new Error('Concorrência deve estar entre 1 e 8.');
  let next = 0;
  await Promise.all(Array.from({ length:Math.min(concurrency,items.length) }, async () => {
    while (next < items.length) {
      const index = next++;
      let result;
      try { result = { index, ok:true, value:await handler(items[index],index) }; }
      catch(error) { result = { index, ok:false, error:String(error.message || error) }; }
      await onResult(result);
    }
  }));
}
