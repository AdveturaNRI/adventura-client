import { Platform } from 'react-native';

import { apiRequest } from '@/services/api/client';

const SW_PATH = '/service-worker.js';

/** Временно скрыто: пункт в настройках и все запросы разрешения. */
export const WEB_PUSH_OPT_IN_ENABLED = false;

type VapidPublicKeyResponse = {
  publicKey: string | null;
  enabled: boolean;
};

type PushStatusResponse = {
  subscribed: boolean;
};

function canUseWebPush(): boolean {
  return (
    Platform.OS === 'web' &&
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    typeof Notification !== 'undefined'
  );
}

export function isWebPushSupported(): boolean {
  return canUseWebPush();
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

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i += 1) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

async function ensureServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!canUseWebPush()) {
    return null;
  }
  return navigator.serviceWorker.register(SW_PATH);
}

export async function getCurrentPushEndpoint(): Promise<string | null> {
  if (!canUseWebPush()) {
    return null;
  }
  const registration = await navigator.serviceWorker.getRegistration(SW_PATH);
  const subscription = await registration?.pushManager.getSubscription();
  return subscription?.endpoint ?? null;
}

export async function fetchPushStatusForThisDevice(): Promise<boolean> {
  const endpoint = await getCurrentPushEndpoint();
  if (!endpoint) {
    return false;
  }
  const status = await apiRequest<PushStatusResponse>(
    `/push/subscriptions/status?endpoint=${encodeURIComponent(endpoint)}`,
    { skipLoading: true },
  );
  return status.subscribed;
}

export async function enableWebPush(): Promise<{ ok: boolean; reason?: string }> {
  if (!WEB_PUSH_OPT_IN_ENABLED) {
    return { ok: false, reason: 'unsupported' };
  }
  if (!canUseWebPush()) {
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

  const vapid = await apiRequest<VapidPublicKeyResponse>('/push/vapid-public-key', {
    skipLoading: true,
  });
  if (!vapid?.enabled || !vapid.publicKey?.trim()) {
    return { ok: false, reason: 'server_disabled' };
  }

  let applicationServerKey: Uint8Array;
  try {
    applicationServerKey = urlBase64ToUint8Array(vapid.publicKey.trim());
    // VAPID public key is an uncompressed P-256 point (65 bytes).
    if (applicationServerKey.byteLength !== 65) {
      return { ok: false, reason: 'server_disabled' };
    }
  } catch {
    return { ok: false, reason: 'server_disabled' };
  }

  const registration = await ensureServiceWorker();
  if (!registration) {
    return { ok: false, reason: 'unsupported' };
  }

  await navigator.serviceWorker.ready;

  let subscription = await registration.pushManager.getSubscription();
  try {
    if (!subscription) {
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: applicationServerKey as BufferSource,
      });
    }
  } catch {
    // Старая подписка могла быть на другой/битый VAPID — пересоздаём.
    try {
      await subscription?.unsubscribe();
    } catch {
      // ignore
    }
    try {
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: applicationServerKey as BufferSource,
      });
    } catch {
      return { ok: false, reason: 'subscribe_failed' };
    }
  }

  const json = subscription.toJSON();
  if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) {
    return { ok: false, reason: 'subscribe_failed' };
  }

  await apiRequest('/push/subscriptions', {
    method: 'POST',
    body: {
      endpoint: json.endpoint,
      keys: {
        p256dh: json.keys.p256dh,
        auth: json.keys.auth,
      },
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : undefined,
    },
  });

  return { ok: true };
}

export async function disableWebPush(): Promise<void> {
  if (!canUseWebPush()) {
    return;
  }

  const registration = await navigator.serviceWorker.getRegistration(SW_PATH);
  const subscription = await registration?.pushManager.getSubscription();
  if (!subscription) {
    return;
  }

  const endpoint = subscription.endpoint;
  try {
    await apiRequest('/push/subscriptions', {
      method: 'DELETE',
      body: { endpoint },
    });
  } catch {
    // Still drop local subscription if API fails (e.g. already gone).
  }

  await subscription.unsubscribe();
}
