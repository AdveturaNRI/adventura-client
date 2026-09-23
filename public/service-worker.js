/* eslint-disable no-undef */
/* Adventura service worker: FCM background + legacy web-push fallback. */

importScripts('/firebase-config.js');
importScripts('https://www.gstatic.com/firebasejs/11.6.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/11.6.0/firebase-messaging-compat.js');

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
    requireInteraction: data.requireInteraction === true || data.requireInteraction === 'true' || isCall,
    data: { url: data.url || '/' },
  };
  return self.registration.showNotification(title, options);
}

if (self.FIREBASE_CONFIG && self.FIREBASE_CONFIG.apiKey) {
  try {
    firebase.initializeApp(self.FIREBASE_CONFIG);
    const messaging = firebase.messaging();
    messaging.onBackgroundMessage((payload) => {
      const data = {
        title:
          (payload.notification && payload.notification.title) ||
          (payload.data && payload.data.title) ||
          'Adventura',
        body:
          (payload.notification && payload.notification.body) ||
          (payload.data && payload.data.body) ||
          'Новое уведомление',
        icon:
          (payload.notification && payload.notification.icon) ||
          (payload.data && payload.data.icon) ||
          '/icons/icon-192.png',
        tag: (payload.data && payload.data.tag) || 'adventura',
        url: (payload.data && payload.data.url) || '/',
      };
      return showPushNotification(data);
    });
  } catch (error) {
    console.warn('[sw] firebase init failed', error);
  }
}

self.addEventListener('push', (event) => {
  // FCM notification payloads are often handled by onBackgroundMessage;
  // keep this for legacy web-push / data-only messages.
  let data = {
    title: 'Adventura',
    body: 'Новое уведомление',
    icon: '/icons/icon-192.png',
    tag: 'adventura',
    url: '/',
  };

  try {
    if (event.data) {
      const parsed = event.data.json();
      data = { ...data, ...parsed };
    }
  } catch {
    try {
      const text = event.data && event.data.text();
      if (text) {
        data.body = text;
      }
    } catch {
      // keep defaults
    }
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
