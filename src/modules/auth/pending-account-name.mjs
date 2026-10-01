const STORAGE_KEY = 'pending_account_names';

function normalizeEmail(email) {
  return typeof email === 'string' ? email.trim().toLowerCase() : '';
}

function readEntries(storage) {
  try {
    const parsed = JSON.parse(storage.getItem(STORAGE_KEY) || '[]');
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((entry) =>
      entry
      && typeof entry.email === 'string'
      && typeof entry.name === 'string'
      && normalizeEmail(entry.email).includes('@')
      && entry.name.trim().length >= 2
      && entry.name.trim().length <= 80
    ).map((entry) => ({ email: normalizeEmail(entry.email), name: entry.name.trim() }));
  } catch {
    return [];
  }
}

/** Store a signup name only under the email address used for the OTP request. */
export function storePendingAccountName(email, name, storage) {
  const normalizedEmail = normalizeEmail(email);
  const normalizedName = typeof name === 'string' ? name.trim() : '';
  if (!storage || !normalizedEmail.includes('@') || normalizedName.length < 2 || normalizedName.length > 80) return false;

  const entries = readEntries(storage).filter((entry) => entry.email !== normalizedEmail);
  entries.push({ email: normalizedEmail, name: normalizedName });
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(entries.slice(-8)));
    return true;
  } catch {
    return false;
  }
}

/** Return a pending name only when it belongs to the authenticated email. */
export function readPendingAccountName(email, storage) {
  const normalizedEmail = normalizeEmail(email);
  if (!storage || !normalizedEmail.includes('@')) return '';
  return readEntries(storage).find((entry) => entry.email === normalizedEmail)?.name ?? '';
}

/** Clear one account's draft without affecting pending OTP requests for others. */
export function clearPendingAccountName(email, storage) {
  const normalizedEmail = normalizeEmail(email);
  if (!storage || !normalizedEmail.includes('@')) return false;
  const entries = readEntries(storage).filter((entry) => entry.email !== normalizedEmail);
  try {
    if (entries.length) storage.setItem(STORAGE_KEY, JSON.stringify(entries));
    else storage.removeItem(STORAGE_KEY);
    return true;
  } catch {
    return false;
  }
}
