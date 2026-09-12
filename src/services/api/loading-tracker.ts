let activeRequests = 0;
const listeners = new Set<(isLoading: boolean) => void>();

function notify() {
  const isLoading = activeRequests > 0;
  listeners.forEach((listener) => listener(isLoading));
}

export function subscribeLoading(listener: (isLoading: boolean) => void) {
  listeners.add(listener);
  listener(activeRequests > 0);

  return () => {
    listeners.delete(listener);
  };
}

export function getIsLoading() {
  return activeRequests > 0;
}

export async function withLoading<T>(promise: Promise<T>): Promise<T> {
  activeRequests += 1;
  notify();

  try {
    return await promise;
  } finally {
    activeRequests = Math.max(0, activeRequests - 1);
    notify();
  }
}
