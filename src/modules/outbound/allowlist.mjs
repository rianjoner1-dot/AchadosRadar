const hosts = {
  mercadolivre: ['meli.la'],
  magalu: ['magazinevoce.com.br', 'magazineluiza.onelink.me'],
  amazon: ['amzn.to', 'amazon.com.br'],
  shopee: ['s.shopee.com.br', 'shopee.com.br'],
  benoit: ['benoit.com.br', 'awin1.com'],
  kabum: ['kabum.com.br', 'awin1.com']
};
const exactHosts = {
  mercadolivre: ['meli.la'],
  magalu: ['magazineluiza.onelink.me'],
  amazon: ['amzn.to'],
  shopee: ['s.shopee.com.br']
};

export function isAllowedAffiliateUrl(platform, rawUrl) {
  try {
    const url = new URL(rawUrl);
    const hostname = url.hostname.toLowerCase();
    if (url.port || url.protocol !== 'https:' || url.username || url.password) return false;
    if (platform === 'kabum' && ['awin1.com', 'www.awin1.com'].includes(hostname)) {
      const params = url.searchParams;
      if (url.pathname === '/pclick.php') return params.get('m') === '17729' && params.get('a') === '3105840' && /^\d+$/.test(params.get('p') ?? '');
      if (url.pathname !== '/cread.php' || params.get('awinmid') !== '17729' || params.get('awinaffid') !== '3105840') return false;
      const destination = new URL(params.get('ued'));
      return destination.protocol === 'https:' && !destination.port && !destination.username && !destination.password && ['kabum.com.br', 'www.kabum.com.br'].includes(destination.hostname) && /^\/produto\/\d+(?:\/|$)/.test(destination.pathname);
    }
    if (platform === 'kabum') return false;
    return url.protocol === 'https:' && !url.username && !url.password && (hosts[platform] ?? []).some((host) =>
      (exactHosts[platform] ?? []).includes(host) ? hostname === host : hostname === host || hostname.endsWith(`.${host}`)
    );
  } catch { return false; }
}
