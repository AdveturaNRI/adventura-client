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
  let videoCanvas = null;

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

  function visible(element) {
    if (!element || !element.isConnected) return false;
    for (let node = element; node && node.nodeType === 1; node = node.parentElement) {
      const style = window.getComputedStyle(node);
      if (node.hidden || node.getAttribute('aria-hidden') === 'true' ||
          style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity) === 0) return false;
    }
    return element.getClientRects().length > 0;
  }

  function visibleControl(selector) {
    return Array.from(document.querySelectorAll(selector)).find(visible) || null;
  }

  function incomingCard(accept, decline) {
    for (let node = accept; node && node !== document.body; node = node.parentElement) {
      if (node.contains(decline) && /Входящий звонок/i.test(node.innerText || '')) return node;
    }
    return null;
  }

  function scrapeTitle(card) {
    if (card) {
      const lines = (card.innerText || '').split(/[\r\n]+/).map((s) => s.trim()).filter(Boolean);
      const heading = lines.findIndex((s) => /^Входящий звонок$/i.test(s));
      if (heading >= 0) {
        // A one-letter avatar placeholder can precede the caller's name.
        const candidates = lines.slice(heading + 1).filter((s) => !/^(Отклонить|Принять|Голосовой чат)$/i.test(s));
        const name = candidates.find((s) => s.length > 1) || candidates[0];
        if (name) return { title: name, peerName: name };
      }
    }
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

  function scrapeAvatar(card) {
    if (!card) return null;
    const imgs = Array.from(card.querySelectorAll('img'));
    for (const img of imgs) {
      const src = img.currentSrc || img.src || '';
      if (!src || src.startsWith('data:image/svg')) {
        continue;
      }
      const r = img.getBoundingClientRect();
      if (visible(img) && r.width >= 48 && r.width <= 220 && r.height >= 48 && r.height <= 220) {
        return src;
      }
    }
    for (const element of card.querySelectorAll('*')) {
      if (!visible(element)) continue;
      const r = element.getBoundingClientRect();
      if (r.width < 48 || r.width > 220 || r.height < 48 || r.height > 220) continue;
      const image = window.getComputedStyle(element).backgroundImage;
      const match = /^url\(["']?(.*?)["']?\)$/.exec(image);
      if (match && /^(https?:|data:image\/)/i.test(match[1])) return match[1];
    }
    return null;
  }

  function capturePeerVideo(peerName) {
    const videos = Array.from(document.querySelectorAll('video')).filter((video) =>
      visible(video) && video.videoWidth > 0 && video.videoHeight > 0 && video.readyState >= 2,
    );
    const peer = (peerName || '').trim().toLocaleLowerCase();
    const isLocal = (text) => /(?:^|\s)вы(?:\s|$)/i.test(text);
    const scored = videos.map((video) => {
      let node = video.parentElement;
      let local = false;
      let matchesPeer = false;
      for (let depth = 0; node && node !== document.body && depth < 7; depth++, node = node.parentElement) {
        const text = (node.innerText || '').trim();
        if (!text) continue;
        if (isLocal(text)) { local = true; break; }
        if (peer && peer !== 'собеседник' && text.toLocaleLowerCase().includes(peer)) { matchesPeer = true; break; }
      }
      return { video, local, matchesPeer };
    }).filter((item) => !item.local);
    const matches = scored.filter((item) => item.matchesPeer);
    const candidates = matches.length ? matches : scored.length === 1 && videos.length === 1 ? scored : [];
    candidates.sort((a, b) => {
      const ar = a.video.getBoundingClientRect();
      const br = b.video.getBoundingClientRect();
      return br.width * br.height - ar.width * ar.height ||
        b.video.videoWidth * b.video.videoHeight - a.video.videoWidth * a.video.videoHeight;
    });
    const video = candidates[0]?.video;
    if (!video) return null;
    try {
      const canvas = videoCanvas || (videoCanvas = document.createElement('canvas'));
      const scale = Math.min(1, 480 / Math.max(video.videoWidth, video.videoHeight));
      const width = Math.max(1, Math.round(video.videoWidth * scale));
      const height = Math.max(1, Math.round(video.videoHeight * scale));
      if (canvas.width !== width) canvas.width = width;
      if (canvas.height !== height) canvas.height = height;
      const context = canvas.getContext('2d');
      if (!context) return null;
      context.drawImage(video, 0, 0, canvas.width, canvas.height);
      return canvas.toDataURL('image/jpeg', 0.6);
    } catch {
      return null;
    }
  }

  function scrape() {
    // React DesktopCallPipController owns the channel.
    if (window.__adventuraPipController) {
      return null;
    }
    if (!bridge()?.updateCallPip) {
      return null;
    }

    const hangup = visibleControl('[aria-label="Завершить звонок"]');
    const accept = visibleControl('[aria-label="Принять"]');
    const decline = visibleControl('[aria-label="Отклонить"]');
    // The active call controls take precedence if an old modal is still mounted.
    const incoming = Boolean(accept && decline && !hangup);
    const inCall = Boolean(hangup) || incoming;

    if (!inCall) {
      return { visible: false };
    }

    const card = incoming ? incomingCard(accept, decline) : null;
    const { title, peerName } = scrapeTitle(card);
    const muted = Boolean(
      document.querySelector('[aria-label*="Включить микрофон"]') ||
        textHas(/микрофон выкл/i),
    );

    let mode = 'active';
    if (incoming) {
      mode = 'incoming';
    } else if (textHas(/Вызов…|Вызов\.\.\.|звоним|ожида/i) && hangup) {
      mode = 'outgoing';
    }

    const frameDataUrl = mode === 'active' ? capturePeerVideo(peerName) : null;
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
      avatarUrl: scrapeAvatar(card),
      frameDataUrl,
      hasVideo: Boolean(frameDataUrl),
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

  window.setInterval(tick, 125);
  window.setTimeout(tick, 100);

  // Fallback actions when React bridge is absent: click in-page controls.
  window.__adventuraPipDomAction = function pipDomAction(action) {
    if (window.__adventuraPipController) {
      return false;
    }
    const click = (sel) => {
      const el = visibleControl(sel);
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
