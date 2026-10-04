const imageHosts = {
  mercadolivre: ['mlstatic.com', 'mlstatic.com.br'],
  magalu: ['mlcdn.com.br', 'magazineluiza.com.br', 'magalu.com'],
  amazon: ['media-amazon.com', 'ssl-images-amazon.com', 'images-amazon.com'],
  shopee: ['susercontent.com', 'shopee.com.br', 'shopee.com'],
  benoit: ['benoit.com.br', 'awin1.com'],
  kabum: ['kabum.com.br', 'awin1.com']
};

export function isAllowedMarketplaceImageUrl(platform, candidate) {
  if (typeof candidate !== 'string' || !Object.hasOwn(imageHosts, platform)) return false;
  try {
    const url = new URL(candidate);
    return url.protocol === 'https:'
      && !url.username && !url.password
      && !url.port
      && imageHosts[platform].some((host) => url.hostname === host || url.hostname.endsWith(`.${host}`));
  } catch {
    return false;
  }
}

const videoHosts = {
  mercadolivre: ['mlstatic.com', 'mlstatic.com.br'],
  magalu: ['mlcdn.com.br', 'magazineluiza.com.br', 'magalu.com'],
  amazon: ['media-amazon.com', 'ssl-images-amazon.com'],
  shopee: ['susercontent.com', 'shopee.com.br', 'shopee.com'],
  benoit: ['benoit.com.br'],
  kabum: ['kabum.com.br']
};

export function isAllowedMarketplaceVideoUrl(platform, candidate) {
  if (typeof candidate !== 'string' || !Object.hasOwn(videoHosts, platform)) return false;
  try {
    const url = new URL(candidate);
    return url.protocol === 'https:' && !url.username && !url.password && !url.port
      && !url.pathname.toLowerCase().includes('/thumbnails/')
      && /\.(mp4|webm|m3u8)$/i.test(url.pathname)
      && videoHosts[platform].some((host) => url.hostname === host || url.hostname.endsWith(`.${host}`));
  } catch {
    return false;
  }
}
