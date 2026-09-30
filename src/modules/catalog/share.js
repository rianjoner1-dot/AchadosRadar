export async function shareProductLink({ title, url, navigatorApi, documentApi }) {
  if (typeof navigatorApi?.share === 'function') {
    try {
      await navigatorApi.share({ title, url });
      return 'shared';
    } catch (error) {
      if (error?.name === 'AbortError') return 'cancelled';
    }
  }

  if (typeof navigatorApi?.clipboard?.writeText === 'function') {
    try {
      await navigatorApi.clipboard.writeText(url);
      return 'copied';
    } catch { /* try selection-based copy below */ }
  }

  if (typeof documentApi?.execCommand !== 'function' || !documentApi.body) return 'manual';
  const field = documentApi.createElement('textarea');
  field.value = url;
  field.setAttribute('readonly', '');
  field.style.cssText = 'position:fixed;left:-9999px;top:0;opacity:0';
  const previousFocus = documentApi.activeElement;
  try {
    documentApi.body.appendChild(field);
    field.select();
    if (documentApi.execCommand('copy')) return 'copied';
    return 'manual';
  } catch {
    return 'manual';
  } finally {
    field.remove();
    previousFocus?.focus?.();
  }
}
