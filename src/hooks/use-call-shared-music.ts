import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';

import type { ChatLiveVoiceStatus, RoomDataHandler } from '@/hooks/use-chat-live-voice';
import { getMusicTrack } from '@/services/music/musicApi';
import { clearPlayableMusicUrlCache } from '@/utils/music-playable-url';
import { unlockWebMediaPlayback } from '@/utils/unlock-web-media';
import {
  WebBardAudioEngine,
  type WebBardAudioStatus,
} from '@/utils/web-bard-audio';

export const CALL_MUSIC_TOPIC = 'adventura.music';

export type CallMusicQueueEntry = {
  entryId: string;
  trackId: string;
  title: string;
  addedBy: string;
  playUrl: string;
  durationSec: number | null;
};

export type CallMusicSnapshot = {
  bardPresent: boolean;
  queue: CallMusicQueueEntry[];
  /** Bumped only on enqueue/remove so seek/volume cannot wipe the shared queue. */
  queueAt: number;
  currentEntryId: string | null;
  trackId: string | null;
  trackTitle: string | null;
  playUrl: string | null;
  playing: boolean;
  positionSec: number;
  globalVolume: number;
  /** Playback clock — bump only when play/pause/seek/track/volume/bard presence change. */
  at: number;
};

/** Fields that advance the playback clock (`at`). Queue-only edits must not touch it. */
function patchTouchesPlayback(patch: Partial<CallMusicSnapshot>): boolean {
  return (
    patch.playing !== undefined ||
    patch.positionSec !== undefined ||
    patch.trackId !== undefined ||
    patch.playUrl !== undefined ||
    patch.currentEntryId !== undefined ||
    patch.globalVolume !== undefined ||
    patch.bardPresent !== undefined ||
    patch.trackTitle !== undefined
  );
}

type MusicWirePayload =
  | {
      type: 'music_state';
      bardPresent: boolean;
      queue: CallMusicQueueEntry[];
      queueAt?: number;
      currentEntryId: string | null;
      trackId: string | null;
      trackTitle?: string | null;
      playUrl?: string | null;
      playing: boolean;
      positionSec: number;
      globalVolume: number;
      at: number;
    }
  | { type: 'music_request'; at: number };

const EMPTY_SNAPSHOT: CallMusicSnapshot = {
  bardPresent: false,
  queue: [],
  queueAt: 0,
  currentEntryId: null,
  trackId: null,
  trackTitle: null,
  playUrl: null,
  playing: false,
  positionSec: 0,
  globalVolume: 1,
  at: 0,
};

const EMPTY_WEB_STATUS: WebBardAudioStatus = {
  playing: false,
  currentTime: 0,
  duration: 0,
  ended: false,
};

function clamp01(value: number) {
  if (!Number.isFinite(value)) {
    return 1;
  }
  return Math.min(1, Math.max(0, value));
}

