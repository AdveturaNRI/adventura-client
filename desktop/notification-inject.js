// Forward browser notifications and support older builds that only blink the title.
(() => {
  if (window.__adventuraNotificationWatcher) return;
  window.__adventuraNotificationWatcher = true;

  const NativeNotification = window.Notification;
  if (NativeNotification) {
    window.Notification = new Proxy(NativeNotification, {
      get(target, property) {
        if (property === 'permission') return 'granted';
        if (property === 'requestPermission') return (callback) => {
          if (typeof callback === 'function') callback('granted');
          return Promise.resolve('granted');
        };
        return Reflect.get(target, property, target);
      },
      construct(target, args) {
        const [title, options = {}] = args;
        void window.adventuraDesktop?.notify({ title: String(title), body: String(options.body || '') });
        // Preserve the Notification object and its event API without showing a
        // second system notification.
        return new EventTarget();
      },
    });
  }

  // A title blink repeats while unread, so treat the entire blink as one event.
  // The timeout ends an episode only after the title has stopped changing.
  let episodeActive = false;
  let quietTimer = null;
  let lastTitle = typeof document !== 'undefined' ? document.title.trim() : '';
  const onTitleChange = () => {
    const title = document.title.trim();
    if (title === lastTitle) return;
    lastTitle = title;
    if (quietTimer) window.clearTimeout(quietTimer);
    quietTimer = window.setTimeout(() => { episodeActive = false; quietTimer = null; }, 2500);
    if (title !== 'Новое сообщение' && title !== 'Новое уведомление') return;
    if (episodeActive) return;
    episodeActive = true;
    window.setTimeout(() => {
      void window.adventuraDesktop?.notify({ title, body: 'Откройте Adventura, чтобы посмотреть.', titleFallback: true });
    }, 750);
  };
  if (typeof document !== 'undefined' && document.head && typeof MutationObserver !== 'undefined') {
    new MutationObserver(onTitleChange).observe(document.head, { subtree: true, childList: true, characterData: true });
  }
})();
