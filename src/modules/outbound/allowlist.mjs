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
    return url.protocol === 'https:' && !url.username && !url.password && (hosts[platform] ?? []).some((host) =>
      (exactHosts[platform] ?? []).includes(host) ? hostname === host : hostname === host || hostname.endsWith(`.${host}`)
    );
  } catch { return false; }
}
