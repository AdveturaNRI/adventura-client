/* eslint-disable no-undef */
/* Adventura service worker: FCM background + legacy web-push fallback. */

importScripts('/firebase-config.js');
importScripts('https://www.gstatic.com/firebasejs/11.6.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/11.6.0/firebase-messaging-compat.js');

// Activate on the same page load that fetched this file — user only needs one refresh.
self.addEventListener('install', (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    void self.skipWaiting();
  }
});

function showPushNotification(data) {
  const title = data.title || 'Adventura';
  const tag = data.tag || 'adventura';
  const isCall = typeof tag === 'string' && tag.startsWith('call:');
  const options = {
    body: data.body || '',
    icon: data.icon || '/icons/icon-192.png',
    badge: '/icons/icon-192.png',
    tag,
    renotify: Boolean(data.tag),
    // Keep call toasts visible until dismissed / answered via open.
    requireInteraction:
      data.requireInteraction === true ||
      data.requireInteraction === 'true' ||
      isCall,
    data: { url: data.url || '/' },
  };
  return self.registration.showNotification(title, options);
}

function pickPushFields(source) {
  if (!source || typeof source !== 'object') {
    return null;
  }
  const title = typeof source.title === 'string' ? source.title : null;
  const body = typeof source.body === 'string' ? source.body : null;
  if (!title && !body) {
    return null;
  }
  return {
    title: title || 'Adventura',
    body: body || '',
    icon: typeof source.icon === 'string' ? source.icon : '/icons/icon-192.png',
    tag: typeof source.tag === 'string' ? source.tag : 'adventura',
    url: typeof source.url === 'string' ? source.url : '/',
    requireInteraction: source.requireInteraction,
  };
}

/** True for FCM envelopes — those are shown once via onBackgroundMessage. */
function isFcmPushEnvelope(parsed) {
  if (!parsed || typeof parsed !== 'object') {
    return false;
  }
  return Boolean(
    parsed.from ||
      parsed.messageId ||
      parsed.message_id ||
      parsed.collapse_key ||
      (parsed.data && typeof parsed.data === 'object' && !Array.isArray(parsed.data)) ||
      (parsed.notification && typeof parsed.notification === 'object'),
  );
}

let fcmBackgroundHandlerReady = false;

if (self.FIREBASE_CONFIG && self.FIREBASE_CONFIG.apiKey) {
  try {
    firebase.initializeApp(self.FIREBASE_CONFIG);
    const messaging = firebase.messaging();
    messaging.onBackgroundMessage((payload) => {
      const data =
        pickPushFields(payload && payload.data) ||
        pickPushFields(payload && payload.notification) || {
          title: 'Adventura',
          body: 'Новое уведомление',
          icon: '/icons/icon-192.png',
          tag: 'adventura',
          url: '/',
        };
      return showPushNotification(data);
    });
    fcmBackgroundHandlerReady = true;
  } catch (error) {
    console.warn('[sw] firebase init failed', error);
  }
}

self.addEventListener('push', (event) => {
  // Legacy web-push only. When FCM's onBackgroundMessage is active, showing
  // again here produced a second toast with "Новое уведомление".
  let parsed = null;
  try {
    parsed = event.data ? event.data.json() : null;
  } catch {
    parsed = null;
  }

  if (fcmBackgroundHandlerReady && isFcmPushEnvelope(parsed)) {
    return;
  }

  const data =
    pickPushFields(parsed) ||
    pickPushFields(parsed && parsed.data) ||
    pickPushFields(parsed && parsed.notification);
  if (!data) {
    return;
  }

  event.waitUntil(showPushNotification(data));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = (event.notification.data && event.notification.data.url) || '/';

  event.waitUntil(
    (async () => {
      const absolute =
        typeof targetUrl === 'string' && targetUrl.startsWith('http')
          ? targetUrl
          : new URL(targetUrl, self.location.origin).href;

      const clientsList = await self.clients.matchAll({
        type: 'window',
        includeUncontrolled: true,
      });

      for (const client of clientsList) {
        if ('focus' in client) {
          await client.focus();
          if ('navigate' in client) {
            try {
              await client.navigate(absolute);
              return;
            } catch {
              // fall through
            }
          }
          client.postMessage({ type: 'PUSH_NAVIGATE', url: targetUrl });
          return;
        }
      }

      if (self.clients.openWindow) {
        await self.clients.openWindow(absolute);
      }
    })(),
  );
});
