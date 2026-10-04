const DEFAULT_MAX_AGE_MS = 48 * 60 * 60 * 1000;
const FUTURE_SKEW_MS = 5 * 60 * 1000;

export function getOfferObservationState(observedAt, now = Date.now(), maxAgeMs = DEFAULT_MAX_AGE_MS) {
  if (typeof observedAt !== 'string' || !observedAt.trim()) return 'unknown';
  const timestamp = Date.parse(observedAt);
  if (!Number.isFinite(timestamp) || timestamp > now + FUTURE_SKEW_MS || now - timestamp > maxAgeMs) return 'needs_recheck';
  return 'observed';
}

export function describeOfferObservation(observedAt, now = Date.now(), maxAgeMs = DEFAULT_MAX_AGE_MS) {
  const state = getOfferObservationState(observedAt, now, maxAgeMs);
  if (state === 'unknown') return { state, label: 'Data da consulta não informada' };

  const timestamp = Date.parse(observedAt);
  const formattedAt = Number.isFinite(timestamp) ? new Date(timestamp).toLocaleString('pt-BR') : null;
  if (state === 'needs_recheck') {
    return { state, label: formattedAt ? `Precisa de nova verificação · última consulta: ${formattedAt}` : 'Precisa de nova verificação' };
  }
  return { state, label: `Dados observados em ${formattedAt} · podem mudar na loja` };
}

export function describeObservedStock(stockStatus, observationState) {
  if (observationState === 'needs_recheck') return 'Precisa de nova verificação';
  if (observationState !== 'observed') return 'Disponibilidade não informada';
  if (stockStatus === 'in_stock') return 'Disponível na última consulta';
  if (stockStatus === 'out_of_stock') return 'Sem estoque na última consulta';
  return 'Estoque não informado';
}
