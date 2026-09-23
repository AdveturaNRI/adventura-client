import { Platform } from 'react-native';

/** Silent 1-sample wav — unlocks HTMLAudioElement autoplay without a network fetch. */
const SILENT_WAV =
  'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA=';

let unlocked = false;
let unlockStarted = false;

function canUseWebMedia() {
  return Platform.OS === 'web' && typeof window !== 'undefined';
}

/**
 * Call synchronously inside a user gesture (Accept / Start call / tap).
 * Browsers block remote Bard `play()` until the document has unlocked media —
 * without this, music only starts after someone clicks the Bard tile.
 */
export function unlockWebMediaPlayback() {
  if (!canUseWebMedia() || unlocked || unlockStarted) {
    return;
  }
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

export function isWebMediaPlaybackUnlocked() {
  return unlocked;
}
