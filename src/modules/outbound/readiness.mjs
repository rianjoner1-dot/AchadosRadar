import { isFutureTimestamp, isRecentTimestamp } from './freshness.mjs';

function countdownLabel(milliseconds) {
  const minutes = Math.max(1, Math.ceil(Math.abs(milliseconds) / 60_000));
  const days = Math.floor(minutes / 1440);
  const hours = Math.floor(minutes % 1440 / 60);
  const remainingMinutes = minutes % 60;
  return `${days}d ${hours}h ${remainingMinutes}min`;
}

export function formatLinkTiming(link, now = Date.now()) {
  if (link?.expires_at) {
    const expiry = Date.parse(link.expires_at);
    if (!Number.isFinite(expiry)) return 'Expiração oficial inválida; link em verificação.';
    if (expiry <= now) return 'Prazo oficial do link encerrado.';
    return `Link expira em ${countdownLabel(expiry - now)}`;
  }
  if (link?.refresh_due_at) {
    const reviewAt = Date.parse(link.refresh_due_at);
    if (!Number.isFinite(reviewAt)) return 'Prazo de revisão interna inválido; link em verificação.';
    if (reviewAt <= now) return `Revisão interna vencida desde ${new Date(reviewAt).toLocaleString('pt-BR')}; isso não representa expiração oficial.`;
    return `Próxima revisão interna em ${countdownLabel(reviewAt - now)}; isso não representa expiração oficial.`;
  }
  if (link?.status === 'active' && link.verified_at) return `Link verificado em ${new Date(link.verified_at).toLocaleString('pt-BR')}; a loja não informou expiração oficial.`;
  if (link?.status === 'expired') return 'O prazo oficial do link terminou.';
  if (link?.status && link.status !== 'active') return 'Link afiliado em revisão; a compra fica temporariamente indisponível.';
  return 'Link afiliado aguardando verificação.';
}

export function hasElapsedLinkDeadline(link, now = Date.now()) {
  return [link?.expires_at, link?.refresh_due_at].some((value) => {
    const deadline = Date.parse(value ?? '');
    return Number.isFinite(deadline) && deadline <= now;
  });
}

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
