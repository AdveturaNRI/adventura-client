import {
  getCachedPlayableMusicUrl,
  warmPlayableMusicUrl,
} from '@/utils/music-playable-url';

const SILENT_WAV =
  'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA=';

export type WebBardAudioStatus = {
  playing: boolean;
  currentTime: number;
  duration: number;
  ended: boolean;
  /** True while a new src is loading / waiting for audible playback. */
  buffering: boolean;
};

type StatusListener = (status: WebBardAudioStatus) => void;

function clamp01(value: number) {
  if (!Number.isFinite(value)) {
    return 1;
  }
  return Math.min(1, Math.max(0, value));
}

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
 * Persistent HTMLAudioElement for call Bard on web.
 *
 * Important: do NOT use MediaElementSource/GainNode here. Once created, Safari
 * routes the element through WebAudio permanently — disconnecting (or feeding a
 * non-CORS URL) = silence on the next queue click. Volume uses element.volume + muted.
 */
export class WebBardAudioEngine {
  private readonly audio: HTMLAudioElement;
  private ctx: AudioContext | null = null;
  private loadGen = 0;
  private loadedKey: string | null = null;
  private volume = 1;
  private listeners = new Set<StatusListener>();
  private ended = false;
  private buffering = false;
  private disposed = false;

  constructor() {
    this.audio = new Audio();
    this.audio.preload = 'auto';
    this.audio.setAttribute('playsinline', 'true');
    this.audio.setAttribute('webkit-playsinline', 'true');

    this.audio.addEventListener('timeupdate', this.emitStatus);
    this.audio.addEventListener('play', this.onPlay);
    this.audio.addEventListener('playing', this.onPlaying);
    this.audio.addEventListener('pause', this.emitStatus);
    this.audio.addEventListener('waiting', this.onWaiting);
    this.audio.addEventListener('canplay', this.onCanPlay);
    this.audio.addEventListener('ended', this.onEnded);
    this.audio.addEventListener('loadedmetadata', this.emitStatus);
    this.audio.addEventListener('durationchange', this.emitStatus);
  }

  subscribe(listener: StatusListener): () => void {
    this.listeners.add(listener);
    listener(this.getStatus());
    return () => {
      this.listeners.delete(listener);
    };
  }

  getStatus(): WebBardAudioStatus {
    const duration = this.audio.duration;
    return {
      playing: !this.audio.paused && !this.audio.ended,
      currentTime:
        typeof this.audio.currentTime === 'number' && Number.isFinite(this.audio.currentTime)
          ? Math.max(0, this.audio.currentTime)
          : 0,
      duration:
        typeof duration === 'number' && Number.isFinite(duration) && duration > 0 ? duration : 0,
      ended: this.ended,
      buffering: this.buffering,
    };
  }

  getLoadedKey() {
    return this.loadedKey;
  }

  /**
   * User gesture: resume AudioContext + unlock THIS element.
   * Does not pause a real track (only the silent unlock clip).
   */
  unlockFromGesture() {
    if (this.disposed) {
      return;
    }
    this.ensureContext();
    void this.ctx?.resume().catch(() => undefined);

    const src = this.audio.getAttribute('src') || this.audio.src || '';
    const needsSilent = !src || src === window.location.href || src.startsWith('data:');
    if (needsSilent) {
      this.audio.src = SILENT_WAV;
      try {
        this.audio.load();
      } catch {
        // ignore
      }
    }

    void this.audio
      .play()
      .then(() => {
        if ((this.audio.src || '').startsWith('data:')) {
          this.audio.pause();
          try {
            this.audio.currentTime = 0;
          } catch {
            // ignore
          }
        }
      })
      .catch(() => undefined);
  }

  /** Only AudioContext — use right before setting a real track src in the same tap. */
  resumeContextFromGesture() {
    if (this.disposed) {
      return;
    }
    this.ensureContext();
    void this.ctx?.resume().catch(() => undefined);
  }

  setVolume(value: number) {
    this.volume = clamp01(value);
    this.applyVolume();
  }

  setLoop(enabled: boolean) {
    if (this.disposed) {
      return;
    }
    this.audio.loop = Boolean(enabled);
    if (enabled) {
      this.ended = false;
    }
    this.emitStatus();
  }

