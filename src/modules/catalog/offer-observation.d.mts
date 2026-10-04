export type OfferObservationState = 'observed' | 'unknown' | 'needs_recheck';

export function getOfferObservationState(observedAt: unknown, now?: number, maxAgeMs?: number): OfferObservationState;
export function describeOfferObservation(observedAt: unknown, now?: number, maxAgeMs?: number): {
  state: OfferObservationState;
  label: string;
};
export function describeObservedStock(
  stockStatus: 'in_stock' | 'out_of_stock' | 'unknown' | null | undefined,
  observationState: OfferObservationState
): string;
