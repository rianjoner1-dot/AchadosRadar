export const MAX_AVATAR_INPUT_BYTES = 5 * 1024 * 1024;
export const MAX_AVATAR_OUTPUT_BYTES = 2 * 1024 * 1024;
export const MAX_AVATAR_PIXELS = 20_000_000;
const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

export async function prepareAvatarBlob(file, {
  createImageBitmapImpl = globalThis.createImageBitmap?.bind(globalThis),
  createCanvas = () => document.createElement('canvas')
} = {}) {
  if (!file || !ALLOWED_TYPES.has(file.type) || !Number.isFinite(file.size) || file.size > MAX_AVATAR_INPUT_BYTES) {
    throw new Error('Escolha uma foto JPEG, PNG ou WebP com até 5 MB.');
  }
  if (typeof createImageBitmapImpl !== 'function') throw new Error('Este navegador não consegue processar a foto.');

  let image;
  try {
    image = await createImageBitmapImpl(file);
  } catch {
    throw new Error('Não foi possível abrir a foto escolhida.');
  }

  try {
    const { width, height } = image;
    if (!Number.isSafeInteger(width) || !Number.isSafeInteger(height) || width < 1 || height < 1 || width * height > MAX_AVATAR_PIXELS) {
      throw new Error('A foto excede o limite de 20 megapixels. Escolha uma imagem menor.');
    }
    const minSide = Math.min(width, height);
    const sx = (width - minSide) / 2;
    const sy = (height - minSide) / 2;
    const targetSize = Math.min(320, minSide);
    const canvas = createCanvas();
    canvas.width = targetSize;
    canvas.height = targetSize;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Falha ao inicializar contexto gráfico para compressão.');
    ctx.drawImage(image, sx, sy, minSide, minSide, 0, 0, targetSize, targetSize);
    const blob = await new Promise((resolve, reject) => canvas.toBlob(
      (result) => result ? resolve(result) : reject(new Error('Não foi possível processar a foto.')),
      'image/webp', .80
    ));
    if (blob.size > MAX_AVATAR_OUTPUT_BYTES) throw new Error('A foto otimizada precisa ficar abaixo de 2 MB.');
    return blob;
  } finally {
    image.close?.();
  }
}
