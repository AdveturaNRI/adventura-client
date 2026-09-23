import { useCallback, useEffect, useRef, useState } from 'react';

import type { ChatLiveVoiceStatus, RoomDataHandler } from '@/hooks/use-chat-live-voice';
import { getMusicTrack } from '@/services/music/musicApi';
import { CallBardPlayerPool, type BardLayerStatus } from '@/utils/call-bard-player-pool';
import { clearPlayableMusicUrlCache } from '@/utils/music-playable-url';
import { unlockWebMediaPlayback } from '@/utils/unlock-web-media';

export const CALL_MUSIC_TOPIC = 'adventura.music';

/** Cap concurrent layers so CPU/bandwidth stay sane. */
export const MAX_CALL_MUSIC_LAYERS = 8;

export type CallMusicQueueEntry = {
  entryId: string;
  trackId: string;
  title: string;
  addedBy: string;
  playUrl: string;
  durationSec: number | null;
  /** Per-layer transport. Absent / true = playing (legacy peers). */
  playing?: boolean;
  /** Per-layer clock stamp for seek sync (optional on older peers). */
  positionSec?: number;
  /** When this layer's position was stamped. */
  at?: number;
  /** Per-track gain 0…1 for everyone in the call. Absent = 1. */
  volume?: number;
  /** Repeat this track. Absent = false. */
  loop?: boolean;
};

/**
 * Shared Bard state.
 * `queue` = tracks currently in the room (playing together), not a waiting list.
 */
export type CallMusicSnapshot = {
  bardPresent: boolean;
  /** Now playing — every entry is an active layer. */
  queue: CallMusicQueueEntry[];
  /** Bumped only when the now-playing set changes. */
  queueAt: number;
  /** Focused layer for seek / title (usually last started). */
  currentEntryId: string | null;
  trackId: string | null;
  trackTitle: string | null;
  playUrl: string | null;
  /** True if any layer wants to play — drives Bard tile aura. */
  playing: boolean;
  positionSec: number;
  globalVolume: number;
  at: number;
};

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
  const positionSec =
    typeof obj.positionSec === 'number' && Number.isFinite(obj.positionSec)
      ? Math.max(0, obj.positionSec)
      : undefined;
  const at =
    typeof obj.at === 'number' && Number.isFinite(obj.at) ? obj.at : undefined;
  const playing = typeof obj.playing === 'boolean' ? obj.playing : undefined;
  const volume =
    typeof obj.volume === 'number' && Number.isFinite(obj.volume)
      ? Math.min(1, Math.max(0, obj.volume))
      : undefined;
  const loop = typeof obj.loop === 'boolean' ? obj.loop : undefined;
  return {
    entryId,
    trackId,
    title,
    addedBy,
    playUrl,
    durationSec,
    positionSec,
    at,
    playing,
    volume,
    loop,
  };
}

function layerVolume(entry: CallMusicQueueEntry) {
  return typeof entry.volume === 'number' && Number.isFinite(entry.volume)
    ? Math.min(1, Math.max(0, entry.volume))
    : 1;
}

function layerLoops(entry: CallMusicQueueEntry) {
  return entry.loop === true;
}

function layerWantsPlay(entry: CallMusicQueueEntry) {
  return entry.playing !== false;
}

function anyLayerWantsPlay(queue: CallMusicQueueEntry[]) {
  return queue.some(layerWantsPlay);
}

function focusFromQueue(
  queue: CallMusicQueueEntry[],
  preferredId: string | null,
): Pick<
  CallMusicSnapshot,
  'currentEntryId' | 'trackId' | 'trackTitle' | 'playUrl' | 'positionSec'
