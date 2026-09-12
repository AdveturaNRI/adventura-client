import { Platform } from 'react-native';

import type { PortalNotification } from '@/services/notifications/notificationsApi';

const SITE_TITLE = 'Adventura';
const MESSAGE_ALERT_TITLE = 'Новое сообщение';
const NOTIFICATION_ALERT_TITLE = 'Новое уведомление';
const BLINK_MS = 900;
const NOTIFY_SOUND_URL = '/sounds/notify.mp3';

let blinkTimer: ReturnType<typeof setInterval> | null = null;
let baseTitle = SITE_TITLE;
let showingAlertTitle = false;
let alertTitle = MESSAGE_ALERT_TITLE;
let permissionAsked = false;

let audioContext: AudioContext | null = null;
let notifyBuffer: AudioBuffer | null = null;
let bufferLoad: Promise<AudioBuffer | null> | null = null;
let unlocked = false;

function canUseWebAlerts() {
  return Platform.OS === 'web' && typeof window !== 'undefined' && typeof document !== 'undefined';
}

function getAudioContext() {
  if (!canUseWebAlerts()) {
    return null;
  }
  const Ctx =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctx) {
    return null;
  }
  if (!audioContext) {
    audioContext = new Ctx();
  }
  return audioContext;
}

async function loadNotifyBuffer(context: AudioContext) {
  if (notifyBuffer) {
    return notifyBuffer;
  }
  if (bufferLoad) {
    return bufferLoad;
  }

  bufferLoad = (async () => {
    try {
      const response = await fetch(NOTIFY_SOUND_URL, { cache: 'force-cache' });
      if (!response.ok) {
        return null;
      }
      const data = await response.arrayBuffer();
      notifyBuffer = await context.decodeAudioData(data.slice(0));
      return notifyBuffer;
    } catch {
      return null;
    } finally {
      bufferLoad = null;
    }
  })();

  return bufferLoad;
}

function playFallbackBeep(context: AudioContext) {
  const now = context.currentTime;
  const gain = context.createGain();
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(0.22, now + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.28);
  gain.connect(context.destination);

  const osc = context.createOscillator();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(880, now);
  osc.frequency.exponentialRampToValueAtTime(660, now + 0.22);
  osc.connect(gain);
  osc.start(now);
  osc.stop(now + 0.3);
}

function playBuffer(context: AudioContext, buffer: AudioBuffer) {
  const source = context.createBufferSource();
  source.buffer = buffer;
  const gain = context.createGain();
  gain.gain.value = 1;
  source.connect(gain);
  gain.connect(context.destination);
  source.start(0);
}

export function unlockChatAlerts() {
  if (!canUseWebAlerts()) {
    return;
  }

  if (!permissionAsked && typeof Notification !== 'undefined' && Notification.permission === 'default') {
    permissionAsked = true;
    void Notification.requestPermission();
  }

  const context = getAudioContext();
  if (!context) {
    return;
  }

  const resume =
    context.state === 'suspended'
      ? context.resume().then(() => {
          unlocked = true;
        })
      : Promise.resolve().then(() => {
          unlocked = true;
        });

  void resume
    .then(() => loadNotifyBuffer(context))
    .catch(() => {
      // Keep trying on the next gesture.
      unlocked = false;
    });
}

export function playIncomingMessageSound() {
  const context = getAudioContext();
  if (!context) {
    return;
  }

  const run = async () => {
    if (context.state === 'suspended') {
      try {
        await context.resume();
        unlocked = true;
      } catch {
        unlocked = false;
        return;
      }
    }

    const buffer = notifyBuffer ?? (await loadNotifyBuffer(context));
    if (buffer) {
      playBuffer(context, buffer);
      return;
    }

    playFallbackBeep(context);
  };

  void run().catch(() => {
    unlocked = false;
  });
}

