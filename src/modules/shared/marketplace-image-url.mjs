const imageHosts = {
  mercadolivre: ['mlstatic.com', 'mlstatic.com.br'],
  magalu: ['mlcdn.com.br', 'magazineluiza.com.br'],
  amazon: ['media-amazon.com', 'ssl-images-amazon.com', 'images-amazon.com'],
  shopee: ['susercontent.com', 'shopee.com.br', 'shopee.com']
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
