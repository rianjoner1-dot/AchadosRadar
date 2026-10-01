/**
 * Persist an Auth metadata name to the profile row before clearing its recovery hint.
 * @param {string} name
 * @param {(name: string) => Promise<{ data?: unknown, error?: unknown }>} updateProfile
 * @param {() => void} clearPendingName
 */
export async function persistInitialProfileName(name, updateProfile, clearPendingName) {
  const normalizedName = typeof name === 'string' ? name.trim() : '';
  if (!normalizedName) return { saved: true, skipped: true };

  let result;
  try {
    result = await updateProfile(normalizedName);
  } catch (error) {
    return { saved: false, error };
  }
  if (result?.error) return { saved: false, error: result.error };
  if (!result?.data) return { saved: false, error: new Error('O perfil ainda não possui uma linha atualizável.') };

  try { clearPendingName(); } catch { /* Auth metadata remains available to retry later. */ }
  return { saved: true, skipped: false };
}