function startTitleBlink(title: string) {
  if (!canUseWebAlerts()) {
    return;
  }

  alertTitle = title;
  if (!blinkTimer) {
    baseTitle =
      document.title &&
      document.title !== MESSAGE_ALERT_TITLE &&
      document.title !== NOTIFICATION_ALERT_TITLE &&
      document.title !== 'Вас добавили в избранные'
        ? document.title
        : SITE_TITLE;
  } else {
    clearInterval(blinkTimer);
  }

  showingAlertTitle = true;
  document.title = alertTitle;
  blinkTimer = setInterval(() => {
    showingAlertTitle = !showingAlertTitle;
    document.title = showingAlertTitle ? alertTitle : baseTitle;
  }, BLINK_MS);
}

export function startNewMessageTitleBlink() {
  startTitleBlink(MESSAGE_ALERT_TITLE);
}

export function stopNewMessageTitleBlink() {
  if (!canUseWebAlerts()) {
    return;
  }
  if (blinkTimer) {
    clearInterval(blinkTimer);
    blinkTimer = null;
  }
  showingAlertTitle = false;
  document.title = baseTitle || SITE_TITLE;
}

export function notifyIncomingChatMessage() {
  playIncomingMessageSound();
  startTitleBlink(MESSAGE_ALERT_TITLE);
}

function showDesktopPush(title: string, body: string) {
  if (!canUseWebAlerts() || typeof Notification === 'undefined') {
    return;
  }
  if (Notification.permission !== 'granted') {
    return;
  }
  try {
    new Notification(title, { body, silent: true });
  } catch {
    // ignore unsupported notification payloads
  }
}

export function notifyIncomingPortalNotification(options?: {
  type?: PortalNotification['type'];
  actorName?: string;
  subject?: string;
}) {
  playIncomingMessageSound();
  if (options?.type === 'favorite_returned') {
    const title = 'Вас добавили в избранные';
    const body = options.actorName
      ? `${options.actorName} добавил вас в избранные в ответ`
      : 'Вас добавили в избранные в ответ';
    startTitleBlink(title);
    showDesktopPush(title, body);
    return;
  }

  if (options?.type === 'game_application') {
    const title = 'Новая заявка на игру';
    const body = options.actorName
      ? `${options.actorName} подал заявку${options.subject ? ` на «${options.subject}»` : ''}`
      : options.subject
        ? `Заявка на «${options.subject}»`
        : 'Кто-то подал заявку на ваш стол';
    startTitleBlink(title);
    showDesktopPush(title, body);
    return;
  }

  if (options?.type === 'game_application_accepted') {
    const title = 'Вас приняли за стол';
    const body = options.subject
      ? options.actorName
        ? `${options.actorName} принял вас на «${options.subject}»`
        : `Вас приняли на «${options.subject}»`
      : options.actorName
        ? `${options.actorName} принял вашу заявку`
        : 'Мастер принял вашу заявку';
    startTitleBlink(title);
    showDesktopPush(title, body);
    return;
  }

  if (options?.type === 'game_application_rejected') {
    const title = 'Заявку отклонили';
    const body = options.subject
      ? options.actorName
        ? `${options.actorName} отклонил заявку на «${options.subject}»`
        : `Заявку на «${options.subject}» отклонили`
      : options.actorName
        ? `${options.actorName} отклонил вашу заявку`
        : 'Мастер отклонил вашу заявку';
    startTitleBlink(title);
    showDesktopPush(title, body);
    return;
  }

  if (options?.type === 'game_player_removed') {
    const title = 'Вас убрали из игры';
    const body = options.subject
      ? options.actorName
        ? `${options.actorName} убрал вас из «${options.subject}»`
        : `Вас убрали из «${options.subject}»`
      : options.actorName
        ? `${options.actorName} убрал вас из состава`
        : 'Мастер убрал вас из состава';
    startTitleBlink(title);
    showDesktopPush(title, body);
    return;
  }

  startTitleBlink(NOTIFICATION_ALERT_TITLE);
  if (options?.actorName) {
    showDesktopPush(
      NOTIFICATION_ALERT_TITLE,
      `${options.actorName} ${options.type === 'favorite_received' ? 'добавил вас в избранные' : ''}`.trim(),
    );
  }
}
