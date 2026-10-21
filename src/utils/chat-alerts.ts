import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from 'expo-audio';
import { Platform } from 'react-native';

import { API_ORIGIN } from '@/constants/api.config';
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
/** Native one-shot player for settings preview + in-app notify beeps. */
let nativePlayer: AudioPlayer | null = null;
let nativeAudioModeArmed = false;
let nativeLastSourceKey: string | null = null;
const PREVIEW_GUARD_MS = 350;

/** public/sounds — on native Metro must bundle them; relative /sounds/* is web-only. */
const BUNDLED_SOUNDS: Record<string, number> = {
  '/sounds/notify-magic.mp3': require('../../public/sounds/notify-magic.mp3'),
  '/sounds/notify-bell.mp3': require('../../public/sounds/notify-bell.mp3'),
  '/sounds/notify-dice.mp3': require('../../public/sounds/notify-dice.mp3'),
  '/sounds/notify-fun.mp3': require('../../public/sounds/notify-fun.mp3'),
  '/sounds/notify-wood.mp3': require('../../public/sounds/notify-wood.mp3'),
  '/sounds/notify.mp3': require('../../public/sounds/notify.mp3'),
  '/sounds/call-ringtone.mp3': require('../../public/sounds/call-ringtone.mp3'),
};

function canUseWebAlerts() {
  return Platform.OS === 'web' && typeof window !== 'undefined' && typeof document !== 'undefined';
}

function resolveAudioUrl(url: string): string {
  if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('blob:')) {
    return url;
  }
  if (canUseWebAlerts()) {
    return new URL(url, window.location.origin).href;
  }
  const path = url.startsWith('/') ? url : `/${url}`;
  return `${API_ORIGIN}${path}`;
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

async function armNativeAudioMode() {
  if (nativeAudioModeArmed) {
    return;
  }
  nativeAudioModeArmed = true;
  try {
    await setAudioModeAsync({
      playsInSilentMode: true,
      interruptionMode: 'mixWithOthers',
    });
  } catch {
    nativeAudioModeArmed = false;
  }
}

function getNativePlayer(): AudioPlayer {
  if (!nativePlayer) {
    nativePlayer = createAudioPlayer(null, {
      updateInterval: 500,
      keepAudioSessionActive: true,
    });
  }
  return nativePlayer;
}

function playNativeAudio(url: string) {
  if (!url || Platform.OS === 'web') {
    return;
  }
  void (async () => {
    try {
      await armNativeAudioMode();
      const player = getNativePlayer();
      const bundled = BUNDLED_SOUNDS[url] ?? BUNDLED_SOUNDS[url.split('?')[0] ?? url];
      const sourceKey = bundled != null ? `asset:${url}` : `uri:${resolveAudioUrl(url)}`;
      const source =
        bundled != null ? bundled : ({ uri: resolveAudioUrl(url) } as const);

      try {
        player.pause();
      } catch {
        // ignore
      }

      if (nativeLastSourceKey !== sourceKey) {
        player.replace(source);
        nativeLastSourceKey = sourceKey;
      } else {
        void player.seekTo(0).catch(() => {
          // ignore
        });
      }

      player.volume = 1;
      player.muted = false;
      player.play();
    } catch (error) {
      console.warn('[chat-alerts] native play error', url, error);
    }
  })();
}

function playAlertAudio(url: string) {
  if (!url) {
    return;
  }
  if (canUseWebAlerts()) {
    playHtmlAudio(url);
    return;
  }
  playNativeAudio(url);
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
  playAlertAudio(url);
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
