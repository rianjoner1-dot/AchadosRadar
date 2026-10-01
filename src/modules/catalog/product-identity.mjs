const hostsByPlatform = {
  magalu: ['magazineluiza.com.br', 'magazinevoce.com.br'],
  mercadolivre: ['mercadolivre.com.br', 'mercadolivre.com']
};

function decodeSegment(segment) {
  try { return decodeURIComponent(segment); } catch { return ''; }
}

/** Fail closed unless the official product URL contains the exact extracted marketplace ID. */
export function matchesMarketplaceProductIdentity(platform, externalId, rawUrl) {
  const id = String(externalId ?? '').trim();
  if (!id || !hostsByPlatform[platform]) return false;

  let url;
  try { url = new URL(String(rawUrl ?? '')); } catch { return false; }
  if (url.protocol !== 'https:' || url.username || url.password) return false;

  const host = url.hostname.toLowerCase();
  if (!hostsByPlatform[platform].some((domain) => host === domain || host.endsWith(`.${domain}`))) return false;
  const segments = url.pathname.split('/').filter(Boolean).map(decodeSegment);

  if (platform === 'magalu') {
    const expected = id.toLowerCase();
    return segments.some((segment, index) => segment.toLowerCase() === 'p'
      && segments[index + 1]?.toLowerCase() === expected);
  }

  const expectedMeliId = id.match(/^MLB-?(\d+)$/i)?.[1];
  if (!expectedMeliId) return false;
  return segments.some((segment) => [...segment.matchAll(/(?:^|[^a-z0-9])MLB-?(\d+)(?=$|[^0-9])/ig)]
    .some((match) => match[1] === expectedMeliId));
}