  async load(params: {
    key: string;
    playUrl: string;
    shouldPlay: boolean;
    positionSec: number;
    loop?: boolean;
  }): Promise<boolean> {
    if (this.disposed) {
      return false;
    }
    const gen = ++this.loadGen;
    this.ended = false;

    const remote = params.playUrl.trim();
    if (!remote) {
      return false;
    }

    warmPlayableMusicUrl(remote);
    const playable = getCachedPlayableMusicUrl(remote) ?? remote;

    this.ensureContext();
    void this.ctx?.resume().catch(() => undefined);
    this.audio.loop = Boolean(params.loop);

    const same =
      this.loadedKey === params.key &&
      Boolean(this.audio.src) &&
      !this.audio.src.startsWith('data:');

    if (!same) {
      this.buffering = true;
      this.emitStatus();
      this.applySourceUrl(playable);
      this.loadedKey = params.key;
    }

    this.applyVolume();

    const seekTo = Math.max(0, params.positionSec);
    try {
      if (seekTo > 0.05 && this.audio.readyState >= 1) {
        this.audio.currentTime = seekTo;
      }
    } catch {
      // ignore
    }

    if (!params.shouldPlay) {
      this.buffering = false;
      this.audio.pause();
      this.emitStatus();
      return true;
    }

    // play() must be invoked in the gesture turn — do not await canplay first.
    const ok = await this.play();
    if (ok) {
      if (this.audio.readyState >= 3) {
        this.buffering = false;
        this.emitStatus();
      }
      return true;
    }

    if (gen !== this.loadGen) {
      return false;
    }

    // Wait for media, then retry play (still may work after unlock on same element).
    await new Promise<void>((resolve) => {
      const onReady = () => {
        cleanup();
        resolve();
      };
      const cleanup = () => {
        this.audio.removeEventListener('canplay', onReady);
        this.audio.removeEventListener('loadeddata', onReady);
      };
      this.audio.addEventListener('canplay', onReady, { once: true });
      this.audio.addEventListener('loadeddata', onReady, { once: true });
      if (this.audio.readyState >= 2) {
        cleanup();
        resolve();
        return;
      }
      setTimeout(() => {
        cleanup();
        resolve();
      }, 3000);
    });

    if (gen !== this.loadGen) {
      return false;
    }
    const retried = await this.play();
    if (retried || this.audio.readyState >= 2) {
      this.buffering = false;
      this.emitStatus();
    }
    return retried;
  }

  async play(): Promise<boolean> {
    if (this.disposed) {
      return false;
    }
    this.ended = false;
    this.ensureContext();
    void this.ctx?.resume().catch(() => undefined);
    this.applyVolume();
    try {
      await this.audio.play();
      this.emitStatus();
      return !this.audio.paused;
    } catch {
      this.emitStatus();
      return false;
    }
  }

  pause() {
    if (this.disposed) {
      return;
    }
    this.buffering = false;
    try {
      this.audio.pause();
    } catch {
      // ignore
    }
    this.emitStatus();
  }

  seek(positionSec: number) {
    if (this.disposed) {
      return;
    }
    try {
      this.audio.currentTime = Math.max(0, positionSec);
    } catch {
      // ignore
    }
    this.emitStatus();
  }

  stop() {
    this.loadGen += 1;
    this.loadedKey = null;
    this.ended = false;
    this.buffering = false;
    try {
      this.audio.pause();
      this.audio.removeAttribute('src');
      this.audio.load();
    } catch {
      // ignore
    }
    this.emitStatus();
  }

  dispose() {
    if (this.disposed) {
      return;
    }
    this.disposed = true;
    this.listeners.clear();
    this.stop();
    if (this.ctx) {
      void this.ctx.close().catch(() => undefined);
      this.ctx = null;
    }
  }

  private onEnded = () => {
    if (this.audio.loop) {
      this.ended = false;
      this.emitStatus();
      return;
    }
    this.ended = true;
    this.buffering = false;
    this.emitStatus();
  };

  private onPlay = () => {
    this.emitStatus();
  };

  private onPlaying = () => {
    this.buffering = false;
    this.emitStatus();
  };

  private onWaiting = () => {
    if (!this.audio.paused) {
      this.buffering = true;
      this.emitStatus();
    }
  };

  private onCanPlay = () => {
    if (this.buffering && !this.audio.paused) {
      this.buffering = false;
      this.emitStatus();
    }
  };

  private emitStatus = () => {
    if (this.disposed) {
      return;
    }
    const status = this.getStatus();
    for (const listener of this.listeners) {
      listener(status);
    }
  };

  private ensureContext() {
    if (this.ctx && this.ctx.state !== 'closed') {
      return;
    }
    const Ctor = getAudioContextConstructor();
    if (!Ctor) {
      return;
    }
    this.ctx = new Ctor();
  }

  private applyVolume() {
    const next = this.volume;
    this.audio.volume = next;
    this.audio.muted = next < 0.001;
  }

  private applySourceUrl(url: string) {
    // Never attach crossOrigin unless blob — otherwise Safari may refuse to play.
    if (url.startsWith('blob:') || url.startsWith('data:')) {
      this.audio.crossOrigin = 'anonymous';
    } else {
      this.audio.removeAttribute('crossorigin');
    }
    this.audio.src = url;
    try {
      this.audio.load();
    } catch {
      // ignore
    }
  }
}