function newEntryId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `q-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function parseQueueEntry(raw: unknown): CallMusicQueueEntry | null {
  if (!raw || typeof raw !== 'object') {
    return null;
  }
  const obj = raw as Record<string, unknown>;
  const entryId =
    typeof obj.entryId === 'string' && obj.entryId.trim() ? obj.entryId.trim() : null;
  const trackId =
    typeof obj.trackId === 'string' && obj.trackId.trim() ? obj.trackId.trim() : null;
  const playUrl =
    typeof obj.playUrl === 'string' && obj.playUrl.trim() ? obj.playUrl.trim() : null;
  if (!entryId || !trackId || !playUrl) {
    return null;
  }
  const title =
    typeof obj.title === 'string' && obj.title.trim() ? obj.title.trim() : 'Трек';
  const addedBy =
    typeof obj.addedBy === 'string' && obj.addedBy.trim() ? obj.addedBy.trim() : 'Участник';
  const durationSec =
    typeof obj.durationSec === 'number' && Number.isFinite(obj.durationSec) && obj.durationSec > 0
      ? obj.durationSec
      : null;
  return { entryId, trackId, title, addedBy, playUrl, durationSec };
}

function parseWire(raw: unknown): MusicWirePayload | null {
  if (!raw || typeof raw !== 'object') {
    return null;
  }
  const obj = raw as Record<string, unknown>;
  if (obj.type === 'music_request') {
    return {
      type: 'music_request',
      at: typeof obj.at === 'number' ? obj.at : Date.now(),
    };
  }
  if (obj.type !== 'music_state') {
    return null;
  }
  const queueRaw = Array.isArray(obj.queue) ? obj.queue : [];
  const queue = queueRaw
    .map(parseQueueEntry)
    .filter((entry): entry is CallMusicQueueEntry => Boolean(entry));
  const trackId =
    typeof obj.trackId === 'string' && obj.trackId.trim() ? obj.trackId.trim() : null;
  const playUrl =
    typeof obj.playUrl === 'string' && obj.playUrl.trim() ? obj.playUrl.trim() : null;
  const currentEntryId =
    typeof obj.currentEntryId === 'string' && obj.currentEntryId.trim()
      ? obj.currentEntryId.trim()
      : null;
  return {
    type: 'music_state',
    bardPresent: Boolean(obj.bardPresent),
    queue,
    queueAt:
      typeof obj.queueAt === 'number' && Number.isFinite(obj.queueAt)
        ? Math.max(0, obj.queueAt)
        : typeof obj.at === 'number' && Number.isFinite(obj.at)
          ? obj.at
          : 0,
    currentEntryId,
    trackId,
    trackTitle:
      typeof obj.trackTitle === 'string' && obj.trackTitle.trim()
        ? obj.trackTitle.trim()
        : null,
    playUrl,
    playing: Boolean(obj.playing),
    positionSec:
      typeof obj.positionSec === 'number' && Number.isFinite(obj.positionSec)
        ? Math.max(0, obj.positionSec)
        : 0,
    globalVolume: clamp01(typeof obj.globalVolume === 'number' ? obj.globalVolume : 1),
    at: typeof obj.at === 'number' && Number.isFinite(obj.at) ? obj.at : Date.now(),
  };
}

export type UseCallSharedMusicOptions = {
  enabled: boolean;
  liveStatus: ChatLiveVoiceStatus;
  canControl: boolean;
  /** Display name for queue "added by". */
  localDisplayName: string;
  deafened: boolean;
  publishRoomData: (topic: string, payload: object) => Promise<void>;
  subscribeRoomData: (topic: string, handler: RoomDataHandler) => () => void;
};

export type UseCallSharedMusicResult = {
  snapshot: CallMusicSnapshot;
  /** Shared playback intent — drives play/pause icon for everyone. */
  isPlaying: boolean;
  livePositionSec: number;
  durationSec: number;
  localVolume: number;
  effectiveVolume: number;
  localDisplayName: string;
  summonBard: () => Promise<void>;
  dismissBard: () => Promise<void>;
  enqueueTrack: (
    trackId: string,
    trackTitle?: string | null,
    durationSec?: number | null,
  ) => Promise<void>;
  removeQueueEntry: (entryId: string) => Promise<void>;
  playQueueEntry: (entryId: string) => Promise<void>;
  togglePlay: () => Promise<void>;
  seek: (positionSec: number) => Promise<void>;
  stopTrack: () => Promise<void>;
  setLocalVolume: (volume: number) => void;
  setGlobalVolume: (volume: number) => Promise<void>;
  requestSync: () => void;
  republishState: () => void;
  /** Call from Accept / Start / Play tap (user gesture). */
  resumeFromGesture: () => void;
  reset: () => void;
};

const isWeb = Platform.OS === 'web';

export function useCallSharedMusic({
  enabled,
  liveStatus,
  canControl,
  localDisplayName,
  deafened,
  publishRoomData,
  subscribeRoomData,
}: UseCallSharedMusicOptions): UseCallSharedMusicResult {
  const [snapshot, setSnapshot] = useState<CallMusicSnapshot>(EMPTY_SNAPSHOT);
  const [localVolume, setLocalVolumeState] = useState(1);
  const [webStatus, setWebStatus] = useState<WebBardAudioStatus>(EMPTY_WEB_STATUS);

  const snapshotRef = useRef(snapshot);
  snapshotRef.current = snapshot;
  const localVolumeRef = useRef(localVolume);
  localVolumeRef.current = localVolume;
  const canControlRef = useRef(canControl);
  canControlRef.current = canControl;
  const localDisplayNameRef = useRef(localDisplayName);
  localDisplayNameRef.current = localDisplayName;
  const deafenedRef = useRef(deafened);
  deafenedRef.current = deafened;
  const loadGenRef = useRef(0);
  const applyingRemoteRef = useRef(false);
  const loadedKeyRef = useRef<string | null>(null);
  const toggleInFlightRef = useRef(false);
  const webEngineRef = useRef<WebBardAudioEngine | null>(null);

  // Native only — hooks must stay unconditional.
  const nativePlayer = useAudioPlayer(null, { updateInterval: 250 });
  const nativeStatus = useAudioPlayerStatus(nativePlayer);

  useEffect(() => {
    if (!isWeb) {
      return;
    }
    const engine = new WebBardAudioEngine();
    webEngineRef.current = engine;
    const unsub = engine.subscribe(setWebStatus);
    return () => {
      unsub();
      engine.dispose();
      webEngineRef.current = null;
      clearPlayableMusicUrlCache();
    };
  }, []);

  const effectiveVolume =
    clamp01(localVolume) * clamp01(snapshot.globalVolume) * (deafened ? 0 : 1);

  const applyVolume = useCallback(() => {
    const next =
      clamp01(localVolumeRef.current) *
      clamp01(snapshotRef.current.globalVolume) *
      (deafenedRef.current ? 0 : 1);
    if (isWeb) {
      webEngineRef.current?.setVolume(next);
      return;
    }
    try {
      nativePlayer.volume = next;
      nativePlayer.muted = next < 0.001;
    } catch {
      // ignore
    }
  }, [nativePlayer]);

  useEffect(() => {
    applyVolume();
  }, [applyVolume, effectiveVolume]);

  const resumeFromGesture = useCallback(() => {
    unlockWebMediaPlayback();
    if (isWeb) {
      webEngineRef.current?.unlockFromGesture();
      if (snapshotRef.current.playing && !deafenedRef.current) {
        void webEngineRef.current?.play();
      }
      return;
    }
    if (snapshotRef.current.playing && !deafenedRef.current) {
      try {
        nativePlayer.play();
      } catch {
        // ignore
      }
    }
  }, [nativePlayer]);

  const stopLocalPlayback = useCallback(() => {
    loadGenRef.current += 1;
    loadedKeyRef.current = null;
    if (isWeb) {
      webEngineRef.current?.stop();
      return;
    }
    try {
      nativePlayer.pause();
    } catch {
      // ignore
    }
  }, [nativePlayer]);

  const loadFromPlayUrl = useCallback(
    async (
      trackId: string,
      playUrl: string,
      shouldPlay: boolean,
      positionSec: number,
      at: number,
    ) => {
      const gen = ++loadGenRef.current;
      const loadKey = `${trackId}::${playUrl}`;
      if (!playUrl) {
        return;
      }

      const lagSec = Math.max(0, (Date.now() - at) / 1000);
      const seekTo = Math.max(0, positionSec + (shouldPlay ? lagSec : 0));
      const play = shouldPlay && !deafenedRef.current;

      if (isWeb) {
        const engine = webEngineRef.current;
        if (!engine) {
          return;
        }
        loadedKeyRef.current = loadKey;
        await engine.load({
          key: loadKey,
          playUrl,
          shouldPlay: play,
          positionSec: seekTo,
        });
        if (gen !== loadGenRef.current) {
          return;
        }
        applyVolume();
        return;
      }

      try {
        nativePlayer.pause();
      } catch {
        // ignore
      }
      nativePlayer.replace(playUrl);
      loadedKeyRef.current = loadKey;
      await new Promise((resolve) => setTimeout(resolve, 40));
      if (gen !== loadGenRef.current) {
        return;
      }
      try {
        await nativePlayer.seekTo(seekTo);
      } catch {
        // ignore
      }
      applyVolume();
      if (play) {
        try {
          nativePlayer.play();
        } catch {
          // ignore
        }
      } else {
        try {
          nativePlayer.pause();
        } catch {
          // ignore
        }
      }
    },
    [applyVolume, nativePlayer],
  );

  const ensurePlaying = useCallback(async () => {
    if (deafenedRef.current) {
      return false;
    }
    if (isWeb) {
      return Boolean(await webEngineRef.current?.play());
    }
    try {
      nativePlayer.play();
      return true;
    } catch {
      return false;
    }
  }, [nativePlayer]);

  const pauseLocal = useCallback(() => {
    if (isWeb) {
      webEngineRef.current?.pause();
      return;
    }
    try {
      nativePlayer.pause();
    } catch {
      // ignore
    }
  }, [nativePlayer]);

  const seekLocal = useCallback(
    async (positionSec: number) => {
      if (isWeb) {
        webEngineRef.current?.seek(positionSec);
        return;
      }
      try {
        await nativePlayer.seekTo(positionSec);
      } catch {
        // ignore
      }
    },
    [nativePlayer],
  );

  const readLocalPosition = useCallback(() => {
    if (isWeb) {
      const t = webEngineRef.current?.getStatus().currentTime;
      return typeof t === 'number' && Number.isFinite(t)
        ? Math.max(0, t)
        : snapshotRef.current.positionSec;
    }
    const t = nativeStatus.currentTime;
    return typeof t === 'number' && Number.isFinite(t)
      ? Math.max(0, t)
      : snapshotRef.current.positionSec;
  }, [nativeStatus.currentTime]);

  const buildWire = useCallback((next: CallMusicSnapshot): MusicWirePayload => {
    return {
      type: 'music_state',
      bardPresent: next.bardPresent,
      queue: next.queue,
      queueAt: next.queueAt,
      currentEntryId: next.currentEntryId,
      trackId: next.trackId,
      trackTitle: next.trackTitle,
      playUrl: next.playUrl,
      playing: next.playing,
      positionSec: next.positionSec,
      globalVolume: next.globalVolume,
      at: next.at,
    };
  }, []);

  const publishSnapshot = useCallback(
    async (next: CallMusicSnapshot, opts?: { allowAnyone?: boolean }) => {
      if (liveStatus !== 'connected') {
        return;
      }
      if (!opts?.allowAnyone && !canControlRef.current) {
        return;
      }
      await publishRoomData(CALL_MUSIC_TOPIC, buildWire(next));
    },
    [buildWire, liveStatus, publishRoomData],
  );

  const commitLocal = useCallback(
    async (
      patch: Partial<CallMusicSnapshot>,
      opts?: { allowAnyone?: boolean; bumpQueue?: boolean },
    ) => {
      if (!opts?.allowAnyone && !canControlRef.current) {
        return;
      }
      const now = Date.now();
      const bumpPlaybackAt = patchTouchesPlayback(patch);
      const next: CallMusicSnapshot = {
        ...snapshotRef.current,
        ...patch,
        at: bumpPlaybackAt ? now : snapshotRef.current.at,
        queueAt: opts?.bumpQueue ? now : (patch.queueAt ?? snapshotRef.current.queueAt),
      };
      if (!next.bardPresent) {
        next.queue = [];
        next.queueAt = now;
        next.currentEntryId = null;
        next.trackId = null;
        next.trackTitle = null;
        next.playUrl = null;
        next.playing = false;
        next.positionSec = 0;
        next.at = now;
      }
      snapshotRef.current = next;
      setSnapshot(next);
      await publishSnapshot(next, opts);
    },
    [publishSnapshot],
  );

  const applyRemoteState = useCallback(
    async (incoming: Extract<MusicWirePayload, { type: 'music_state' }>) => {
      const local = snapshotRef.current;
      const incomingQueueAt = incoming.queueAt ?? incoming.at;
      const takePlayback = incoming.at >= local.at;
      const takeQueue = incomingQueueAt >= local.queueAt;

      if (!takePlayback && !takeQueue) {
        return;
      }

      applyingRemoteRef.current = true;
      const next: CallMusicSnapshot = { ...local };

      if (takeQueue) {
        next.queue = incoming.queue;
        next.queueAt = incomingQueueAt;
      }

      if (takePlayback) {
        next.bardPresent = incoming.bardPresent;
        next.currentEntryId = incoming.currentEntryId;
        next.trackId = incoming.trackId;
        next.trackTitle = incoming.trackTitle ?? null;
        next.playUrl = incoming.playUrl ?? null;
        next.playing = incoming.bardPresent ? incoming.playing : false;
        next.positionSec = incoming.positionSec;
        next.globalVolume = clamp01(incoming.globalVolume);
        next.at = incoming.at;
        if (!incoming.bardPresent) {
          next.queue = [];
          next.queueAt = Math.max(next.queueAt, incomingQueueAt);
          next.currentEntryId = null;
          next.trackId = null;
          next.trackTitle = null;
          next.playUrl = null;
          next.playing = false;
          next.positionSec = 0;
        }
      }

      setSnapshot(next);
      snapshotRef.current = next;

      if (!next.bardPresent || !next.trackId || !next.playUrl) {
        stopLocalPlayback();
        applyingRemoteRef.current = false;
        return;
      }

      if (!takePlayback) {
        applyingRemoteRef.current = false;
        return;
      }

      const loadKey = `${next.trackId}::${next.playUrl}`;
      const sameSource = loadedKeyRef.current === loadKey;
      if (!sameSource) {
        await loadFromPlayUrl(
          next.trackId,
          next.playUrl,
          next.playing,
          next.positionSec,
          next.at,
        );
      } else if (next.playing) {
        const lagSec = Math.max(0, (Date.now() - next.at) / 1000);
        const target = Math.max(0, next.positionSec + lagSec);
        const current = readLocalPosition();
        if (Math.abs(current - target) > 1.2) {
          await seekLocal(target);
        }
        applyVolume();
        await ensurePlaying();
      } else {
        pauseLocal();
      }
      applyingRemoteRef.current = false;
    },
    [
      applyVolume,
      ensurePlaying,
      loadFromPlayUrl,
      pauseLocal,
      readLocalPosition,
      seekLocal,
      stopLocalPlayback,
    ],
  );

  const applyRemoteStateRef = useRef(applyRemoteState);
  applyRemoteStateRef.current = applyRemoteState;
  const buildWireRef = useRef(buildWire);
  buildWireRef.current = buildWire;

  const reset = useCallback(() => {
    stopLocalPlayback();
    clearPlayableMusicUrlCache();
    snapshotRef.current = EMPTY_SNAPSHOT;
    setSnapshot(EMPTY_SNAPSHOT);
    setLocalVolumeState(1);
    localVolumeRef.current = 1;
  }, [stopLocalPlayback]);

  useEffect(() => {
    if (!enabled) {
      reset();
    }
  }, [enabled, reset]);

  useEffect(() => {
    if (!enabled || liveStatus !== 'connected') {
      return;
    }

    const onData: RoomDataHandler = (bytes) => {
      try {
        const raw = JSON.parse(new TextDecoder().decode(bytes)) as unknown;
        const parsed = parseWire(raw);
        if (!parsed) {
          return;
        }
        if (parsed.type === 'music_request') {
          const current = snapshotRef.current;
          if (current.bardPresent) {
            void publishRoomData(CALL_MUSIC_TOPIC, buildWireRef.current(current));
          }
          return;
        }
        void applyRemoteStateRef.current(parsed);
      } catch {
        // ignore
      }
    };

    const unsub = subscribeRoomData(CALL_MUSIC_TOPIC, onData);
    void publishRoomData(CALL_MUSIC_TOPIC, { type: 'music_request', at: Date.now() });
    return unsub;
  }, [enabled, liveStatus, publishRoomData, subscribeRoomData]);

  const summonBard = useCallback(async () => {
    if (!canControlRef.current || snapshotRef.current.bardPresent) {
      return;
    }
    resumeFromGesture();
    await commitLocal(
      {
        bardPresent: true,
        queue: [],
        currentEntryId: null,
        trackId: null,
        trackTitle: null,
        playUrl: null,
        playing: false,
        positionSec: 0,
      },
      { bumpQueue: true },
    );
  }, [commitLocal, resumeFromGesture]);

  const dismissBard = useCallback(async () => {
    if (!canControlRef.current) {
      return;
    }
    stopLocalPlayback();
    await commitLocal(
      {
        bardPresent: false,
        queue: [],
        currentEntryId: null,
        trackId: null,
        trackTitle: null,
        playUrl: null,
        playing: false,
        positionSec: 0,
      },
      { bumpQueue: true },
    );
  }, [commitLocal, stopLocalPlayback]);

  const enqueueTrack = useCallback(
    async (trackId: string, trackTitle?: string | null, durationSec?: number | null) => {
      if (!snapshotRef.current.bardPresent) {
        return;
      }
      const id = trackId.trim();
      if (!id) {
        return;
      }
      resumeFromGesture();
      let playUrl: string | null = null;
      let title = trackTitle?.trim() || null;
      let duration = durationSec ?? null;
      try {
        const fresh = await getMusicTrack(id);
        playUrl = fresh.url;
        if (!title && fresh.title) {
          title = fresh.title;
        }
        if (duration == null && fresh.durationSec != null) {
          duration = fresh.durationSec;
        }
      } catch {
        return;
      }
      if (!playUrl) {
        return;
      }
      const entry: CallMusicQueueEntry = {
        entryId: newEntryId(),
        trackId: id,
        title: title || 'Трек',
        addedBy: localDisplayNameRef.current.trim() || 'Участник',
        playUrl,
        durationSec: duration,
      };
      const queue = [...snapshotRef.current.queue, entry];
      if (canControlRef.current) {
        await commitLocal(
          {
            queue,
            currentEntryId: entry.entryId,
            trackId: entry.trackId,
            trackTitle: entry.title,
            playUrl: entry.playUrl,
            playing: true,
            positionSec: 0,
          },
          { bumpQueue: true },
        );
        await loadFromPlayUrl(entry.trackId, entry.playUrl, true, 0, Date.now());
        return;
      }
      await commitLocal({ queue }, { allowAnyone: true, bumpQueue: true });
    },
    [commitLocal, loadFromPlayUrl, resumeFromGesture],
  );

  const removeQueueEntry = useCallback(
    async (entryId: string) => {
      if (!snapshotRef.current.bardPresent) {
        return;
      }
      const entry = snapshotRef.current.queue.find((item) => item.entryId === entryId);
      if (!entry) {
        return;
      }
      const isAuthor = entry.addedBy === localDisplayNameRef.current.trim();
      if (!canControlRef.current && !isAuthor) {
        return;
      }
      const queue = snapshotRef.current.queue.filter((item) => item.entryId !== entryId);
      const removingCurrent = snapshotRef.current.currentEntryId === entryId;
      if (!removingCurrent) {
        await commitLocal({ queue }, { allowAnyone: true, bumpQueue: true });
        return;
      }
      const nextEntry = queue[0] ?? null;
      if (nextEntry && canControlRef.current) {
        resumeFromGesture();
        await commitLocal(
          {
            queue,
            currentEntryId: nextEntry.entryId,
            trackId: nextEntry.trackId,
            trackTitle: nextEntry.title,
            playUrl: nextEntry.playUrl,
            playing: snapshotRef.current.playing,
            positionSec: 0,
          },
          { bumpQueue: true },
        );
        await loadFromPlayUrl(
          nextEntry.trackId,
          nextEntry.playUrl,
          snapshotRef.current.playing,
          0,
          Date.now(),
        );
        return;
      }
      stopLocalPlayback();
      await commitLocal(
        {
          queue,
          currentEntryId: null,
          trackId: null,
          trackTitle: null,
          playUrl: null,
          playing: false,
          positionSec: 0,
        },
        { allowAnyone: true, bumpQueue: true },
      );
    },
    [commitLocal, loadFromPlayUrl, resumeFromGesture, stopLocalPlayback],
  );

  const playQueueEntry = useCallback(
    async (entryId: string) => {
      if (!canControlRef.current || !snapshotRef.current.bardPresent) {
        return;
      }
      const entry = snapshotRef.current.queue.find((item) => item.entryId === entryId);
      if (!entry) {
        return;
      }
      resumeFromGesture();
      await commitLocal({
        currentEntryId: entry.entryId,
        trackId: entry.trackId,
        trackTitle: entry.title,
        playUrl: entry.playUrl,
        playing: true,
        positionSec: 0,
      });
      await loadFromPlayUrl(entry.trackId, entry.playUrl, true, 0, Date.now());
    },
    [commitLocal, loadFromPlayUrl, resumeFromGesture],
  );

  const togglePlay = useCallback(async () => {
    if (
      !canControlRef.current ||
      !snapshotRef.current.bardPresent ||
      !snapshotRef.current.trackId ||
      !snapshotRef.current.playUrl
    ) {
      return;
    }
    if (toggleInFlightRef.current) {
      return;
    }
    toggleInFlightRef.current = true;
    try {
      resumeFromGesture();
      const positionSec = readLocalPosition();

      // Shared intent only — never flip to pause just because local audio failed to start.
      if (!snapshotRef.current.playing) {
        await commitLocal({ playing: true, positionSec });
        const snap = snapshotRef.current;
        if (snap.trackId && snap.playUrl) {
          const key = `${snap.trackId}::${snap.playUrl}`;
          if (loadedKeyRef.current !== key) {
            await loadFromPlayUrl(snap.trackId, snap.playUrl, true, positionSec, Date.now());
          } else {
            await ensurePlaying();
          }
        }
        return;
      }

      await commitLocal({ playing: false, positionSec });
      pauseLocal();
    } finally {
      toggleInFlightRef.current = false;
    }
  }, [
    commitLocal,
    ensurePlaying,
    loadFromPlayUrl,
    pauseLocal,
    readLocalPosition,
    resumeFromGesture,
  ]);

  const seek = useCallback(
    async (positionSec: number) => {
      if (
        !canControlRef.current ||
        !snapshotRef.current.bardPresent ||
        !snapshotRef.current.trackId
      ) {
        return;
      }
      const nextPos = Math.max(0, positionSec);
      await commitLocal({
        positionSec: nextPos,
        playing: snapshotRef.current.playing,
      });
      await seekLocal(nextPos);
      if (snapshotRef.current.playing) {
        await ensurePlaying();
      }
    },
    [commitLocal, ensurePlaying, seekLocal],
  );

  const stopTrack = useCallback(async () => {
    if (!canControlRef.current || !snapshotRef.current.bardPresent) {
      return;
    }
    stopLocalPlayback();
    await commitLocal({
      currentEntryId: null,
      trackId: null,
      trackTitle: null,
      playUrl: null,
      playing: false,
      positionSec: 0,
    });
  }, [commitLocal, stopLocalPlayback]);

  const setLocalVolume = useCallback(
    (volume: number) => {
      const next = clamp01(volume);
      localVolumeRef.current = next;
      setLocalVolumeState(next);
      applyVolume();
    },
    [applyVolume],
  );

  const setGlobalVolume = useCallback(
    async (volume: number) => {
      if (!canControlRef.current || !snapshotRef.current.bardPresent) {
        return;
      }
      const next = clamp01(volume);
      await commitLocal({
        globalVolume: next,
        positionSec: readLocalPosition(),
        playing: snapshotRef.current.playing,
      });
      applyVolume();
    },
    [applyVolume, commitLocal, readLocalPosition],
  );

  const requestSync = useCallback(() => {
    if (liveStatus !== 'connected') {
      return;
    }
    void publishRoomData(CALL_MUSIC_TOPIC, { type: 'music_request', at: Date.now() });
  }, [liveStatus, publishRoomData]);

  const republishState = useCallback(() => {
    const current = snapshotRef.current;
    if (liveStatus !== 'connected' || !current.bardPresent) {
      return;
    }
    void publishRoomData(CALL_MUSIC_TOPIC, buildWire(current));
  }, [buildWire, liveStatus, publishRoomData]);

  // Intent says play but element is paused — retry a few times (after Accept unlock).
  useEffect(() => {
    if (!enabled || !snapshot.playing || deafened || !snapshot.playUrl) {
      return;
    }
    const locallyPlaying = isWeb ? webStatus.playing : Boolean(nativeStatus.playing);
    if (locallyPlaying) {
      return;
    }
    void ensurePlaying();
    const t1 = setTimeout(() => void ensurePlaying(), 250);
    const t2 = setTimeout(() => void ensurePlaying(), 900);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [
    deafened,
    enabled,
    ensurePlaying,
    nativeStatus.playing,
    snapshot.playUrl,
    snapshot.playing,
    snapshot.trackId,
    snapshot.at,
    webStatus.playing,
  ]);

  // Shared pause while element still runs.
  useEffect(() => {
    if (!enabled || applyingRemoteRef.current || snapshot.playing) {
      return;
    }
    const locallyPlaying = isWeb ? webStatus.playing : Boolean(nativeStatus.playing);
    if (!locallyPlaying) {
      return;
    }
    pauseLocal();
  }, [enabled, nativeStatus.playing, pauseLocal, snapshot.playing, webStatus.playing]);

  // Controller: advance queue when track ends.
  const didJustFinish = isWeb ? webStatus.ended : Boolean(nativeStatus.didJustFinish);
  const handledEndedRef = useRef(false);
  useEffect(() => {
    if (!didJustFinish) {
      handledEndedRef.current = false;
      return;
    }
    if (handledEndedRef.current) {
      return;
    }
    if (applyingRemoteRef.current || !canControlRef.current) {
      return;
    }
    if (!snapshot.bardPresent || !snapshot.trackId || !snapshot.playing) {
      return;
    }
    handledEndedRef.current = true;
    const currentId = snapshot.currentEntryId;
    const queue = snapshotRef.current.queue;
    const idx = currentId ? queue.findIndex((item) => item.entryId === currentId) : -1;
    const nextEntry = idx >= 0 ? queue[idx + 1] ?? null : queue[0] ?? null;
    if (nextEntry) {
      void (async () => {
        resumeFromGesture();
        await commitLocal({
          currentEntryId: nextEntry.entryId,
          trackId: nextEntry.trackId,
          trackTitle: nextEntry.title,
          playUrl: nextEntry.playUrl,
          playing: true,
          positionSec: 0,
        });
        await loadFromPlayUrl(nextEntry.trackId, nextEntry.playUrl, true, 0, Date.now());
      })();
      return;
    }
    void commitLocal({
      playing: false,
      positionSec: readLocalPosition(),
    });
  }, [
    commitLocal,
    didJustFinish,
    loadFromPlayUrl,
    readLocalPosition,
    resumeFromGesture,
    snapshot.bardPresent,
    snapshot.currentEntryId,
    snapshot.playing,
    snapshot.trackId,
  ]);

  const livePositionSec = isWeb
    ? webStatus.currentTime || snapshot.positionSec
    : typeof nativeStatus.currentTime === 'number' && Number.isFinite(nativeStatus.currentTime)
      ? Math.max(0, nativeStatus.currentTime)
      : snapshot.positionSec;

  const durationSec = isWeb
    ? webStatus.duration ||
      snapshot.queue.find((item) => item.entryId === snapshot.currentEntryId)?.durationSec ||
      0
    : typeof nativeStatus.duration === 'number' &&
        Number.isFinite(nativeStatus.duration) &&
        nativeStatus.duration > 0
      ? nativeStatus.duration
      : snapshot.queue.find((item) => item.entryId === snapshot.currentEntryId)?.durationSec ||
        0;

  // Icon follows shared intent so Play never "lies" after a failed local start.
  const isPlaying = Boolean(snapshot.playing);

  return {
    snapshot,
    isPlaying,
    livePositionSec,
    durationSec,
    localVolume,
    effectiveVolume,
    localDisplayName,
    summonBard,
    dismissBard,
    enqueueTrack,
    removeQueueEntry,
    playQueueEntry,
    togglePlay,
    seek,
    stopTrack,
    setLocalVolume,
    setGlobalVolume,
    requestSync,
    republishState,
    resumeFromGesture,
    reset,
  };
}
