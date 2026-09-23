import { Platform } from 'react-native';

/** Silent 1-sample wav — unlocks HTMLAudioElement autoplay without a network fetch. */
const SILENT_WAV =
  'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA=';

let unlocked = false;
let unlockStarted = false;
/** Last user-gesture timestamp — remote Bard play() may run shortly after Accept. */
let lastGestureAt = 0;

function canUseWebMedia() {
  return Platform.OS === 'web' && typeof window !== 'undefined';
}

export function markWebMediaGesture() {
  lastGestureAt = Date.now();
}

export function wasRecentWebMediaGesture(withinMs = 8_000) {
  return lastGestureAt > 0 && Date.now() - lastGestureAt < withinMs;
}

/**
 * Call synchronously inside a user gesture (Accept / Start call / tap).
 * Browsers block remote Bard `play()` until the document has unlocked media —
 * without this, music only starts after someone clicks the Bard tile.
 */
export function unlockWebMediaPlayback() {
  if (!canUseWebMedia()) {
    return;
  }
  markWebMediaGesture();

  if (!unlocked && !unlockStarted) {
    unlockStarted = true;

    try {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        const ctx = new AudioCtx();
        void ctx
          .resume()
          .then(() => {
            unlocked = true;
          })
          .catch(() => {
            unlockStarted = false;
          });
      }
    } catch {
      // ignore
    }

    try {
      const audio = new Audio(SILENT_WAV);
      audio.volume = 0.001;
      void audio
        .play()
        .then(() => {
          unlocked = true;
          audio.pause();
          audio.removeAttribute('src');
          audio.load();
        })
        .catch(() => {
          unlockStarted = false;
        });
    } catch {
      unlockStarted = false;
    }
  }
}

/**
 * Warm THIS media element inside a user gesture. expo-audio `replace()` creates a
 * new element and drops prior unlock — keep one element and call this on Accept
 * plus any later tap so remote Bard can start without clicking the tile.
 */
export function unlockHtmlAudioElement(media: HTMLAudioElement | null | undefined) {
  if (!canUseWebMedia() || !media) {
    return;
  }
  markWebMediaGesture();
  try {
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (AudioCtx) {
      const ctx = new AudioCtx();
      void ctx.resume().catch(() => undefined);
    }
  } catch {
    // ignore
  }

  const hadSrc = Boolean(media.getAttribute('src') || media.src);
  const resume = () => {
    void media
      .play()
      .then(() => {
        unlocked = true;
        if (!hadSrc || media.src.startsWith('data:')) {
          media.pause();
        }
      })
      .catch(() => undefined);
  };

  if (!hadSrc || media.src === '' || media.src === window.location.href) {
    try {
      media.src = SILENT_WAV;
      media.load();
    } catch {
      // ignore
    }
  }
  resume();
}

export function isWebMediaPlaybackUnlocked() {
  return unlocked;
}

export const WEB_MEDIA_SILENT_WAV = SILENT_WAV;
