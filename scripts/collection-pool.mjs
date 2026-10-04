/** Bounded queue; a failing item does not cancel other stores/items. */
export async function runCollectionPool(items, concurrency, handler, onResult = async () => {}, { shouldStop = () => false } = {}) {
  if (!Number.isInteger(concurrency) || concurrency < 1 || concurrency > 8) throw new Error('Concorrência deve estar entre 1 e 8.');
  let next = 0;
  let fatal;
  await Promise.all(Array.from({ length:Math.min(concurrency,items.length) }, async () => {
    while (!fatal && !shouldStop() && next < items.length) {
      const index = next++;
      let result;
      try { result = { index, ok:true, value:await handler(items[index],index) }; }
      catch(error) { result = { index, ok:false, error:String(error.message || error) }; }
      try { await onResult(result); }
      catch (error) { fatal ||= error; }
    }
  }));
  if (fatal) throw fatal;
}
