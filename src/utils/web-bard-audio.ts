import { resolvePlayableMusicUrl } from '@/utils/music-playable-url';

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
 * One persistent HTMLAudioElement + GainNode for call Bard on web.
 * expo-audio replace() recreates the element and kills iOS unlock — we never do that.
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

  constructor() {
    this.audio = new Audio();
    this.audio.preload = 'auto';
    this.audio.setAttribute('playsinline', 'true');
    this.audio.setAttribute('webkit-playsinline', 'true');
    // crossOrigin set per-src in setSource — anonymous on non-CORS CDN = silent fail.

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
   * Unlocks THIS element + AudioContext for later remote starts.
   */
  unlockFromGesture() {
    if (this.disposed) {
      return;
    }
    this.ensureContext();
    void this.ctx?.resume().catch(() => undefined);

    const src = this.audio.src;
    const empty = !src || src === window.location.href;
    if (empty) {
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
        if (empty || this.audio.src.startsWith('data:')) {
          this.audio.pause();
          this.audio.currentTime = 0;
        }
      })
      .catch(() => undefined);
  }

  setVolume(value: number) {
    this.volume = clamp01(value);
    this.applyVolume();
  }

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

    const playable = await resolvePlayableMusicUrl(params.playUrl);
    if (gen !== this.loadGen || this.disposed) {
      return false;
    }

    this.ensureContext();
    void this.ctx?.resume().catch(() => undefined);

    const same = this.loadedKey === params.key && this.audio.src && !this.audio.src.startsWith('data:');
    if (!same) {
      await this.setSource(playable, gen);
      if (gen !== this.loadGen || this.disposed) {
        return false;
      }
      this.loadedKey = params.key;
      this.ensureGainGraph();
    }

    this.applyVolume();

    const seekTo = Math.max(0, params.positionSec);
    try {
      if (Math.abs(this.audio.currentTime - seekTo) > 0.35) {
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

    return this.play();
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

  private setSource(url: string, gen: number): Promise<void> {
    return new Promise((resolve, reject) => {
      if (gen !== this.loadGen || this.disposed) {
        resolve();
        return;
      }

      const onReady = () => {
        cleanup();
        resolve();
      };
      const onError = () => {
        cleanup();
        reject(new Error('audio load failed'));
      };
      const cleanup = () => {
        this.audio.removeEventListener('canplay', onReady);
        this.audio.removeEventListener('loadeddata', onReady);
        this.audio.removeEventListener('error', onError);
      };

      this.audio.addEventListener('canplay', onReady, { once: true });
      this.audio.addEventListener('loadeddata', onReady, { once: true });
      this.audio.addEventListener('error', onError, { once: true });

      if (url.startsWith('blob:') || url.startsWith('data:')) {
        this.audio.crossOrigin = 'anonymous';
      } else {
        this.audio.removeAttribute('crossorigin');
      }

      this.audio.src = url;
      try {
        this.audio.load();
      } catch {
        cleanup();
        reject(new Error('audio load failed'));
        return;
      }

      // Already buffered (blob cache hit).
      if (this.audio.readyState >= 2) {
        cleanup();
        resolve();
      }
    });
  }
}
