export function isRecentTimestamp(value, maxAgeMs, now = Date.now(), futureSkewMs = 5 * 60 * 1000) {
  if (typeof value !== 'string' || !value.trim()) return false;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) && timestamp <= now + futureSkewMs && now - timestamp <= maxAgeMs;
}

export function isFutureTimestamp(value, now = Date.now()) {
  if (typeof value !== 'string' || !value.trim()) return false;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) && timestamp > now;
}
