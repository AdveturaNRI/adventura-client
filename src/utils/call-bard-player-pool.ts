import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from 'expo-audio';
import { Platform } from 'react-native';

import {
  WebBardAudioEngine,
  type WebBardAudioStatus,
} from '@/utils/web-bard-audio';

export type BardLayerStatus = {
  playing: boolean;
  currentTime: number;
  duration: number;
  ended: boolean;
  buffering: boolean;
};

type StatusListener = (entryId: string, status: BardLayerStatus) => void;

const isWeb = Platform.OS === 'web';

/**
 * Cap concurrent Bard layers. On web we also warm this many unlocked idle
 * HTMLAudioElements on each user gesture so every layer can start without another tap.
 */
export const MAX_CALL_MUSIC_LAYERS = 8;

const EMPTY: BardLayerStatus = {
  playing: false,
  currentTime: 0,
  duration: 0,
  ended: false,
  buffering: false,
};

let nativeAudioModeArmed = false;

async function armNativeAudioMode() {
  if (isWeb || nativeAudioModeArmed) {
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

function waitNativeLoaded(player: AudioPlayer, timeoutMs = 10_000): Promise<boolean> {
  if (player.isLoaded) {
    return Promise.resolve(true);
  }
  return new Promise((resolve) => {
    let settled = false;
    const finish = (ok: boolean) => {
      if (settled) {
        return;
      }
      settled = true;
      clearTimeout(timer);
      try {
        sub.remove();
      } catch {
        // ignore
      }
      resolve(ok);
    };
    const sub = player.addListener('playbackStatusUpdate', (status) => {
      if (status.isLoaded) {
        finish(true);
      }
    });
    const timer = setTimeout(() => finish(player.isLoaded), timeoutMs);
    // Replace can finish before the listener attaches.
    if (player.isLoaded) {
      finish(true);
    }
  });
}

function fromWeb(status: WebBardAudioStatus): BardLayerStatus {
  return {
    playing: status.playing,
    currentTime: status.currentTime,
    duration: status.duration,
    ended: status.ended,
    buffering: status.buffering,
  };
}

function fromNative(player: AudioPlayer): BardLayerStatus {
  return {
    playing: Boolean(player.playing),
    currentTime:
      typeof player.currentTime === 'number' && Number.isFinite(player.currentTime)
        ? Math.max(0, player.currentTime)
        : 0,
    duration:
      typeof player.duration === 'number' && Number.isFinite(player.duration) && player.duration > 0
        ? player.duration
        : 0,
    ended: Boolean(player.currentTime > 0 && player.duration > 0 && !player.playing && player.currentTime >= player.duration - 0.35),
    buffering: Boolean(player.isBuffering),
  };
}

/**
 * Concurrent Bard layers — one engine/player per active entryId.
 * Web keeps Safari-safe WebBardAudioEngine (no MediaElementSource).
 */
export class CallBardPlayerPool {
  private readonly web = new Map<string, WebBardAudioEngine>();
  /** Pre-unlocked HTMLAudioElements — Safari/iOS blocks play() on fresh elements without a gesture. */
  private readonly webSpare: WebBardAudioEngine[] = [];
  private readonly native = new Map<string, AudioPlayer>();
  private readonly unsubs = new Map<string, () => void>();
  private readonly listeners = new Set<StatusListener>();
  private readonly layerGain = new Map<string, number>();
  private readonly layerLoop = new Map<string, boolean>();
  /** Master gain (local × global × deafen). */
  private masterVolume = 1;
  private disposed = false;
  private pollTimer: ReturnType<typeof setInterval> | null = null;

  subscribe(listener: StatusListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private emit(entryId: string, status: BardLayerStatus) {
    for (const listener of this.listeners) {
      listener(entryId, status);
    }
  }

  private clamp01(value: number) {
    if (!Number.isFinite(value)) {
      return 1;
    }
    return Math.min(1, Math.max(0, value));
  }

  private effectiveVolume(entryId: string) {
    return this.clamp01(this.masterVolume) * this.clamp01(this.layerGain.get(entryId) ?? 1);
  }

  private applyLayerVolume(entryId: string) {
    const next = this.effectiveVolume(entryId);
    if (isWeb) {
      this.web.get(entryId)?.setVolume(next);
      return;
    }
    const player = this.native.get(entryId);
    if (!player) {
      return;
    }
    try {
      player.volume = next;
      player.muted = next < 0.001;
    } catch {
      // ignore
    }
  }

  private applyAllVolumes() {
    for (const entryId of this.web.keys()) {
      if (entryId === '__unlock__') {
        continue;
      }
      this.applyLayerVolume(entryId);
    }
    for (const entryId of this.native.keys()) {
      this.applyLayerVolume(entryId);
    }
  }

  private ensureNativePoll() {
    if (isWeb || this.pollTimer) {
      return;
    }
    this.pollTimer = setInterval(() => {
      if (this.disposed || this.native.size === 0) {
        return;
      }
      for (const [entryId, player] of this.native) {
        this.emit(entryId, fromNative(player));
      }
    }, 250);
  }

  private clearNativePollIfEmpty() {
    if (this.native.size > 0 || !this.pollTimer) {
      return;
    }
    clearInterval(this.pollTimer);
    this.pollTimer = null;
  }

  private takeWebEngine(): WebBardAudioEngine {
    return this.webSpare.pop() ?? new WebBardAudioEngine();
  }

  private releaseWebEngine(engine: WebBardAudioEngine) {
    try {
      engine.stop();
    } catch {
      // ignore
    }
    if (this.disposed || this.webSpare.length >= MAX_CALL_MUSIC_LAYERS) {
      engine.dispose();
      return;
    }
    this.webSpare.push(engine);
  }

  private topUpWebSpares() {
    while (this.webSpare.length < MAX_CALL_MUSIC_LAYERS) {
      const engine = new WebBardAudioEngine();
      engine.unlockFromGesture();
      this.webSpare.push(engine);
    }
  }

  private getOrCreateWeb(entryId: string): WebBardAudioEngine {
    let engine = this.web.get(entryId);
    if (engine) {
      return engine;
    }
    engine = this.takeWebEngine();
    engine.setVolume(this.effectiveVolume(entryId));
    const unsub = engine.subscribe((status) => {
      this.emit(entryId, fromWeb(status));
    });
    this.web.set(entryId, engine);
    this.unsubs.set(entryId, unsub);
    return engine;
  }

  private getOrCreateNative(entryId: string): AudioPlayer {
    let player = this.native.get(entryId);
    if (player) {
      return player;
    }
    player = createAudioPlayer(null, {
      updateInterval: 250,
      // Keep session up when one layer pauses so siblings keep mixing on iOS.
      keepAudioSessionActive: true,
    });
    const next = this.effectiveVolume(entryId);
    try {
      player.volume = next;
      player.muted = next < 0.001;
    } catch {
      // ignore
    }
    this.native.set(entryId, player);
    this.ensureNativePoll();
    return player;
  }

  /** Master gain shared by all layers (local × global × deafen). */
  setVolume(value: number) {
    this.masterVolume = this.clamp01(value);
    this.applyAllVolumes();
  }

  /** Per-track gain 0…1 (synced for everyone in the call). */
  setLayerGain(entryId: string, gain: number) {
    this.layerGain.set(entryId, this.clamp01(gain));
    this.applyLayerVolume(entryId);
  }

  setLayerLoop(entryId: string, loop: boolean) {
    this.layerLoop.set(entryId, Boolean(loop));
    this.applyLayerLoop(entryId);
  }

  private applyLayerLoop(entryId: string) {
    const loop = Boolean(this.layerLoop.get(entryId));
    if (isWeb) {
      this.web.get(entryId)?.setLoop(loop);
      return;
    }
    const player = this.native.get(entryId);
    if (!player) {
      return;
    }
    try {
      player.loop = loop;
    } catch {
      // ignore
    }
  }

  syncLayerGains(gains: Record<string, number>) {
    const keep = new Set(Object.keys(gains));
    for (const entryId of [...this.layerGain.keys()]) {
      if (!keep.has(entryId)) {
        this.layerGain.delete(entryId);
      }
    }
    for (const [entryId, gain] of Object.entries(gains)) {
      this.layerGain.set(entryId, this.clamp01(gain));
    }
    this.applyAllVolumes();
  }

  syncLayerLoops(loops: Record<string, boolean>) {
    const keep = new Set(Object.keys(loops));
    for (const entryId of [...this.layerLoop.keys()]) {
      if (!keep.has(entryId)) {
        this.layerLoop.delete(entryId);
      }
    }
    for (const [entryId, loop] of Object.entries(loops)) {
      this.layerLoop.set(entryId, Boolean(loop));
      this.applyLayerLoop(entryId);
    }
  }

  unlockFromGesture() {
    if (!isWeb) {
      void armNativeAudioMode();
      return;
    }
    for (const engine of this.web.values()) {
      engine.unlockFromGesture();
    }
    for (const engine of this.webSpare) {
      engine.unlockFromGesture();
    }
    // Warm idle elements now — next layer can play() after an await / remote wire.
    this.topUpWebSpares();
  }

  resumeContextFromGesture() {
    if (!isWeb) {
      void armNativeAudioMode();
      return;
    }
    for (const engine of this.web.values()) {
      engine.resumeContextFromGesture();
    }
    for (const engine of this.webSpare) {
      engine.resumeContextFromGesture();
    }
  }

  async load(params: {
    entryId: string;
    trackId: string;
    playUrl: string;
    shouldPlay: boolean;
    positionSec: number;
    loop?: boolean;
  }): Promise<boolean> {
    if (this.disposed || !params.playUrl.trim()) {
      return false;
    }
    if (typeof params.loop === 'boolean') {
      this.layerLoop.set(params.entryId, params.loop);
    }
    const key = `${params.trackId}::${params.playUrl}`;
    if (isWeb) {
      if (params.entryId === '__unlock__') {
        return false;
      }
      if (!this.web.has(params.entryId) && this.listEntryIds().length >= MAX_CALL_MUSIC_LAYERS) {
        return false;
      }
      const engine = this.getOrCreateWeb(params.entryId);
      const ok = await engine.load({
        key,
        playUrl: params.playUrl,
        shouldPlay: params.shouldPlay,
        positionSec: params.positionSec,
        loop: Boolean(this.layerLoop.get(params.entryId)),
      });
      this.applyLayerVolume(params.entryId);
      this.applyLayerLoop(params.entryId);
      return ok;
    }

    await armNativeAudioMode();
    if (!this.native.has(params.entryId) && this.listEntryIds().length >= MAX_CALL_MUSIC_LAYERS) {
      return false;
    }
    const player = this.getOrCreateNative(params.entryId);
    try {
      player.pause();
    } catch {
      // ignore
    }
    try {
      player.replace(params.playUrl);
    } catch {
      return false;
    }
    // iOS often rejects play() until the item is loaded — 40ms sleep is not enough
    // for a second concurrent layer, so wait for isLoaded then play.
    await waitNativeLoaded(player);
    try {
      await player.seekTo(Math.max(0, params.positionSec));
    } catch {
      // ignore
    }
    try {
      const next = this.effectiveVolume(params.entryId);
      player.volume = next;
      player.muted = next < 0.001;
      player.loop = Boolean(this.layerLoop.get(params.entryId));
    } catch {
      // ignore
    }
    if (params.shouldPlay) {
      try {
        player.play();
      } catch {
        return false;
      }
      // Second pass after a short settle — covers late AVPlayer ready on iPhone.
      if (!player.playing) {
        await new Promise((resolve) => setTimeout(resolve, 120));
        try {
          player.play();
        } catch {
          // ignore
        }
      }
    } else {
      try {
        player.pause();
      } catch {
        // ignore
      }
    }
    this.emit(params.entryId, fromNative(player));
    return true;
  }

  async play(entryId: string): Promise<boolean> {
    if (isWeb) {
      const engine = this.web.get(entryId);
      if (!engine) {
        return false;
      }
      return engine.play();
    }
    const player = this.native.get(entryId);
    if (!player) {
      return false;
    }
    try {
      player.play();
      this.emit(entryId, fromNative(player));
      return true;
    } catch {
      return false;
    }
  }

  pause(entryId: string) {
    if (isWeb) {
      this.web.get(entryId)?.pause();
      return;
    }
    const player = this.native.get(entryId);
    if (!player) {
      return;
    }
    try {
      player.pause();
    } catch {
      // ignore
    }
    this.emit(entryId, fromNative(player));
  }

  pauseAll() {
    for (const entryId of [...this.web.keys(), ...this.native.keys()]) {
      if (entryId === '__unlock__') {
        continue;
      }
      this.pause(entryId);
    }
  }

  async playAll(): Promise<void> {
    const ids = [
      ...new Set([...this.web.keys(), ...this.native.keys()].filter((id) => id !== '__unlock__')),
    ];
    await Promise.all(ids.map((id) => this.play(id)));
  }

  seek(entryId: string, positionSec: number) {
    if (isWeb) {
      this.web.get(entryId)?.seek(positionSec);
      return;
    }
    const player = this.native.get(entryId);
    if (!player) {
      return;
    }
    void player.seekTo(Math.max(0, positionSec)).catch(() => undefined);
  }

  getStatus(entryId: string): BardLayerStatus {
    if (isWeb) {
      const engine = this.web.get(entryId);
      return engine ? fromWeb(engine.getStatus()) : EMPTY;
    }
    const player = this.native.get(entryId);
    return player ? fromNative(player) : EMPTY;
  }

  listEntryIds(): string[] {
    const ids = new Set<string>([...this.web.keys(), ...this.native.keys()]);
    ids.delete('__unlock__');
    return [...ids];
  }

  stopLayer(entryId: string) {
    this.layerGain.delete(entryId);
    this.layerLoop.delete(entryId);
    if (isWeb) {
      const unsub = this.unsubs.get(entryId);
      unsub?.();
      this.unsubs.delete(entryId);
      const engine = this.web.get(entryId);
      if (engine) {
        this.web.delete(entryId);
        // Return to spare so the unlock survives for the next track.
        this.releaseWebEngine(engine);
      }
      this.emit(entryId, EMPTY);
      return;
    }
    const player = this.native.get(entryId);
    if (player) {
      try {
        player.pause();
        player.remove();
      } catch {
        // ignore
      }
      this.native.delete(entryId);
      this.clearNativePollIfEmpty();
    }
    this.emit(entryId, EMPTY);
  }

  stopAll() {
    for (const entryId of [...this.web.keys()]) {
      this.stopLayer(entryId);
    }
    for (const entryId of [...this.native.keys()]) {
      this.stopLayer(entryId);
    }
  }

  dispose() {
    if (this.disposed) {
      return;
    }
    this.disposed = true;
    this.listeners.clear();
    this.stopAll();
    for (const engine of this.webSpare.splice(0)) {
      engine.dispose();
    }
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
  }
}