> {
  const preferred =
    (preferredId ? queue.find((item) => item.entryId === preferredId) : null) ??
    queue[queue.length - 1] ??
    null;
  if (!preferred) {
    return {
      currentEntryId: null,
      trackId: null,
      trackTitle: null,
      playUrl: null,
      positionSec: 0,
    };
  }
  return {
    currentEntryId: preferred.entryId,
    trackId: preferred.trackId,
    trackTitle: preferred.title,
    playUrl: preferred.playUrl,
    positionSec: preferred.positionSec ?? 0,
  };
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
  let queue = queueRaw
    .map(parseQueueEntry)
    .filter((entry): entry is CallMusicQueueEntry => Boolean(entry));

  // Older peers: singular current track only — promote into the now-playing list.
  const trackId =
    typeof obj.trackId === 'string' && obj.trackId.trim() ? obj.trackId.trim() : null;
  const playUrl =
    typeof obj.playUrl === 'string' && obj.playUrl.trim() ? obj.playUrl.trim() : null;
  const currentEntryId =
    typeof obj.currentEntryId === 'string' && obj.currentEntryId.trim()
      ? obj.currentEntryId.trim()
      : null;
  if (queue.length === 0 && trackId && playUrl) {
    queue = [
      {
        entryId: currentEntryId || `legacy-${trackId}`,
        trackId,
        title:
          typeof obj.trackTitle === 'string' && obj.trackTitle.trim()
            ? obj.trackTitle.trim()
            : 'Трек',
        addedBy: 'Участник',
        playUrl,
        durationSec: null,
        positionSec:
          typeof obj.positionSec === 'number' && Number.isFinite(obj.positionSec)
            ? Math.max(0, obj.positionSec)
            : 0,
        at: typeof obj.at === 'number' && Number.isFinite(obj.at) ? obj.at : Date.now(),
      },
    ];
  }

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
  localDisplayName: string;
  deafened: boolean;
  publishRoomData: (topic: string, payload: object) => Promise<void>;
  subscribeRoomData: (topic: string, handler: RoomDataHandler) => () => void;
};

export type CallMusicLayerLive = {
  positionSec: number;
  durationSec: number;
  playing: boolean;
  buffering: boolean;
};

