import { AppState, Platform } from 'react-native';

import { emitPresenceActive, emitPresenceIdle, getRealtimeSocket } from '@/services/realtime/socket';

/** Matches the server: one ping keeps «в сети» for 90 s. */
const HEARTBEAT_MS = 30_000;
/** Short tab switches shouldn't flip the user offline. */
const HIDDEN_GRACE_MS = 60_000;
/** No mouse / keyboard / touch for this long on web — the user walked away. */
const IDLE_AFTER_MS = 5 * 60_000;

const WEB_ACTIVITY_EVENTS = ['pointerdown', 'pointermove', 'keydown', 'wheel', 'touchstart', 'scroll'] as const;

function isVisible() {
  if (Platform.OS === 'web') {
    return typeof document === 'undefined' || document.visibilityState === 'visible';
  }
  return AppState.currentState === 'active';
}

/**
 * Reports «в сети» to the server only while the user is actually here: the tab is visible
 * (or was hidden for under a minute) and, on web, there was input in the last 5 minutes.
 * The socket itself stays connected in background for messages and calls.
 */
export function startPresenceTracking(): () => void {
  let active = false;
  let lastInteractionAt = Date.now();
  let hiddenSince: number | null = isVisible() ? null : Date.now();

  const shouldBeActive = () => {
    const now = Date.now();
    if (hiddenSince != null && now - hiddenSince >= HIDDEN_GRACE_MS) return false;
    if (Platform.OS === 'web' && now - lastInteractionAt >= IDLE_AFTER_MS) return false;
    return true;
  };

  const sync = (heartbeat = false) => {
    const next = shouldBeActive();
    if (next) {
      if (!active || heartbeat) emitPresenceActive();
    } else if (active) {
      emitPresenceIdle(hiddenSince ?? lastInteractionAt);
    }
    active = next;
  };

  const onInteraction = () => {
    lastInteractionAt = Date.now();
    if (!active) sync();
  };

  const onVisibility = (visible: boolean) => {
    if (visible) {
      hiddenSince = null;
      lastInteractionAt = Date.now();
    } else {
      hiddenSince ??= Date.now();
    }
    sync();
  };

  // A fresh socket starts as not active on the server — restate what we know.
  const onConnect = () => {
    if (active) emitPresenceActive();
  };

  sync(true);
  const interval = setInterval(() => sync(true), HEARTBEAT_MS);
  const socket = getRealtimeSocket();
  socket?.on('connect', onConnect);

  const appSub = AppState.addEventListener('change', (state) => {
    if (Platform.OS !== 'web') onVisibility(state === 'active');
  });

  const onVisibilityChange = () => onVisibility(isVisible());
  const web = Platform.OS === 'web' && typeof window !== 'undefined' && typeof document !== 'undefined';
  if (web) {
    document.addEventListener('visibilitychange', onVisibilityChange);
    for (const name of WEB_ACTIVITY_EVENTS) {
      window.addEventListener(name, onInteraction, { passive: true, capture: true });
    }
  }

  return () => {
    clearInterval(interval);
    socket?.off('connect', onConnect);
    appSub.remove();
    if (web) {
      document.removeEventListener('visibilitychange', onVisibilityChange);
      for (const name of WEB_ACTIVITY_EVENTS) {
        window.removeEventListener(name, onInteraction, { capture: true });
      }
    }
  };
}
