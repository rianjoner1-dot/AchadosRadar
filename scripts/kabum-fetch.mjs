export function validateKabumUrl(value, id) {
  const url = new URL(value);
  if (url.protocol !== 'https:' || url.port || url.username || url.password
    || !['www.kabum.com.br', 'kabum.com.br'].includes(url.hostname)
    || url.pathname.match(/^\/produto\/(\d+)(?:\/|$)/)?.[1] !== String(id)) {
    throw new Error('URL/redirecionamento fora da identidade do produto.');
  }
  return url;
}

export async function fetchKabumProduct(item, fetcher = fetch) {
  let url = validateKabumUrl(item.originalUrl, item.id);
  const signal = AbortSignal.timeout(15000);
  for (let hop = 0; hop <= 5; hop++) {
    const response = await fetcher(url, { redirect: 'manual', signal });
    if ([301, 302, 303, 307, 308].includes(response.status)) {
      const location = response.headers.get('location');
      await response.body?.cancel();
      if (!location || hop === 5) throw new Error('Redirecionamento ausente ou excessivo.');
      url = validateKabumUrl(new URL(location, url), item.id);
      continue;
    }
    if (!response.ok) throw new Error(`HTTP ${response.status}; item mantido pendente.`);
    return { html: await response.text(), url: url.href };
  }
}
