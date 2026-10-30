/**
 * Injected into the main BrowserWindow. Drives OS call PiP when the loaded
 * web build does not include DesktopCallPipController (production today).
 * Skips itself once window.__adventuraPipController is set by the React bridge.
 */
(function adventuraCallPresenceInject() {
  if (window.__adventuraPipWatchInstalled) {
    return;
  }
  window.__adventuraPipWatchInstalled = true;

  let lastKey = '';
  let hideTimer = null;

  function bridge() {
    return window.adventuraDesktop;
  }

  function textHas(re) {
    try {
      return re.test(document.body ? document.body.innerText : '');
    } catch {
      return false;
    }
  }

  function scrapeTitle() {
    const body = document.body ? document.body.innerText : '';
    const group = body.match(/Группа\s*·\s*([^\n\r]+)/);
    if (group) {
      return { title: `Группа · ${group[1].trim()}`, peerName: group[1].trim() };
    }
    const call = body.match(/Звонок\s*·\s*([^\n\r]+)/);
    if (call) {
      return { title: `Звонок · ${call[1].trim()}`, peerName: call[1].trim() };
    }
    const incomingName = body.match(/([^\n\r]{2,40})\s+звонит/i);
    if (incomingName) {
      return { title: incomingName[1].trim(), peerName: incomingName[1].trim() };
    }
    return { title: 'Звонок Adventura', peerName: 'Собеседник' };
  }

  function scrapeAvatar() {
    const imgs = Array.from(document.querySelectorAll('img'));
    for (const img of imgs) {
      const src = img.currentSrc || img.src || '';
      if (!src || src.startsWith('data:image/svg')) {
        continue;
      }
      const r = img.getBoundingClientRect();
      if (r.width >= 48 && r.width <= 220 && r.height >= 48 && r.height <= 220) {
        return src;
      }
    }
    return null;
  }

  function scrape() {
    // React DesktopCallPipController owns the channel.
    if (window.__adventuraPipController) {
      return null;
    }
    if (!bridge()?.updateCallPip) {
      return null;
    }

    const hangup = document.querySelector('[aria-label="Завершить звонок"]');
    const accept = document.querySelector('[aria-label="Принять"]');
    const decline = document.querySelector('[aria-label="Отклонить"]');
    const incoming = Boolean(accept && decline);
    const inCall = Boolean(hangup) || incoming;

    if (!inCall) {
      return { visible: false };
    }

    const { title, peerName } = scrapeTitle();
    const muted = Boolean(
      document.querySelector('[aria-label*="Включить микрофон"]') ||
        textHas(/микрофон выкл/i),
    );

    let mode = 'active';
    if (incoming && !hangup) {
      mode = 'incoming';
    } else if (textHas(/Вызов…|Вызов\.\.\.|звоним|ожида/i) && hangup) {
      mode = 'outgoing';
    }

    return {
      visible: true,
      mode,
      title,
      subtitle:
        mode === 'incoming'
          ? 'Входящий звонок'
          : mode === 'outgoing'
            ? 'Вызов…'
            : 'Голосовой звонок',
      peerName,
      avatarUrl: scrapeAvatar(),
      frameDataUrl: null,
      hasVideo: false,
      muted,
      durationSec: null,
      source: 'dom-watch',
    };
  }

  function tick() {
    const state = scrape();
    if (!state) {
      return;
    }
    const key = JSON.stringify(state);
    if (key === lastKey) {
      return;
    }
    lastKey = key;

    if (!state.visible) {
      if (hideTimer) {
        return;
      }
      // Debounce hide — RN modal remounts can briefly drop aria nodes.
      hideTimer = window.setTimeout(() => {
        hideTimer = null;
        lastKey = JSON.stringify({ visible: false });
        void bridge()?.updateCallPip?.({ visible: false });
      }, 1200);
      return;
    }

    if (hideTimer) {
      window.clearTimeout(hideTimer);
      hideTimer = null;
    }
    void bridge()?.updateCallPip?.(state);
  }

  window.setInterval(tick, 700);
  window.setTimeout(tick, 400);

  // Fallback actions when React bridge is absent: click in-page controls.
  window.__adventuraPipDomAction = function pipDomAction(action) {
    if (window.__adventuraPipController) {
      return false;
    }
    const click = (sel) => {
      const el = document.querySelector(sel);
      if (el) {
        el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
        return true;
      }
      return false;
    };
    switch (action) {
      case 'hangup':
        return click('[aria-label="Завершить звонок"]');
      case 'accept':
        return click('[aria-label="Принять"]');
      case 'decline':
        return click('[aria-label="Отклонить"]');
      case 'mute': {
        return (
          click('[aria-label*="Выключить микрофон"]') ||
          click('[aria-label*="Включить микрофон"]')
        );
      }
      case 'expand':
        return true;
      default:
        return false;
    }
  };
})();
