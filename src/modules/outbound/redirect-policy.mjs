import { isAllowedAffiliateUrl } from './allowlist.mjs';
import { isFutureTimestamp, isRecentTimestamp } from './freshness.mjs';

const blocked = (status, message) => ({ ready: false, status, message });

export function evaluateAffiliateRedirect({ product, link, offer, now = Date.now() }) {
  if (!product || product.status !== 'published') {
    return blocked(410, 'Produto indisponível. O item continua salvo na sua lista.');
  }
  if (!link || link.status !== 'active') {
    return blocked(410, 'Link em revisão. O item continua salvo na sua lista.');
  }
  if (offer?.stock_status !== 'in_stock' || !isRecentTimestamp(offer?.observed_at, 48 * 60 * 60 * 1000, now)) {
    return blocked(409, 'O estoque precisa ser confirmado novamente. O item continua salvo na sua lista.');
  }
  if (!isAllowedAffiliateUrl(product.platform, link.affiliate_url)
      || !isRecentTimestamp(link.verified_at, 14 * 24 * 60 * 60 * 1000, now)
      || (link.refresh_due_at && !isFutureTimestamp(link.refresh_due_at, now))) {
    return blocked(410, 'Não foi possível confirmar o link afiliado atual. O item continua salvo na sua lista.');
  }
  if (link.expires_at && !isFutureTimestamp(link.expires_at, now)) {
    return blocked(410, 'O link informado pela loja expirou. O item continua salvo na sua lista.');
  }
  return { ready: true, status: 302, location: new URL(link.affiliate_url).href };
}
