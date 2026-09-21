import { Platform } from 'react-native';

import type { PortalNotification } from '@/services/notifications/notificationsApi';
import {
  getEffectiveNotificationSoundUrl,
  getNotificationSoundSettingsSync,
} from '@/utils/notification-sound-settings';
import { getPortalNotificationCopy } from '@/utils/portal-notification-copy';

const SITE_TITLE = 'Adventura';
const MESSAGE_ALERT_TITLE = 'Новое сообщение';
const NOTIFICATION_ALERT_TITLE = 'Новое уведомление';
const BLINK_MS = 900;
const SOUND_COOLDOWN_MS = 800;

let blinkTimer: ReturnType<typeof setInterval> | null = null;
let baseTitle = SITE_TITLE;
let showingAlertTitle = false;
let alertTitle = MESSAGE_ALERT_TITLE;

let lastSoundAt = 0;
let lastPreviewAt = 0;
let focusedConversationId: string | null = null;
/** Один HTMLAudioElement на вкладку — иначе new Audio(url)+preload даёт 2× GET. */
let sharedAudio: HTMLAudioElement | null = null;
const PREVIEW_GUARD_MS = 350;

function canUseWebAlerts() {
  return Platform.OS === 'web' && typeof window !== 'undefined' && typeof document !== 'undefined';
}

function resolveAudioUrl(url: string): string {
  if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('blob:')) {
    return url;
  }
  return new URL(url, window.location.origin).href;
}

function getSharedAudio(): HTMLAudioElement {
  if (!sharedAudio) {
    sharedAudio = new Audio();
    sharedAudio.preload = 'auto';
    sharedAudio.volume = 1;
  }
  return sharedAudio;
}

function stopActiveAudio() {
  if (!sharedAudio) {
    return;
  }
  try {
    sharedAudio.pause();
    sharedAudio.currentTime = 0;
  } catch {
    // ignore
  }
}

function playHtmlAudio(url: string) {
  if (!canUseWebAlerts() || !url) {
    return;
  }
  try {
    const absolute = resolveAudioUrl(url);
    const audio = getSharedAudio();
    stopActiveAudio();
    // Меняем src только если другой файл — иначе повторный клик не качает снова.
    if (audio.src !== absolute) {
      audio.src = absolute;
    } else {
      try {
        audio.currentTime = 0;
      } catch {
        // ignore
      }
    }
    const playResult = audio.play();
    if (playResult && typeof playResult.catch === 'function') {
      void playResult.catch((error: unknown) => {
        console.warn('[chat-alerts] play failed', absolute, error);
      });
    }
  } catch (error) {
    console.warn('[chat-alerts] play error', error);
  }
}

export function setFocusedChatConversation(conversationId: string | null) {
  focusedConversationId = conversationId;
}

export function isChatConversationFocused(conversationId: string): boolean {
  if (!conversationId || focusedConversationId !== conversationId) {
    return false;
  }
  if (canUseWebAlerts()) {
    return document.visibilityState === 'visible';
  }
  return true;
}

/** Silent 1-sample wav — unlocks autoplay without hitting /sounds/*.mp3. */
const SILENT_WAV =
  'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA=';

let alertsUnlocked = false;

export function unlockChatAlerts() {
  if (!canUseWebAlerts() || alertsUnlocked) {
    return;
  }
  alertsUnlocked = true;

  try {
    // Prefer AudioContext — no media file fetch.
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (AudioCtx) {
      const ctx = new AudioCtx();
      void ctx.resume().catch(() => {
        alertsUnlocked = false;
      });
    }

    // Also warm the shared HTMLAudioElement with a data: URI (still no network).
    const audio = getSharedAudio();
    const previousSrc = audio.src;
    audio.volume = 0.001;
    audio.src = SILENT_WAV;
    void audio
      .play()
      .then(() => {
        audio.pause();
        audio.currentTime = 0;
        audio.volume = 1;
        // Drop silent src so the next real play sets notify URL once.
        if (!previousSrc || previousSrc.startsWith('data:')) {
          audio.removeAttribute('src');
          audio.load();
        } else {
          audio.src = previousSrc;
        }
      })
      .catch(() => {
        alertsUnlocked = false;
        audio.volume = 1;
      });
  } catch {
    alertsUnlocked = false;
  }
}

type PlaySoundOptions = {
  url?: string | null;
  /** Preview / явный жест — игнор mute и cooldown */
  force?: boolean;
};

export function playIncomingMessageSound(options?: PlaySoundOptions) {
  if (!canUseWebAlerts()) {
    return;
  }

  const settings = getNotificationSoundSettingsSync();
  if (!options?.force && !settings.enabled) {
    return;
  }

  const now = Date.now();
  if (!options?.force && now - lastSoundAt < SOUND_COOLDOWN_MS) {
    return;
  }
  if (!options?.force) {
    lastSoundAt = now;
  }

  const url = options?.url || getEffectiveNotificationSoundUrl();
  if (!url) {
    return;
  }
  playHtmlAudio(url);
}

export function previewNotificationSound(url: string) {
  if (!url) {
    return;
  }
  // RN-web Pressable иногда шлёт pressIn/press дважды на один клик.
  const now = Date.now();
  if (now - lastPreviewAt < PREVIEW_GUARD_MS) {
    return;
  }
  lastPreviewAt = now;
  playIncomingMessageSound({ url, force: true });
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

export function notifyIncomingChatMessage(conversationId?: string) {
  if (conversationId && isChatConversationFocused(conversationId)) {
    return;
  }
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
  actionText?: string;
  messageText?: string;
}) {
  playIncomingMessageSound();

  if (!options?.type) {
    startTitleBlink(NOTIFICATION_ALERT_TITLE);
    return;
  }

  const { title, body } = getPortalNotificationCopy({
    type: options.type,
    actor: { id: '', nickname: options.actorName ?? '', avatarUrl: null },
    actorName: options.actorName,
    subject: options.subject ?? '',
    actionText: options.actionText,
    messageText: options.messageText,
  });

  startTitleBlink(title);
  showDesktopPush(title, body);
}
