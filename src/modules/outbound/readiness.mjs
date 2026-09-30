import { isFutureTimestamp, isRecentTimestamp } from './freshness.mjs';

export function evaluateOfferReadiness({ productStatus = 'published', link, offer, now = Date.now() }) {
  if (productStatus !== 'published') return { ready: false, reason: 'Produto fora do catálogo publicado.' };
  if (!link) return { ready: false, reason: 'Link afiliado aguardando verificação.' };
  if (link.status !== 'active') return { ready: false, reason: link.status === 'expired' ? 'O link da oferta expirou.' : 'O link da oferta está em revisão.' };
  if (!isRecentTimestamp(link.verified_at, 14 * 24 * 60 * 60 * 1000, now)) return { ready: false, reason: 'A verificação do link está desatualizada.' };
  if (link.expires_at && !isFutureTimestamp(link.expires_at, now)) return { ready: false, reason: 'O prazo informado pela loja terminou.' };
  if (link.refresh_due_at && !isFutureTimestamp(link.refresh_due_at, now)) return { ready: false, reason: 'A revisão interna do link está pendente.' };
  if (offer?.stock_status === 'out_of_stock') return { ready: false, reason: 'Sem estoque na última consulta.' };
  if (offer?.stock_status !== 'in_stock') return { ready: false, reason: 'Estoque ainda não confirmado.' };
  if (!isRecentTimestamp(offer.observed_at, 48 * 60 * 60 * 1000, now)) return { ready: false, reason: 'A disponibilidade precisa ser consultada novamente.' };
  return { ready: true, reason: 'Oferta e link confirmados recentemente.' };
}
