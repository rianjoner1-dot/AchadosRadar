const hosts = {
  mercadolivre: ['mercadolivre.com.br', 'mercadolivre.com', 'meli.la'],
  magalu: ['magazinevoce.com.br', 'magazineluiza.com.br', 'magalu.com.br', 'magazineluiza.onelink.me']
};
const exactHosts = { mercadolivre: ['meli.la'], magalu: ['magazineluiza.onelink.me'] };

export function isAllowedAffiliateUrl(platform, rawUrl) {
  try {
    const url = new URL(rawUrl);
    const hostname = url.hostname.toLowerCase();
    return url.protocol === 'https:' && !url.username && !url.password && (hosts[platform] ?? []).some((host) =>
      (exactHosts[platform] ?? []).includes(host) ? hostname === host : hostname === host || hostname.endsWith(`.${host}`)
    );
  } catch { return false; }
}