export type UseCallSharedMusicResult = {
  snapshot: CallMusicSnapshot;
  isPlaying: boolean;
  trackLoading: boolean;
  livePositionSec: number;
  durationSec: number;
  /** Live transport status per now-playing entry. */
  layerLive: Record<string, CallMusicLayerLive>;
  localVolume: number;
  effectiveVolume: number;
  localDisplayName: string;
  summonBard: () => Promise<void>;
  dismissBard: () => Promise<void>;
  /** Start a track alongside whatever is already playing. */
  enqueueTrack: (
    trackId: string,
    trackTitle?: string | null,
    durationSec?: number | null,
    playUrl?: string | null,
  ) => Promise<void>;
  removeQueueEntry: (entryId: string) => Promise<void>;
  /** Focus a playing track (legacy / title). */
  playQueueEntry: (entryId: string) => Promise<void>;
  toggleLayerPlay: (entryId: string) => Promise<void>;
  seekLayer: (entryId: string, positionSec: number) => Promise<void>;
  setLayerVolume: (entryId: string, volume: number) => Promise<void>;
  toggleLayerLoop: (entryId: string) => Promise<void>;
  /** @deprecated Prefer per-layer controls; pauses/resumes every layer. */
  togglePlay: () => Promise<void>;
  seek: (positionSec: number) => Promise<void>;
  stopTrack: () => Promise<void>;
  setLocalVolume: (volume: number) => void;
  setGlobalVolume: (volume: number) => Promise<void>;
  requestSync: () => void;
  republishState: () => void;
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
  const [layerStatus, setLayerStatus] = useState<Record<string, BardLayerStatus>>({});
  const [trackLoading, setTrackLoading] = useState(false);

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
  const applyingRemoteRef = useRef(false);
  const toggleInFlightRef = useRef(false);
  const poolRef = useRef<CallBardPlayerPool | null>(null);
  const layerStatusRef = useRef(layerStatus);
  layerStatusRef.current = layerStatus;

  useEffect(() => {
    const pool = new CallBardPlayerPool();
    poolRef.current = pool;
    const unsub = pool.subscribe((entryId, status) => {
      setLayerStatus((prev) => {
        const prevStatus = prev[entryId];
        if (
          prevStatus &&
          prevStatus.playing === status.playing &&
          prevStatus.ended === status.ended &&
          prevStatus.buffering === status.buffering &&
          Math.abs(prevStatus.currentTime - status.currentTime) < 0.2 &&
          Math.abs(prevStatus.duration - status.duration) < 0.2
        ) {
          return prev;
        }
        return { ...prev, [entryId]: status };
      });
    });
    return () => {
      unsub();
      pool.dispose();
      poolRef.current = null;
      clearPlayableMusicUrlCache();
    };
  }, []);

  const effectiveVolume =
    clamp01(localVolume) * clamp01(snapshot.globalVolume) * (deafened ? 0 : 1);

  const applyVolume = useCallback(() => {
    const master =
      clamp01(localVolumeRef.current) *
      clamp01(snapshotRef.current.globalVolume) *
      (deafenedRef.current ? 0 : 1);
    const pool = poolRef.current;
    if (!pool) {
      return;
    }
    pool.setVolume(master);
    const gains: Record<string, number> = {};
    const loops: Record<string, boolean> = {};
    for (const entry of snapshotRef.current.queue) {
      gains[entry.entryId] = layerVolume(entry);
      loops[entry.entryId] = layerLoops(entry);
    }
    pool.syncLayerGains(gains);
    pool.syncLayerLoops(loops);
  }, []);

  useEffect(() => {
    applyVolume();
  }, [applyVolume, effectiveVolume]);

  const resumeFromGesture = useCallback(() => {
    unlockWebMediaPlayback();
    poolRef.current?.unlockFromGesture();
    const queue = snapshotRef.current.queue;
    if (deafenedRef.current) {
      return;
    }
    for (const entry of queue) {
      if (layerWantsPlay(entry)) {
        void poolRef.current?.play(entry.entryId);
      }
    }
  }, []);

  const armPlaybackGesture = useCallback(() => {
    unlockWebMediaPlayback();
    poolRef.current?.resumeContextFromGesture();
  }, []);

  const stopLocalPlayback = useCallback(() => {
    setTrackLoading(false);
    poolRef.current?.stopAll();
    setLayerStatus({});
  }, []);

  const stampQueuePositions = useCallback((queue: CallMusicQueueEntry[]): CallMusicQueueEntry[] => {
    const now = Date.now();
    return queue.map((entry) => {
      const status = layerStatusRef.current[entry.entryId] ?? poolRef.current?.getStatus(entry.entryId);
      return {
        ...entry,
        positionSec: status?.currentTime ?? entry.positionSec ?? 0,
        at: now,
      };
    });
  }, []);

  const syncLayersToQueue = useCallback(
    async (queue: CallMusicQueueEntry[], playbackAt: number) => {
      const pool = poolRef.current;
      if (!pool) {
        return;
      }
      const wantIds = new Set(queue.map((entry) => entry.entryId));
      for (const entryId of pool.listEntryIds()) {
        if (!wantIds.has(entryId)) {
          pool.stopLayer(entryId);
        }
      }
      setLayerStatus((prev) => {
        const next = { ...prev };
        for (const key of Object.keys(next)) {
          if (!wantIds.has(key)) {
            delete next[key];
          }
        }
        return next;
      });

      const anyPlay = anyLayerWantsPlay(queue) && !deafenedRef.current;
      if (anyPlay && queue.length > 0) {
        setTrackLoading(true);
      }

      await Promise.all(
        queue.map(async (entry) => {
          const play = layerWantsPlay(entry) && !deafenedRef.current;
          const stampedAt = entry.at ?? playbackAt;
          const lagSec = Math.max(0, (Date.now() - stampedAt) / 1000);
          const basePos = entry.positionSec ?? 0;
          const seekTo = Math.max(0, basePos + (play ? lagSec : 0));
          await pool.load({
            entryId: entry.entryId,
            trackId: entry.trackId,
            playUrl: entry.playUrl,
            shouldPlay: play,
            positionSec: seekTo,
            loop: layerLoops(entry),
          });
        }),
      );

      applyVolume();
      setTrackLoading(false);
    },
    [applyVolume],
  );

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
      opts?: { allowAnyone?: boolean; bumpQueue?: boolean; publish?: boolean },
    ) => {
      if (!opts?.allowAnyone && !canControlRef.current) {
        return;
      }
      const now = Date.now();
      const bumpPlaybackAt = patchTouchesPlayback(patch);
      let next: CallMusicSnapshot = {
        ...snapshotRef.current,
        ...patch,
        at: bumpPlaybackAt ? now : snapshotRef.current.at,
        queueAt: opts?.bumpQueue ? now : (patch.queueAt ?? snapshotRef.current.queueAt),
      };
      if (!next.bardPresent) {
        next = {
          ...EMPTY_SNAPSHOT,
          globalVolume: next.globalVolume,
          at: now,
          queueAt: now,
        };
      } else if (patch.queue) {
        const focus = focusFromQueue(next.queue, next.currentEntryId);
        next = {
          ...next,
          ...focus,
          playing: anyLayerWantsPlay(next.queue),
        };
      }
      snapshotRef.current = next;
      setSnapshot(next);
      if (opts?.publish === false) {
        return;
      }
      void publishSnapshot(next, opts);
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
      let next: CallMusicSnapshot = { ...local };

      if (takeQueue) {
        next.queue = incoming.queue;
        next.queueAt = incomingQueueAt;
      }

      if (takePlayback) {
        next.bardPresent = incoming.bardPresent;
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
        } else {
          const anyExplicit = next.queue.some((entry) => typeof entry.playing === 'boolean');
          if (!anyExplicit) {
            next.queue = next.queue.map((entry) => ({
              ...entry,
              playing: incoming.playing,
            }));
          }
          const focus = focusFromQueue(
            next.queue,
            incoming.currentEntryId ?? local.currentEntryId,
          );
          next = {
            ...next,
            ...focus,
            playing: anyLayerWantsPlay(next.queue),
            positionSec:
              incoming.currentEntryId &&
              incoming.currentEntryId === focus.currentEntryId
                ? incoming.positionSec
                : focus.positionSec,
          };
        }
      } else if (takeQueue) {
        const focus = focusFromQueue(next.queue, next.currentEntryId);
        next = {
          ...next,
          ...focus,
          playing: anyLayerWantsPlay(next.queue),
        };
      }

      setSnapshot(next);
      snapshotRef.current = next;

      if (!next.bardPresent) {
        stopLocalPlayback();
        applyingRemoteRef.current = false;
        return;
      }

      if (takeQueue || takePlayback) {
        await syncLayersToQueue(next.queue, next.at);
      }
      applyingRemoteRef.current = false;
    },
    [stopLocalPlayback, syncLayersToQueue],
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
    setTrackLoading(false);
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
    async (
      trackId: string,
      trackTitle?: string | null,
      durationSec?: number | null,
      knownPlayUrl?: string | null,
    ) => {
      if (!snapshotRef.current.bardPresent) {
        return;
      }
      const id = trackId.trim();
      if (!id) {
        return;
      }
      armPlaybackGesture();

      let playUrl = knownPlayUrl?.trim() || null;
      let title = trackTitle?.trim() || null;
      let duration = durationSec ?? null;

      if (!playUrl) {
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
      } else {
        void getMusicTrack(id)
          .then((fresh) => {
            if (!fresh.url) {
              return;
            }
            const current = snapshotRef.current;
            const hit = current.queue.find((item) => item.trackId === id && item.playUrl === playUrl);
            if (!hit || fresh.url === playUrl) {
              return;
            }
            const queue = current.queue.map((item) =>
              item.entryId === hit.entryId ? { ...item, playUrl: fresh.url } : item,
            );
            void commitLocal(
              {
                queue,
                ...focusFromQueue(queue, hit.entryId),
                playing: current.playing,
              },
              { bumpQueue: true, allowAnyone: canControlRef.current },
            );
            if (canControlRef.current) {
              void poolRef.current?.load({
                entryId: hit.entryId,
                trackId: hit.trackId,
                playUrl: fresh.url,
                shouldPlay: current.playing && !deafenedRef.current,
                positionSec: layerStatusRef.current[hit.entryId]?.currentTime ?? 0,
                loop: layerLoops(hit),
              });
            }
          })
          .catch(() => undefined);
      }

      if (!playUrl) {
        return;
      }

      const now = Date.now();
      const entry: CallMusicQueueEntry = {
        entryId: newEntryId(),
        trackId: id,
        title: title || 'Трек',
        addedBy: localDisplayNameRef.current.trim() || 'Участник',
        playUrl,
        durationSec: duration,
        playing: true,
        positionSec: 0,
        at: now,
        volume: 1,
        loop: false,
      };

      const stamped = stampQueuePositions(snapshotRef.current.queue);
      let queue = [...stamped, entry];
      if (queue.length > MAX_CALL_MUSIC_LAYERS) {
        const dropped = queue.slice(0, queue.length - MAX_CALL_MUSIC_LAYERS);
        queue = queue.slice(queue.length - MAX_CALL_MUSIC_LAYERS);
        for (const item of dropped) {
          poolRef.current?.stopLayer(item.entryId);
        }
      }

      if (canControlRef.current) {
        void commitLocal(
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
        setTrackLoading(true);
        void poolRef.current
          ?.load({
            entryId: entry.entryId,
            trackId: entry.trackId,
            playUrl: entry.playUrl,
            shouldPlay: !deafenedRef.current,
            positionSec: 0,
            loop: false,
          })
          .finally(() => setTrackLoading(false));
        applyVolume();
        return;
      }

      // Non-controller can start a layer too — peers merge via wire.
      await commitLocal({ queue, playing: true, ...focusFromQueue(queue, entry.entryId) }, {
        allowAnyone: true,
        bumpQueue: true,
      });
      setTrackLoading(true);
      void poolRef.current
        ?.load({
          entryId: entry.entryId,
          trackId: entry.trackId,
          playUrl: entry.playUrl,
          shouldPlay: !deafenedRef.current,
          positionSec: 0,
          loop: false,
        })
        .finally(() => setTrackLoading(false));
      applyVolume();
    },
    [applyVolume, armPlaybackGesture, commitLocal, stampQueuePositions],
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
      poolRef.current?.stopLayer(entryId);
      const queue = stampQueuePositions(
        snapshotRef.current.queue.filter((item) => item.entryId !== entryId),
      );
      const focus = focusFromQueue(queue, snapshotRef.current.currentEntryId);
      await commitLocal(
        {
          queue,
          ...focus,
          playing: anyLayerWantsPlay(queue),
        },
        { allowAnyone: true, bumpQueue: true },
      );
    },
    [commitLocal, stampQueuePositions],
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
      armPlaybackGesture();
      const status = poolRef.current?.getStatus(entryId);
      const now = Date.now();
      const queue = snapshotRef.current.queue.map((item) =>
        item.entryId === entryId
          ? {
              ...item,
              playing: true,
              positionSec: status?.currentTime ?? item.positionSec ?? 0,
              at: now,
            }
          : item,
      );
      void commitLocal({
        queue,
        currentEntryId: entry.entryId,
        trackId: entry.trackId,
        trackTitle: entry.title,
        playUrl: entry.playUrl,
        positionSec: status?.currentTime ?? entry.positionSec ?? 0,
        playing: true,
      });
      if (!deafenedRef.current) {
        await poolRef.current?.play(entryId);
      }
    },
    [armPlaybackGesture, commitLocal],
  );

  const toggleLayerPlay = useCallback(
    async (entryId: string) => {
      if (!canControlRef.current || !snapshotRef.current.bardPresent) {
        return;
      }
      const entry = snapshotRef.current.queue.find((item) => item.entryId === entryId);
      if (!entry) {
        return;
      }
      armPlaybackGesture();
      const status = poolRef.current?.getStatus(entryId);
      const nextPlaying = !layerWantsPlay(entry);
      const now = Date.now();
      const queue = snapshotRef.current.queue.map((item) =>
        item.entryId === entryId
          ? {
              ...item,
              playing: nextPlaying,
              positionSec: status?.currentTime ?? item.positionSec ?? 0,
              at: now,
            }
          : item,
      );
      void commitLocal({
        queue,
        currentEntryId: entryId,
        trackId: entry.trackId,
        trackTitle: entry.title,
        playUrl: entry.playUrl,
        positionSec: status?.currentTime ?? entry.positionSec ?? 0,
        playing: anyLayerWantsPlay(queue),
      });
      if (nextPlaying && !deafenedRef.current) {
        await poolRef.current?.play(entryId);
      } else {
        poolRef.current?.pause(entryId);
      }
    },
    [armPlaybackGesture, commitLocal],
  );

  const seekLayer = useCallback(
    async (entryId: string, positionSec: number) => {
      if (!canControlRef.current || !snapshotRef.current.bardPresent) {
        return;
      }
      const entry = snapshotRef.current.queue.find((item) => item.entryId === entryId);
      if (!entry) {
        return;
      }
      const nextPos = Math.max(0, positionSec);
      const now = Date.now();
      const queue = snapshotRef.current.queue.map((item) =>
        item.entryId === entryId ? { ...item, positionSec: nextPos, at: now } : item,
      );
      await commitLocal({
        queue,
        currentEntryId: entryId,
        trackId: entry.trackId,
        trackTitle: entry.title,
        playUrl: entry.playUrl,
        positionSec: nextPos,
        playing: anyLayerWantsPlay(queue),
      });
      poolRef.current?.seek(entryId, nextPos);
      if (layerWantsPlay(entry) && !deafenedRef.current) {
        await poolRef.current?.play(entryId);
      }
    },
    [commitLocal],
  );

  const setLayerVolume = useCallback(
    async (entryId: string, volume: number) => {
      if (!canControlRef.current || !snapshotRef.current.bardPresent) {
        return;
      }
      const entry = snapshotRef.current.queue.find((item) => item.entryId === entryId);
      if (!entry) {
        return;
      }
      const nextVol = clamp01(volume);
      const queue = snapshotRef.current.queue.map((item) =>
        item.entryId === entryId ? { ...item, volume: nextVol } : item,
      );
      await commitLocal(
        {
          queue,
          playing: anyLayerWantsPlay(queue),
        },
        { bumpQueue: true },
      );
      poolRef.current?.setLayerGain(entryId, nextVol);
      applyVolume();
    },
    [applyVolume, commitLocal],
  );

  const toggleLayerLoop = useCallback(
    async (entryId: string) => {
      if (!canControlRef.current || !snapshotRef.current.bardPresent) {
        return;
      }
      const entry = snapshotRef.current.queue.find((item) => item.entryId === entryId);
      if (!entry) {
        return;
      }
      const nextLoop = !layerLoops(entry);
      const queue = snapshotRef.current.queue.map((item) =>
        item.entryId === entryId ? { ...item, loop: nextLoop } : item,
      );
      await commitLocal(
        {
          queue,
          playing: anyLayerWantsPlay(queue),
        },
        { bumpQueue: true },
      );
      poolRef.current?.setLayerLoop(entryId, nextLoop);
    },
    [commitLocal],
  );

  const togglePlay = useCallback(async () => {
    if (!canControlRef.current || !snapshotRef.current.bardPresent) {
      return;
    }
    if (snapshotRef.current.queue.length === 0) {
      return;
    }
    if (toggleInFlightRef.current) {
      return;
    }
    toggleInFlightRef.current = true;
    try {
      armPlaybackGesture();
      const snap = snapshotRef.current;
      const resume = !anyLayerWantsPlay(snap.queue);
      const now = Date.now();
      const queue = stampQueuePositions(snap.queue).map((entry) => ({
        ...entry,
        playing: resume,
        at: now,
      }));
      const focus = focusFromQueue(queue, snap.currentEntryId);
      void commitLocal({
        queue,
        ...focus,
        playing: resume,
      });
      if (resume) {
        setTrackLoading(true);
        await syncLayersToQueue(queue, Date.now());
        setTrackLoading(false);
      } else {
        setTrackLoading(false);
        poolRef.current?.pauseAll();
      }
    } finally {
      toggleInFlightRef.current = false;
    }
  }, [armPlaybackGesture, commitLocal, stampQueuePositions, syncLayersToQueue]);

  const seek = useCallback(
    async (positionSec: number) => {
      const entryId = snapshotRef.current.currentEntryId;
      if (!entryId) {
        return;
      }
      await seekLayer(entryId, positionSec);
    },
    [seekLayer],
  );

  const stopTrack = useCallback(async () => {
    if (!canControlRef.current || !snapshotRef.current.bardPresent) {
      return;
    }
    stopLocalPlayback();
    await commitLocal(
      {
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
      const queue = stampQueuePositions(snapshotRef.current.queue);
      await commitLocal({
        queue,
        globalVolume: next,
        positionSec: focusFromQueue(queue, snapshotRef.current.currentEntryId).positionSec,
        playing: snapshotRef.current.playing,
      });
      applyVolume();
    },
    [applyVolume, commitLocal, stampQueuePositions],
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

  // Intent says a layer should play but engine is paused — nudge that layer.
  useEffect(() => {
    if (!enabled || deafened || snapshot.queue.length === 0) {
      return;
    }
    const stuck = snapshot.queue.filter(
      (entry) => layerWantsPlay(entry) && !layerStatus[entry.entryId]?.playing,
    );
    if (stuck.length === 0) {
      return;
    }
    for (const entry of stuck) {
      void poolRef.current?.play(entry.entryId);
    }
    const t1 = setTimeout(() => {
      for (const entry of stuck) {
        void poolRef.current?.play(entry.entryId);
      }
    }, 250);
    const t2 = setTimeout(() => {
      for (const entry of stuck) {
        void poolRef.current?.play(entry.entryId);
      }
    }, 900);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [deafened, enabled, layerStatus, snapshot.queue, snapshot.at]);

  // Pause layers whose shared intent is paused.
  useEffect(() => {
    if (!enabled || applyingRemoteRef.current) {
      return;
    }
    for (const entry of snapshot.queue) {
      if (layerWantsPlay(entry)) {
        continue;
      }
      if (layerStatus[entry.entryId]?.playing) {
        poolRef.current?.pause(entry.entryId);
      }
    }
  }, [enabled, layerStatus, snapshot.queue]);

  // Drop finished layers (controller only).
  const handledEndedRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    if (applyingRemoteRef.current || !canControlRef.current) {
      return;
    }
    if (!snapshot.bardPresent) {
      handledEndedRef.current.clear();
      return;
    }
    const endedIds = snapshot.queue
      .filter((entry) => !layerLoops(entry) && layerStatus[entry.entryId]?.ended)
      .map((entry) => entry.entryId);
    for (const entryId of endedIds) {
      if (handledEndedRef.current.has(entryId)) {
        continue;
      }
      handledEndedRef.current.add(entryId);
      void removeQueueEntry(entryId);
    }
    for (const id of [...handledEndedRef.current]) {
      if (!snapshot.queue.some((entry) => entry.entryId === id)) {
        handledEndedRef.current.delete(id);
      }
    }
  }, [layerStatus, removeQueueEntry, snapshot.bardPresent, snapshot.queue]);

  const focusId = snapshot.currentEntryId;
  const focusStatus = focusId ? layerStatus[focusId] : undefined;
  const livePositionSec = focusStatus?.currentTime ?? snapshot.positionSec;
  const durationSec =
    focusStatus?.duration ||
    snapshot.queue.find((item) => item.entryId === focusId)?.durationSec ||
    0;

  useEffect(() => {
    const wantsPlay = anyLayerWantsPlay(snapshot.queue);
    if (!wantsPlay) {
      setTrackLoading(false);
      return;
    }
    const buffering = snapshot.queue.some(
      (entry) => layerWantsPlay(entry) && layerStatus[entry.entryId]?.buffering,
    );
    const anyPlaying = snapshot.queue.some((entry) => layerStatus[entry.entryId]?.playing);
    if (buffering) {
      setTrackLoading(true);
      return;
    }
    if (anyPlaying) {
      setTrackLoading(false);
    }
  }, [layerStatus, snapshot.queue]);

  const layerLive: Record<string, CallMusicLayerLive> = {};
  for (const entry of snapshot.queue) {
    const status = layerStatus[entry.entryId];
    layerLive[entry.entryId] = {
      positionSec: status?.currentTime ?? entry.positionSec ?? 0,
      durationSec:
        status?.duration ||
        (typeof entry.durationSec === 'number' && entry.durationSec > 0 ? entry.durationSec : 0),
      playing: Boolean(status?.playing ?? layerWantsPlay(entry)),
      buffering: Boolean(status?.buffering),
    };
  }

  const isPlaying = anyLayerWantsPlay(snapshot.queue);
  const showTrackLoading = Boolean(
    trackLoading && snapshot.queue.some((entry) => layerWantsPlay(entry)),
  );

  return {
    snapshot,
    isPlaying,
    trackLoading: showTrackLoading,
    livePositionSec,
    durationSec,
    layerLive,
    localVolume,
    effectiveVolume,
    localDisplayName,
    summonBard,
    dismissBard,
    enqueueTrack,
    removeQueueEntry,
    playQueueEntry,
    toggleLayerPlay,
    seekLayer,
    setLayerVolume,
    toggleLayerLoop,
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
