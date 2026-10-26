import { useEffect, useRef } from 'react';
import { AppState, Platform } from 'react-native';

function isAppVisible(): boolean {
  if (Platform.OS === 'web') {
    return typeof document === 'undefined' || document.visibilityState === 'visible';
  }
  return AppState.currentState === 'active';
}

/**
 * Runs `refresh` on mount, then every `intervalMs` while the app is visible and right
 * away when the user comes back to the tab or app. A run is skipped while one is in flight.
 */
export function useVisiblePoll(refresh: () => Promise<unknown> | void, intervalMs: number) {
  const refreshRef = useRef(refresh);
  useEffect(() => {
    refreshRef.current = refresh;
  });

  useEffect(() => {
    let inflight = false;
    const run = async (force = false) => {
      if (inflight || (!force && !isAppVisible())) return;
      inflight = true;
      try {
        await refreshRef.current();
      } catch {
        // Next tick retries; callers keep their last good data.
      } finally {
        inflight = false;
      }
    };
    const onVisible = () => {
      void run();
    };

    void run(true);
    const pollId = setInterval(onVisible, intervalMs);
    const appStateSub = AppState.addEventListener('change', onVisible);
    const web = Platform.OS === 'web' && typeof window !== 'undefined';
    if (web) {
      document.addEventListener('visibilitychange', onVisible);
      window.addEventListener('focus', onVisible);
    }
    return () => {
      clearInterval(pollId);
      appStateSub.remove();
      if (web) {
        document.removeEventListener('visibilitychange', onVisible);
        window.removeEventListener('focus', onVisible);
      }
    };
  }, [intervalMs]);
}
