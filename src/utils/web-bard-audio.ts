import {
  getCachedPlayableMusicUrl,
  resolvePlayableMusicUrl,
  warmPlayableMusicUrl,
} from '@/utils/music-playable-url';

const SILENT_WAV =
  'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA=';

export type WebBardAudioStatus = {
  playing: boolean;
  currentTime: number;
  duration: number;
  ended: boolean;
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
 * One persistent HTMLAudioElement for call Bard on web.
 * Play starts from the signed URL immediately (no full-file download first).
 * Blob/GainNode warm runs in the background for Safari volume.
 */
export class WebBardAudioEngine {
  private readonly audio: HTMLAudioElement;
  private ctx: AudioContext | null = null;
  private source: MediaElementAudioSourceNode | null = null;
  private gain: GainNode | null = null;
  private loadGen = 0;
  private loadedKey: string | null = null;
  private volume = 1;
  private listeners = new Set<StatusListener>();
  private ended = false;
  private disposed = false;
  /** True after a successful play() inside a user gesture (or unlock). */
  private unlocked = false;

  constructor() {
    this.audio = new Audio();
    this.audio.preload = 'auto';
    this.audio.setAttribute('playsinline', 'true');
    this.audio.setAttribute('webkit-playsinline', 'true');

    this.audio.addEventListener('timeupdate', this.emitStatus);
    this.audio.addEventListener('play', this.emitStatus);
    this.audio.addEventListener('playing', this.emitStatus);
    this.audio.addEventListener('pause', this.emitStatus);
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
    };
  }

  getLoadedKey() {
    return this.loadedKey;
  }

  /**
   * Must run inside a user gesture (Accept / Play / enqueue tap).
   * Never pause real track audio — only the silent unlock clip.
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
        this.unlocked = true;
        // Pause ONLY if we are still on the silent unlock clip.
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

  setVolume(value: number) {
    this.volume = clamp01(value);
    this.applyVolume();
  }

  /**
   * Load + play ASAP. Uses cached blob if ready, otherwise the remote URL
   * (progressive) so the first tap is not blocked by a full download.
   */
  async load(params: {
    key: string;
    playUrl: string;
    shouldPlay: boolean;
    positionSec: number;
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

    // Kick blob warm in background (Safari volume via GainNode later).
    warmPlayableMusicUrl(remote);

    const playable = getCachedPlayableMusicUrl(remote) ?? remote;

    this.ensureContext();
    void this.ctx?.resume().catch(() => undefined);

    const same =
      this.loadedKey === params.key &&
      Boolean(this.audio.src) &&
      !this.audio.src.startsWith('data:');

    if (!same) {
      // Set src immediately — do NOT wait for full buffer before play().
      // iOS requires play() to start in the user-gesture turn; waiting for
      // canplay after network kills that unlock.
      this.applySourceUrl(playable);
      this.loadedKey = params.key;
      this.ensureGainGraph();
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
      this.audio.pause();
      this.emitStatus();
      return true;
    }

    // Start play NOW (gesture still valid if caller didn't await network).
    const ok = await this.play();
    if (!ok && gen === this.loadGen) {
      // Media not ready yet — retry when it can play.
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
        }, 2000);
      });
      if (gen === this.loadGen) {
        return this.play();
      }
    }
    return ok;
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
      this.unlocked = true;
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
    try {
      this.source?.disconnect();
    } catch {
      // ignore
    }
    try {
      this.gain?.disconnect();
    } catch {
      // ignore
    }
    this.source = null;
    this.gain = null;
    if (this.ctx) {
      void this.ctx.close().catch(() => undefined);
      this.ctx = null;
    }
  }

  private onEnded = () => {
    this.ended = true;
    this.emitStatus();
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
    this.source = null;
    this.gain = null;
  }

  private ensureGainGraph() {
    if (!this.ctx || this.source) {
      return;
    }
    const src = this.audio.src || '';
    const safe =
      src.startsWith('blob:') ||
      src.startsWith('data:') ||
      (typeof window !== 'undefined' && src.startsWith(window.location.origin));
    if (!safe) {
      return;
    }
    try {
      this.source = this.ctx.createMediaElementSource(this.audio);
      this.gain = this.ctx.createGain();
      this.gain.gain.value = this.volume < 0.001 ? 0 : this.volume;
      this.source.connect(this.gain);
      this.gain.connect(this.ctx.destination);
    } catch {
      this.source = null;
      this.gain = null;
    }
  }

  private applyVolume() {
    const next = this.volume;
    if (this.gain) {
      this.audio.muted = next < 0.001;
      this.audio.volume = 1;
      try {
        if (this.ctx) {
          this.gain.gain.setTargetAtTime(next < 0.001 ? 0 : next, this.ctx.currentTime, 0.02);
        } else {
          this.gain.gain.value = next < 0.001 ? 0 : next;
        }
      } catch {
        this.gain.gain.value = next < 0.001 ? 0 : next;
      }
      return;
    }
    this.audio.volume = next;
    this.audio.muted = next < 0.001;
  }

  private applySourceUrl(url: string) {
    if (url.startsWith('blob:') || url.startsWith('data:')) {
      this.audio.crossOrigin = 'anonymous';
    } else {
      this.audio.removeAttribute('crossorigin');
    }

    if (this.source) {
      try {
        this.source.disconnect();
      } catch {
        // ignore
      }
      try {
        this.gain?.disconnect();
      } catch {
        // ignore
      }
      this.source = null;
      this.gain = null;
    }

    this.audio.src = url;
    try {
      this.audio.load();
    } catch {
      // ignore
    }
  }

  private setSource(url: string, gen: number): Promise<void> {
    return new Promise((resolve, reject) => {
      if (gen !== this.loadGen || this.disposed) {
        resolve();
        return;
      }

      let settled = false;
      const finish = (ok: boolean) => {
        if (settled) {
          return;
        }
        settled = true;
        cleanup();
        if (ok) {
          resolve();
        } else {
          reject(new Error('audio load failed'));
        }
      };

      const onReady = () => finish(true);
      const onError = () => finish(false);
      const cleanup = () => {
        this.audio.removeEventListener('canplay', onReady);
        this.audio.removeEventListener('loadeddata', onReady);
        this.audio.removeEventListener('canplaythrough', onReady);
        this.audio.removeEventListener('error', onError);
      };

      this.audio.addEventListener('canplay', onReady);
      this.audio.addEventListener('loadeddata', onReady);
      this.audio.addEventListener('canplaythrough', onReady);
      this.audio.addEventListener('error', onError);

      this.applySourceUrl(url);

      if (this.audio.readyState >= 2) {
        finish(true);
        return;
      }

      setTimeout(() => {
        if (!settled && gen === this.loadGen && this.audio.readyState >= 1) {
          finish(true);
        } else if (!settled) {
          finish(this.audio.readyState >= 1);
        }
      }, 2500);
    });
  }
}
