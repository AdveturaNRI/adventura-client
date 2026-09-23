import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';

import type { ChatLiveVoiceStatus, RoomDataHandler } from '@/hooks/use-chat-live-voice';
import { getMusicTrack } from '@/services/music/musicApi';
import { unlockWebMediaPlayback } from '@/utils/unlock-web-media';

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
  /** Shared intent or actual local player — drives play/pause icon. */
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
  /** Push current Bard state (e.g. when a peer joins). */
  republishState: () => void;
  /**
   * Call from a user gesture so Safari/Chrome allow remote Bard audio
   * without requiring a click on the Bard tile.
   */
  resumeFromGesture: () => void;
  reset: () => void;
};

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
  const statusPlayingRef = useRef(false);

  const player = useAudioPlayer(null, { updateInterval: 250 });
  const status = useAudioPlayerStatus(player);
  statusPlayingRef.current = Boolean(status.playing);

  const effectiveVolume =
    clamp01(localVolume) * clamp01(snapshot.globalVolume) * (deafened ? 0 : 1);

  const applyPlayerVolume = useCallback(() => {
    const next =
      clamp01(localVolumeRef.current) *
      clamp01(snapshotRef.current.globalVolume) *
      (deafenedRef.current ? 0 : 1);
    try {
      player.volume = next;
      // Safari often ignores element.volume — mute still cuts sound to zero.
      player.muted = next < 0.001;
    } catch {
      // ignore
    }
  }, [player]);

  const tryPlay = useCallback(() => {
    if (deafenedRef.current) {
      return;
    }
    if (!snapshotRef.current.playing || !snapshotRef.current.playUrl) {
      return;
    }
    try {
      player.play();
    } catch {
      // AbortError / NotAllowedError — resumeFromGesture retries
    }
  }, [player]);

  const resumeFromGesture = useCallback(() => {
    unlockWebMediaPlayback();
    tryPlay();
  }, [tryPlay]);

  useEffect(() => {
    applyPlayerVolume();
  }, [applyPlayerVolume, effectiveVolume]);

  // Web autoplay: remote play() is blocked until a gesture. Accept/Start unlocks
  // the document; any later tap in the tab retries the actual expo-audio element.
  useEffect(() => {
    if (Platform.OS !== 'web' || !enabled) {
      return;
    }
    const onGesture = () => {
      resumeFromGesture();
    };
    window.addEventListener('pointerdown', onGesture, true);
    window.addEventListener('keydown', onGesture, true);
    return () => {
      window.removeEventListener('pointerdown', onGesture, true);
      window.removeEventListener('keydown', onGesture, true);
    };
  }, [enabled, resumeFromGesture]);

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

  const stopLocalPlayback = useCallback(() => {
    loadGenRef.current += 1;
    loadedKeyRef.current = null;
    try {
      player.pause();
    } catch {
      // ignore
    }
  }, [player]);

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
      try {
        if (!playUrl) {
          return;
        }
        try {
          player.pause();
        } catch {
          // ignore
        }
        player.replace(playUrl);
        loadedKeyRef.current = loadKey;
        const lagSec = Math.max(0, (Date.now() - at) / 1000);
        const seekTo = Math.max(0, positionSec + (shouldPlay ? lagSec : 0));
        await new Promise((resolve) => setTimeout(resolve, 40));
        if (gen !== loadGenRef.current) {
          return;
        }
        try {
          await player.seekTo(seekTo);
        } catch {
          // ignore seek errors on fresh replace
        }
        applyPlayerVolume();
        if (shouldPlay) {
          tryPlay();
        } else {
          try {
            player.pause();
          } catch {
            // ignore
          }
        }
      } catch {
        // source swap failed — leave idle
      }
    },
    [applyPlayerVolume, player, tryPlay],
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

      // Only drive the player from playback-field updates (or first load).
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
      } else {
        const lagSec = Math.max(0, (Date.now() - next.at) / 1000);
        const target = Math.max(0, next.positionSec + (next.playing ? lagSec : 0));
        try {
          const current =
            typeof player.currentTime === 'number' && Number.isFinite(player.currentTime)
              ? player.currentTime
              : 0;
          if (Math.abs(current - target) > 1.2) {
            await player.seekTo(target);
          }
        } catch {
          // ignore
        }
        applyPlayerVolume();
        if (next.playing) {
          tryPlay();
        } else {
          try {
            player.pause();
          } catch {
            // ignore
          }
        }
      }
      applyingRemoteRef.current = false;
    },
    [applyPlayerVolume, loadFromPlayUrl, player, stopLocalPlayback, tryPlay],
  );

  const applyRemoteStateRef = useRef(applyRemoteState);
  applyRemoteStateRef.current = applyRemoteState;
  const buildWireRef = useRef(buildWire);
  buildWireRef.current = buildWire;

  const readLocalPosition = useCallback(() => {
    const t = status.currentTime;
    return typeof t === 'number' && Number.isFinite(t)
      ? Math.max(0, t)
      : snapshotRef.current.positionSec;
  }, [status.currentTime]);

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
        // Queue-only commits (enqueue) must not advance `at`, or a peer with
        // stale playing:false will wipe play/pause for everyone via takePlayback.
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

  const reset = useCallback(() => {
    stopLocalPlayback();
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
          // Anyone with Bard state can answer — queueAt merge prevents stale empty queues
          // from wiping a fresher shared queue on other controllers.
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
    if (!canControlRef.current) {
      return;
    }
    if (snapshotRef.current.bardPresent) {
      return;
    }
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
  }, [commitLocal]);

  const dismissBard = useCallback(async () => {
    if (!canControlRef.current) {
      return;
    }
    stopLocalPlayback();
    await commitLocal({
      bardPresent: false,
      queue: [],
      currentEntryId: null,
      trackId: null,
      trackTitle: null,
      playUrl: null,
      playing: false,
      positionSec: 0,
    }, { bumpQueue: true });
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
      // Controller: add + start immediately (old play-from-library behaviour).
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
    [commitLocal, loadFromPlayUrl],
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
    [commitLocal, loadFromPlayUrl, stopLocalPlayback],
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
    [commitLocal, loadFromPlayUrl],
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
      // Prefer actual element state when it disagrees with the shared flag
      // (stale remote wipe / double-tap), so the button and toggle stay aligned.
      const currentlyPlaying =
        snapshotRef.current.playing || statusPlayingRef.current;
      const playing = !currentlyPlaying;
      const positionSec = readLocalPosition();
      await commitLocal({ playing, positionSec });
      if (playing) {
        tryPlay();
      } else {
        try {
          player.pause();
        } catch {
          // ignore
        }
      }
    } finally {
      toggleInFlightRef.current = false;
    }
  }, [commitLocal, player, readLocalPosition, tryPlay]);

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
      try {
        await player.seekTo(nextPos);
        if (snapshotRef.current.playing) {
          tryPlay();
        }
      } catch {
        // ignore
      }
    },
    [commitLocal, player, tryPlay],
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
      applyPlayerVolume();
    },
    [applyPlayerVolume],
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
      applyPlayerVolume();
    },
    [applyPlayerVolume, commitLocal, readLocalPosition],
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

  // Remote play often lands before the HTMLAudioElement is unlocked — retry a few times.
  useEffect(() => {
    if (!enabled || !snapshot.playing || deafened || !snapshot.playUrl) {
      return;
    }
    if (status.playing) {
      return;
    }
    tryPlay();
    const t1 = setTimeout(() => tryPlay(), 200);
    const t2 = setTimeout(() => tryPlay(), 800);
    const t3 = setTimeout(() => tryPlay(), 2000);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
    };
  }, [
    deafened,
    enabled,
    snapshot.playUrl,
    snapshot.playing,
    snapshot.trackId,
    snapshot.at,
    status.playing,
    tryPlay,
  ]);

  // Shared flag says pause but element still running (stale wipe) — stop local audio.
  useEffect(() => {
    if (!enabled || applyingRemoteRef.current) {
      return;
    }
    if (snapshot.playing || !status.playing) {
      return;
    }
    try {
      player.pause();
    } catch {
      // ignore
    }
  }, [enabled, player, snapshot.playing, status.playing]);

  // When track ends for the controller, advance to the next queue item.
  useEffect(() => {
    if (applyingRemoteRef.current || !canControlRef.current) {
      return;
    }
    if (!snapshot.bardPresent || !snapshot.trackId || !snapshot.playing) {
      return;
    }
    if (!status.didJustFinish) {
      return;
    }
    const currentId = snapshot.currentEntryId;
    const queue = snapshotRef.current.queue;
    const idx = currentId ? queue.findIndex((item) => item.entryId === currentId) : -1;
    const nextEntry = idx >= 0 ? queue[idx + 1] ?? null : queue[0] ?? null;
    if (nextEntry) {
      void (async () => {
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
      positionSec: status.duration ?? readLocalPosition(),
    });
  }, [
    commitLocal,
    loadFromPlayUrl,
    readLocalPosition,
    snapshot.bardPresent,
    snapshot.currentEntryId,
    snapshot.playing,
    snapshot.trackId,
    status.didJustFinish,
    status.duration,
  ]);

  const livePositionSec =
    typeof status.currentTime === 'number' && Number.isFinite(status.currentTime)
      ? Math.max(0, status.currentTime)
      : snapshot.positionSec;
  const durationSec =
    typeof status.duration === 'number' && Number.isFinite(status.duration) && status.duration > 0
      ? status.duration
      : snapshot.queue.find((item) => item.entryId === snapshot.currentEntryId)?.durationSec ||
        0;

  // Icon follows shared intent, but if the element is already audible show pause.
  const isPlaying = Boolean(snapshot.playing) || Boolean(status.playing);

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
