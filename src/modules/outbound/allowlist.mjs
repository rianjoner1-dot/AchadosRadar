const hosts = {
  mercadolivre: ['mercadolivre.com.br', 'mercadolivre.com', 'meli.la'],
  magalu: ['magazinevoce.com.br', 'magazineluiza.com.br', 'magalu.com.br']
};

export function isAllowedAffiliateUrl(platform, rawUrl) {
  try {
    const url = new URL(rawUrl);
    return url.protocol === 'https:' && (hosts[platform] ?? []).some((host) => url.hostname === host || url.hostname.endsWith(`.${host}`));
  } catch { return false; }
}
