/* Adventura push-only service worker — no offline caching. */

self.addEventListener('push', (event) => {
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

  event.waitUntil(
    self.registration.showNotification(data.title || 'Adventura', {
      body: data.body || '',
      icon: data.icon || '/icons/icon-192.png',
      badge: '/icons/icon-192.png',
      tag: data.tag || 'adventura',
      renotify: Boolean(data.tag),
      data: { url: data.url || '/' },
    }),
  );
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
