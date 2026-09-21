import { Platform } from 'react-native';

import { apiRequest } from '@/services/api/client';
import {
  firebaseWebConfig,
  firebaseWebVapidKey,
  isFirebaseWebConfigured,
} from '@/services/push/firebase-config';

const SW_PATH = '/service-worker.js';
const FCM_TOKEN_KEY = '@adventura/fcm-device-token';

/** Firebase Cloud Messaging opt-in (settings + soft prompt). */
export const WEB_PUSH_OPT_IN_ENABLED = true;

type VapidPublicKeyResponse = {
  publicKey: string | null;
  enabled: boolean;
  provider?: 'fcm' | 'webpush';
  reason?: 'missing_vapid' | 'provider_unconfigured' | null;
};

type PushStatusResponse = {
  subscribed: boolean;
};

let messagingPromise: Promise<import('firebase/messaging').Messaging | null> | null =
  null;
let vapidCache: { key: string; at: number } | null = null;
const VAPID_CACHE_MS = 5 * 60_000;

function canUseWebPushApis(): boolean {
  return (
    Platform.OS === 'web' &&
    typeof window !== 'undefined' &&
    typeof navigator !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    typeof Notification !== 'undefined'
  );
}

/** Low-level browser APIs only (no Firebase / VAPID). */
function canUseWebPush(): boolean {
  return canUseWebPushApis() && Boolean(window.isSecureContext);
}

export type WebPushBlockReason =
  | null
  | 'unsupported'
  | 'insecure'
  | 'firebase_unconfigured';

/** Why the settings toggle is disabled — null means ready. */
export function getWebPushBlockReason(): WebPushBlockReason {
  if (Platform.OS !== 'web' || typeof window === 'undefined') {
    return 'unsupported';
  }
  if (!window.isSecureContext) {
    return 'insecure';
  }
  if (!canUseWebPushApis()) {
    return 'unsupported';
  }
  if (!isFirebaseWebConfigured()) {
    return 'firebase_unconfigured';
  }
  return null;
}

export function isWebPushSupported(): boolean {
  return getWebPushBlockReason() === null;
}

export function webPushBlockHint(reason: WebPushBlockReason): string | null {
  switch (reason) {
    case 'insecure':
      return 'Пуши работают только по HTTPS или localhost. Сейчас страница открыта по обычному http — открой защищённый адрес.';
    case 'firebase_unconfigured':
      return 'В этом билде не задан Firebase (EXPO_PUBLIC_FIREBASE_*). Браузер пуши умеет — не хватает конфига приложения.';
    case 'unsupported':
      return 'Этот браузер не поддерживает веб-пуши.';
    default:
      return null;
  }
}

export function getNotificationPermission(): NotificationPermission | 'unsupported' {
  if (!canUseWebPush()) {
    return 'unsupported';
  }
  return Notification.permission;
}

export function isIosSafariNeedPwaHint(): boolean {
  if (Platform.OS !== 'web' || typeof window === 'undefined' || typeof navigator === 'undefined') {
    return false;
  }

  const ua = navigator.userAgent || '';
  const isIos =
    /iPad|iPhone|iPod/.test(ua) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  if (!isIos) {
    return false;
  }

  const isStandalone =
    window.matchMedia('(display-mode: standalone)').matches ||
    // @ts-expect-error iOS Safari
    Boolean(navigator.standalone);

  return !isStandalone;
}

function rememberToken(token: string | null) {
  try {
    if (typeof localStorage === 'undefined') {
      return;
    }
    if (token) {
      localStorage.setItem(FCM_TOKEN_KEY, token);
    } else {
      localStorage.removeItem(FCM_TOKEN_KEY);
    }
  } catch {
    // ignore
  }
}

function readRememberedToken(): string | null {
  try {
    if (typeof localStorage === 'undefined') {
      return null;
    }
    return localStorage.getItem(FCM_TOKEN_KEY);
  } catch {
    return null;
  }
}

async function ensureServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!canUseWebPush()) {
    return null;
  }
  return navigator.serviceWorker.register(SW_PATH);
}

async function getFirebaseMessaging(): Promise<
  import('firebase/messaging').Messaging | null
> {
  if (!canUseWebPush() || !isFirebaseWebConfigured()) {
    return null;
  }
  if (!messagingPromise) {
    messagingPromise = (async () => {
      const { initializeApp, getApps } = await import('firebase/app');
      const { getMessaging, isSupported } = await import('firebase/messaging');
      if (!(await isSupported())) {
        return null;
      }
      const app =
        getApps().length > 0 ? getApps()[0]! : initializeApp(firebaseWebConfig);
      return getMessaging(app);
    })().catch(() => null);
  }
  return messagingPromise;
}

/**
 * VAPID for FCM getToken: server key → client EXPO_PUBLIC_FIREBASE_VAPID_KEY.
 * Cached — settings/prompt otherwise spam /push/vapid-public-key.
 */
