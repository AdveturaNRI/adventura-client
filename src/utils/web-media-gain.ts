import { Platform } from 'react-native';

export type WebMediaGainHandle = {
  setGain: (value: number) => void;
  /** Call after expo-audio `replace()` — it builds a new HTMLAudioElement. */
  rebind: (media: HTMLMediaElement) => void;
  dispose: () => void;
};

function getAudioContextConstructor(): typeof AudioContext | null {
  if (typeof window === 'undefined') {
    return null;
  }
  return (
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext ||
    null
  );
}

/**
 * Safari/iOS ignore HTMLMediaElement.volume. Route the element through a GainNode
 * so local Bard volume / mute actually changes what you hear.
 */
export function createWebMediaGain(media: HTMLMediaElement): WebMediaGainHandle | null {
  if (Platform.OS !== 'web') {
    return null;
  }
  const AudioCtx = getAudioContextConstructor();
  if (!AudioCtx) {
    return null;
  }

  let ctx = new AudioCtx();
  let source: MediaElementAudioSourceNode | null = null;
  let gain: GainNode | null = null;
  let currentMedia: HTMLMediaElement | null = null;
  let lastGain = 1;

  const disconnectGraph = () => {
    try {
      source?.disconnect();
    } catch {
      // already disconnected
    }
    try {
      gain?.disconnect();
    } catch {
      // already disconnected
    }
    source = null;
    gain = null;
  };

  const bind = (nextMedia: HTMLMediaElement) => {
    if (nextMedia === currentMedia && source && gain) {
      return;
    }
    disconnectGraph();
    currentMedia = nextMedia;
    if (ctx.state === 'closed') {
      ctx = new AudioCtx();
    }
    if (ctx.state === 'suspended') {
      void ctx.resume().catch(() => undefined);
    }
    try {
      // Once created, this element can only play through the WebAudio graph.
      source = ctx.createMediaElementSource(nextMedia);
      gain = ctx.createGain();
      gain.gain.value = lastGain;
      source.connect(gain);
      gain.connect(ctx.destination);
    } catch {
      // Element already has a MediaElementSource (or context is dead).
      source = null;
      gain = null;
      currentMedia = null;
    }
  };

  bind(media);

  return {
    setGain(value: number) {
      const next = Math.min(1, Math.max(0, Number.isFinite(value) ? value : 1));
      lastGain = next;
      if (!gain) {
        return;
      }
      if (ctx.state === 'suspended') {
        void ctx.resume().catch(() => undefined);
      }
      try {
        gain.gain.setTargetAtTime(next, ctx.currentTime, 0.02);
      } catch {
        gain.gain.value = next;
      }
    },
    rebind(nextMedia: HTMLMediaElement) {
      bind(nextMedia);
      if (gain) {
        gain.gain.value = lastGain;
      }
    },
    dispose() {
      disconnectGraph();
      currentMedia = null;
      void ctx.close().catch(() => undefined);
    },
  };
}

/** Best-effort read of expo-audio web player's HTMLAudioElement. */
export function getExpoAudioPlayerMedia(player: object): HTMLAudioElement | null {
  const media = (player as { media?: unknown }).media;
  return media instanceof HTMLAudioElement ? media : null;
}
