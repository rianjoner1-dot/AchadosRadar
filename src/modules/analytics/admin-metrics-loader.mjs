/**
 * Creates a latest-request-wins loader for the admin metrics panel.
 * @param {{ getSession: () => Promise<unknown>, fetchMetrics: (session: unknown, days: string) => Promise<unknown>, onLoading?: () => void, onUnauthenticated?: () => void, onSuccess?: (result: unknown) => void, onError?: (error: unknown) => void }} options
 */
export function createAdminMetricsLoader(options) {
  let currentRequest = 0;

  return async function loadAdminMetrics(days) {
    const requestId = ++currentRequest;
    options.onLoading?.();
    try {
      const session = await options.getSession();
      if (requestId !== currentRequest) return;
      if (!session) {
        options.onUnauthenticated?.();
        return;
      }

      const result = await options.fetchMetrics(session, days);
      if (requestId !== currentRequest) return;
      options.onSuccess?.(result);
    } catch (error) {
      if (requestId !== currentRequest) return;
      options.onError?.(error);
    }
  };
}