async function resolveVapidKey(): Promise<{
  key: string | null;
  reason?: 'missing_vapid' | 'provider_unconfigured' | 'server_disabled';
}> {
  if (vapidCache && Date.now() - vapidCache.at < VAPID_CACHE_MS) {
    return { key: vapidCache.key };
  }

  try {
    const vapid = await apiRequest<VapidPublicKeyResponse>('/push/vapid-public-key', {
      skipLoading: true,
    });
    const serverKey = vapid?.publicKey?.trim() || '';
    if (vapid?.enabled && serverKey) {
      vapidCache = { key: serverKey, at: Date.now() };
      return { key: serverKey };
    }
    if (firebaseWebVapidKey) {
      vapidCache = { key: firebaseWebVapidKey, at: Date.now() };
      return { key: firebaseWebVapidKey };
    }
    return {
      key: null,
      reason: vapid?.reason === 'missing_vapid' ? 'missing_vapid' : 'server_disabled',
    };
  } catch {
    if (firebaseWebVapidKey) {
      vapidCache = { key: firebaseWebVapidKey, at: Date.now() };
      return { key: firebaseWebVapidKey };
    }
    return { key: null, reason: 'server_disabled' };
  }
}

export async function getCurrentPushEndpoint(): Promise<string | null> {
  return readRememberedToken();
}

export async function fetchPushStatusForThisDevice(): Promise<boolean> {
  const token = readRememberedToken();
  if (!token) {
    return false;
  }
  const status = await apiRequest<PushStatusResponse>(
    `/push/fcm-tokens/status?token=${encodeURIComponent(token)}`,
    { skipLoading: true },
  );
  return status.subscribed;
}

/**
 * Re-bind current device FCM token to the logged-in user (no permission prompt).
 * Call after login / session restore when Notification.permission === 'granted'.
 */
export async function syncWebPushToUser(): Promise<boolean> {
  if (!WEB_PUSH_OPT_IN_ENABLED || !canUseWebPush() || !isFirebaseWebConfigured()) {
    return false;
  }
  if (Notification.permission !== 'granted') {
    return false;
  }
  if (isIosSafariNeedPwaHint()) {
    return false;
  }

  try {
    const { key } = await resolveVapidKey();
    if (!key) {
      return false;
    }

    const registration = await ensureServiceWorker();
    if (!registration) {
      return false;
    }
    await navigator.serviceWorker.ready;

    const messaging = await getFirebaseMessaging();
    if (!messaging) {
      return false;
    }

    const { getToken } = await import('firebase/messaging');
    const token = await getToken(messaging, {
      vapidKey: key,
      serviceWorkerRegistration: registration,
    });
    if (!token) {
      return false;
    }

    rememberToken(token);
    await apiRequest('/push/fcm-tokens', {
      method: 'POST',
      body: {
        token,
        userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : undefined,
      },
      skipLoading: true,
    });
    return true;
  } catch {
    return false;
  }
}

export async function enableWebPush(): Promise<{ ok: boolean; reason?: string }> {
  if (!WEB_PUSH_OPT_IN_ENABLED) {
    return { ok: false, reason: 'unsupported' };
  }
  if (!canUseWebPush() || !isFirebaseWebConfigured()) {
    return { ok: false, reason: 'unsupported' };
  }

  if (isIosSafariNeedPwaHint()) {
    return { ok: false, reason: 'ios_pwa' };
  }

  // Must run in the same user-gesture turn as the click, before any await —
  // otherwise Chrome/Safari may not show the system permission dialog.
  const permission =
    Notification.permission === 'granted'
      ? 'granted'
      : await Notification.requestPermission();

  if (permission !== 'granted') {
    return { ok: false, reason: 'denied' };
  }

  const { key, reason: vapidReason } = await resolveVapidKey();
  if (!key) {
    return { ok: false, reason: vapidReason ?? 'server_disabled' };
  }

  const registration = await ensureServiceWorker();
  if (!registration) {
    return { ok: false, reason: 'unsupported' };
  }

  await navigator.serviceWorker.ready;

  const messaging = await getFirebaseMessaging();
  if (!messaging) {
    return { ok: false, reason: 'unsupported' };
  }

  let token: string;
  try {
    const { getToken } = await import('firebase/messaging');
    token = await getToken(messaging, {
      vapidKey: key,
      serviceWorkerRegistration: registration,
    });
  } catch {
    return { ok: false, reason: 'subscribe_failed' };
  }

  if (!token) {
    return { ok: false, reason: 'subscribe_failed' };
  }

  rememberToken(token);

  try {
    await apiRequest('/push/fcm-tokens', {
      method: 'POST',
      body: {
        token,
        userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : undefined,
      },
    });
  } catch {
    return { ok: false, reason: 'server_disabled' };
  }

  return { ok: true };
}

export async function disableWebPush(): Promise<void> {
  if (!canUseWebPush()) {
    return;
  }

  const token = readRememberedToken();
  if (token) {
    try {
      await apiRequest('/push/fcm-tokens', {
        method: 'DELETE',
        body: { token },
        skipLoading: true,
      });
    } catch {
      // Still drop local token if API fails.
    }
  }

  try {
    const messaging = await getFirebaseMessaging();
    if (messaging) {
      const { deleteToken } = await import('firebase/messaging');
      await deleteToken(messaging);
    }
  } catch {
    // ignore
  }

  rememberToken(null);
}
