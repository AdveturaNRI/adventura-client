import { Platform } from 'react-native';

/** Cross-tab auth ping (IndexedDB/AsyncStorage does not fire `storage`). */
const AUTH_SYNC_LS_KEY = '@adventura/auth-sync';
const AUTH_SYNC_CHANNEL = 'adventura-auth';

export type AuthSessionSyncPayload = {
  type: 'save' | 'clear';
  userId: string | null;
  t: number;
};

function canUseWebSync() {
  return Platform.OS === 'web' && typeof window !== 'undefined';
}

/** Notify other tabs that the persisted auth session changed. */
export function publishAuthSessionSync(type: 'save' | 'clear', userId: string | null) {
  if (!canUseWebSync()) {
    return;
  }

  const payload: AuthSessionSyncPayload = { type, userId, t: Date.now() };

  try {
    window.localStorage.setItem(AUTH_SYNC_LS_KEY, JSON.stringify(payload));
  } catch {
    // private mode / quota
  }

  try {
    const channel = new BroadcastChannel(AUTH_SYNC_CHANNEL);
    channel.postMessage(payload);
    channel.close();
  } catch {
    // BroadcastChannel unavailable
  }
}

/** Listen for auth session changes from other tabs. */
export function subscribeAuthSessionSync(onSync: (payload: AuthSessionSyncPayload) => void): () => void {
  if (!canUseWebSync()) {
    return () => undefined;
  }

  const onStorage = (event: StorageEvent) => {
    if (event.key !== AUTH_SYNC_LS_KEY || !event.newValue) {
      return;
    }
    try {
      onSync(JSON.parse(event.newValue) as AuthSessionSyncPayload);
    } catch {
      // ignore bad payload
    }
  };

  window.addEventListener('storage', onStorage);

  let channel: BroadcastChannel | null = null;
  try {
    channel = new BroadcastChannel(AUTH_SYNC_CHANNEL);
    channel.onmessage = (event) => {
      onSync(event.data as AuthSessionSyncPayload);
    };
  } catch {
    channel = null;
  }

  return () => {
    window.removeEventListener('storage', onStorage);
    channel?.close();
  };
}
