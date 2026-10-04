
async function inspectUrl(url, storeName) {
  console.log(`\n======================================================`);
  console.log(`🔍 Inspecionando HTML de: ${storeName} (${url})`);
  console.log(`======================================================`);
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
        'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7'
      },
      signal: AbortSignal.timeout(15000)
    });

    console.log(`Status HTTP: ${res.status}`);
    const html = await res.text();
    console.log(`Tamanho do HTML: ${(html.length / 1024).toFixed(1)} KB`);

    // 1. Procura por JSON-LD
    const jsonLdMatches = [...html.matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)];
    console.log(`Tags JSON-LD encontradas: ${jsonLdMatches.length}`);
    for (const match of jsonLdMatches) {
      try {
        const parsed = JSON.parse(match[1]);
        const items = Array.isArray(parsed) ? parsed : [parsed];
        for (const item of items) {
          if (item['@type'] === 'Product' || item.offers) {
            console.log(`✅ Schema Product encontrado no JSON-LD:`);
            console.log(`  - Nome:`, item.name);
            console.log(`  - Imagem:`, Array.isArray(item.image) ? item.image[0] : item.image);
            console.log(`  - Preço:`, item.offers?.price || item.offers?.lowPrice || item.offers?.[0]?.price);
            console.log(`  - Moeda:`, item.offers?.priceCurrency || item.offers?.[0]?.priceCurrency);
            console.log(`  - Disponibilidade:`, item.offers?.availability || item.offers?.[0]?.availability);
          }
        }
      } catch {}
    }

    // 2. Procura por Next Data ou VTEX state
    if (html.includes('__NEXT_DATA__')) {
      console.log(`✅ Detectado framework: Next.js (__NEXT_DATA__)`);
      const nextMatch = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
      if (nextMatch) {
        try {
          const nextData = JSON.parse(nextMatch[1]);
          const pageProps = nextData.props?.pageProps;
          const product = pageProps?.product || pageProps?.initialData?.product || pageProps?.data?.product;
          if (product) {
            console.log(`  - ID do Produto:`, product.id || product.code);
            console.log(`  - Nome:`, product.name || product.title);
            console.log(`  - Preço à vista (Pix):`, product.priceDetails?.discountPrice || product.price);
            console.log(`  - Preço no cartão:`, product.priceDetails?.price || product.oldPrice);
            console.log(`  - Parcelas:`, product.priceDetails?.installmentText || product.installment);
            console.log(`  - Fotos:`, (product.photos || product.images || []).length);
          }
        } catch (e) {
          console.log(`  - Erro ao ler __NEXT_DATA__:`, e.message);
        }
      }
    }

    if (html.includes('vtex') || html.includes('vtexjs') || html.includes('__STATE__')) {
      console.log(`✅ Detectado framework: VTEX / VTEX IO`);
    }

    // 3. Procura por OpenGraph
    const ogTitle = html.match(/<meta property=["']og:title["'] content=["'](.*?)["']/i)?.[1];
    const ogImage = html.match(/<meta property=["']og:image["'] content=["'](.*?)["']/i)?.[1];
    const ogPrice = html.match(/<meta property=["']product:price:amount["'] content=["'](.*?)["']/i)?.[1];
    console.log(`Metatags OpenGraph:`);
    console.log(`  - og:title:`, ogTitle);
    console.log(`  - og:image:`, ogImage);
    console.log(`  - og:price:`, ogPrice);

    return { success: true, length: html.length };
  } catch (err) {
    console.error(`❌ Erro ao inspecionar ${storeName}:`, err.message);
    return { success: false, error: err.message };
  }
}

async function main() {
  // Teste com KaBuM (Rise Mode RAM que o usuário consultou)
  await inspectUrl('https://www.kabum.com.br/produto/480402/memoria-ram-para-notebook-rise-mode-value-16gb-3200mhz-ddr4-cl22-rm-d4-16g-3200vn', 'KaBuM!');

  // Teste com Lojas Benoit: busca links na home
  try {
    const res = await fetch('https://www.benoit.com.br');
    const html = await res.text();
    const allLinks = [...html.matchAll(/href=["']([^"'\s]+)["']/gi)].map(m => m[1]);
    const candidates = allLinks.filter(l => !l.startsWith('#') && !l.includes('javascript') && !l.includes('css') && l.length > 5);
    console.log('Total de links encontrados na Benoit:', allLinks.length);
    console.log('Todos os links da Benoit:', allLinks);

    // Procura links que parecem produtos (ex: terminando com .html ou com slug de produto)
    const productCandidate = candidates.find(l => /\/(produto|p|item|detalhes|smart|celular|fogao|geladeira|tv|ar-condicionado)\//i.test(l) || /\.html/i.test(l));
    if (productCandidate) {
      const fullUrl = productCandidate.startsWith('http') ? productCandidate : `https://www.benoit.com.br${productCandidate}`;
      await inspectUrl(fullUrl, 'Lojas Benoit (Produto)');
    }
  } catch (e) {
    console.error('Erro Benoit:', e.message);
  }
}

main();
