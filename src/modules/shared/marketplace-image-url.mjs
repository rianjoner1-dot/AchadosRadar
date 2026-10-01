const imageHosts = {
  mercadolivre: ['mlstatic.com', 'mlstatic.com.br'],
  magalu: ['mlcdn.com.br', 'magazineluiza.com.br']
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
