import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Platform } from 'react-native';
import {
  ConnectionState,
  DisconnectReason,
  Room,
  RoomEvent,
  Track,
  VideoPresets,
  type Participant,
  type RemoteAudioTrack,
  type RemoteParticipant,
  type RemoteTrack,
  type RemoteTrackPublication,
  type VideoTrack,
} from 'livekit-client';

import { sanitizeBadges, type RewardBadgeType } from '@/data/rewards/catalog';
import { createChatVoiceToken } from '@/services/chats/chatsApi';
import {
  startLivekitAudioSession,
  stopLivekitAudioSession,
} from '@/services/livekit/platform';
import { playMicToggleSound, playUrgentRequestAlert } from '@/utils/call-ringtone';
import { localizeErrorMessage } from '@/utils/localizeError';
import { loadVoiceDevicePrefs, subscribeVoiceDevicePrefs } from '@/utils/voice-device-settings';
import { applyAudioOutputToElement, stopMediaStream, takePrimedMicrophone } from '@/utils/voice-media-devices';
import {
  applyMicPipelineToRoom,
  isUsableMediaDeviceId,
  syncVoicePrefsToRoom,
} from '@/utils/voice-mic-pipeline';

export type ChatLiveVoiceStatus = 'idle' | 'connecting' | 'connected' | 'error';

export type ChatLiveVoiceParticipant = {
  identity: string;
  name: string;
  speaking: boolean;
  muted: boolean;
  cameraOn: boolean;
  videoTrack: VideoTrack | null;
  avatarUrl: string | null;
  badges: RewardBadgeType[];
  avatarFrameId?: string | null;
  isLocal: boolean;
};

const URGENT_TOPIC = 'adventura.urgent';
const URGENT_COOLDOWN_MS = 800;

type UrgentPayload = {
  type: 'urgent_request' | 'urgent_clear';
  identity: string;
  at: number;
};

type JoinLiveOptions = {
  /** Mic stream grabbed in the same tap that started/accepted the call (iOS Safari). */
  primedMic?: MediaStream | null;
};

export type RoomDataHandler = (
  payload: Uint8Array,
  participant?: RemoteParticipant,
) => void;

type UseChatLiveVoiceResult = {
  status: ChatLiveVoiceStatus;
  error: string | null;
  muted: boolean;
  deafened: boolean;
  cameraOn: boolean;
  participants: ChatLiveVoiceParticipant[];
  /** identity → urgent flag (cleared only by sender toggle / leave) */
  urgentById: Record<string, boolean>;
  /** Local playback gain per remote identity (0…1). Does not affect what others hear. */
  volumeById: Record<string, number>;
  join: (conversationIdOverride?: string, options?: JoinLiveOptions) => Promise<void>;
  leave: () => Promise<void>;
  toggleMute: () => Promise<void>;
  toggleDeafen: () => Promise<void>;
  toggleCamera: () => Promise<void>;
  sendUrgentRequest: () => Promise<void>;
  setParticipantVolume: (identity: string, volume: number) => void;
  /** Reliable LiveKit data publish (topic + JSON body). No-op if not connected. */
  publishRoomData: (topic: string, payload: object) => Promise<void>;
  /** Subscribe to a data topic; returns unsubscribe. Urgent stays internal. */
  subscribeRoomData: (topic: string, handler: RoomDataHandler) => () => void;
};

function parseAvatarFromMetadata(raw: string | undefined): string | null {
  if (!raw?.trim()) {
    return null;
  }
  try {
    const parsed = JSON.parse(raw) as { avatarUrl?: string | null };
    return typeof parsed.avatarUrl === 'string' && parsed.avatarUrl.trim()
      ? parsed.avatarUrl.trim()
      : null;
  } catch {
    return null;
  }
}

function parseFrameIdFromMetadata(raw: string | undefined): string | null | undefined {
  if (!raw?.trim()) {
    return undefined;
  }
  try {
    const parsed = JSON.parse(raw) as { avatarFrameId?: unknown };
    if (!('avatarFrameId' in parsed)) {
      return undefined;
    }
    const value = parsed.avatarFrameId;
    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }
    return null;
  } catch {
    return undefined;
  }
}

function parseBadgesFromMetadata(raw: string | undefined): RewardBadgeType[] {
  if (!raw?.trim()) {
    return [];
  }
  try {
    const parsed = JSON.parse(raw) as { badges?: unknown };
    return sanitizeBadges(parsed.badges);
  } catch {
    return [];
  }
}

function getCameraVideoTrack(participant: Participant): VideoTrack | null {
  const pub = participant.getTrackPublication(Track.Source.Camera);
  if (!pub || pub.isMuted || !pub.track) {
    return null;
  }
  if (pub.track.kind !== Track.Kind.Video) {
    return null;
  }
  return pub.track as VideoTrack;
}

function mapOne(participant: Participant, isLocal: boolean): ChatLiveVoiceParticipant {
  const videoTrack = getCameraVideoTrack(participant);
  return {
    identity: participant.identity,
    name: participant.name || participant.identity,
    speaking: participant.isSpeaking,
    muted: !participant.isMicrophoneEnabled,
    cameraOn: Boolean(videoTrack),
    videoTrack,
    avatarUrl: parseAvatarFromMetadata(participant.metadata),
    badges: parseBadgesFromMetadata(participant.metadata),
    avatarFrameId: parseFrameIdFromMetadata(participant.metadata),
    isLocal,
  };
}

function mapParticipants(room: Room): ChatLiveVoiceParticipant[] {
  const local = room.localParticipant;
  const remote = Array.from(room.remoteParticipants.values());
  return [mapOne(local, true), ...remote.map((p) => mapOne(p, false))];
}

function isInsecureLanWeb(): boolean {
  if (Platform.OS !== 'web' || typeof window === 'undefined') {
    return false;
  }
  if (window.isSecureContext) {
    return false;
  }
  const host = window.location.hostname;
  return host !== 'localhost' && host !== '127.0.0.1';
}

const remoteAudioElements = new Set<HTMLMediaElement>();
/** identity → attached HTML audio elements (for direct volume when GainNode isn't ready). */
const remoteAudioByIdentity = new Map<string, Set<HTMLMediaElement>>();
/** Preferred speaker device from Settings; applied to every remote audio element. */
let preferredOutputDeviceId: string | null = null;

/**
 * Safari/iOS ignore HTMLMediaElement.volume — only WebAudio GainNode works.
 * LiveKit webAudioMix routes remote audio through GainNode so setVolume is audible.
 */
function shouldUseWebAudioMix(): boolean {
  return Platform.OS === 'web';
}

function attachRemoteAudio(
  track: RemoteTrack,
  deafened: boolean,
  identity: string,
  volume: number,
) {
  if (Platform.OS !== 'web' || track.kind !== Track.Kind.Audio) {
    return;
  }
  const webAudioMix = shouldUseWebAudioMix();
  const el = track.attach();
  el.autoplay = true;
  // With webAudioMix, LiveKit keeps the element muted and plays via GainNode.
  // Unmuting here → double audio on Safari and setVolume has no effect on the element path.
  if (webAudioMix) {
    el.muted = true;
  } else {
    el.muted = deafened || volume < 0.001;
    el.volume = deafened ? 0 : clampPlaybackVolume(volume);
  }
  el.setAttribute('playsinline', 'true');
  el.style.display = 'none';
  document.body.appendChild(el);
  remoteAudioElements.add(el);
  const id = identity.trim();
  if (id) {
    let set = remoteAudioByIdentity.get(id);
    if (!set) {
      set = new Set();
      remoteAudioByIdentity.set(id, set);
    }
    set.add(el);
  }
  void applyAudioOutputToElement(el, preferredOutputDeviceId);
  void el.play().catch(() => undefined);
}

async function applyPreferredOutputToAllRemote(): Promise<void> {
  await Promise.all(
    Array.from(remoteAudioElements).map((el) =>
      applyAudioOutputToElement(el, preferredOutputDeviceId),
    ),
  );
}

function setRemoteOutputsDeafened(deafened: boolean) {
  if (shouldUseWebAudioMix()) {
    // Dampen via GainNode in applyRemotePlaybackVolumes — don't unmute HTML elements.
    return;
  }
  for (const el of remoteAudioElements) {
    el.muted = deafened;
  }
}

function clampPlaybackVolume(value: number): number {
  if (!Number.isFinite(value)) {
    return 1;
  }
  return Math.min(1, Math.max(0, value));
}

/** Apply local per-participant gain. Deafened forces 0. */
function applyRemotePlaybackVolumes(
  room: Room | null,
  deafened: boolean,
  volumeById: Record<string, number>,
) {
  if (!room) {
    return;
  }
  const webAudioMix = shouldUseWebAudioMix();
  for (const participant of room.remoteParticipants.values()) {
    const userVol = clampPlaybackVolume(volumeById[participant.identity] ?? 1);
    const volume = deafened ? 0 : userVol;

    // Persist on the participant so late-subscribed tracks inherit the gain.
    if (typeof participant.setVolume === 'function') {
      participant.setVolume(volume, Track.Source.Microphone);
      participant.setVolume(volume, Track.Source.ScreenShareAudio);
    }

    for (const pub of participant.audioTrackPublications.values()) {
      const track = pub.track as RemoteAudioTrack | undefined;
      if (track && typeof track.setVolume === 'function') {
        track.setVolume(volume);
      }
    }

    // Direct element fallback (non-webAudioMix browsers / GainNode not connected yet).
    const els = remoteAudioByIdentity.get(participant.identity);
    if (els) {
      for (const el of els) {
        try {
          if (!webAudioMix) {
            el.volume = volume;
            el.muted = deafened || volume < 0.001;
          }
        } catch {
          // ignore
        }
      }
    }
  }
}

function clearRemoteAudioElements() {
  for (const el of remoteAudioElements) {
    try {
      el.pause();
      el.remove();
    } catch {
      // already gone
    }
  }
  remoteAudioElements.clear();
  remoteAudioByIdentity.clear();
}

function voiceConnectErrorMessage(err: unknown): string {
  const raw = localizeErrorMessage(err, '');
  const lower = raw.toLowerCase();
  if (
    /not allowed by the user agent|notallowederror|permission denied|secure context|getusermedia/i.test(
      lower,
    )
  ) {
    return 'Не удалось получить доступ к микрофону';
  }
  if (
    /ice|webrtc|turn|timeout|timed out|network|failed to fetch|websocket|connection|econn|unreachable|offline|abort/.test(
      lower,
    )
  ) {
    return 'Не удалось установить соединение. Проверь интернет — иногда нужен VPN.';
  }
  return localizeErrorMessage(err, 'Не удалось подключиться к голосовому чату');
}

const VOICE_CONNECT_TIMEOUT_MS = 20_000;
const AUTO_REJOIN_MAX_ATTEMPTS = 3;

/**
 * LiveKit always registers `freeze` → disconnect, even when disconnectOnPageLeave is false.
 * On iPhone that fires when Safari freezes the tab (Home, lock, Control Center).
 * Strip those handlers so a brief background doesn't drop the peer for everyone else.
 */
function detachLivekitPageLeaveHandlers(room: Room): void {
  if (Platform.OS !== 'web' || typeof window === 'undefined') {
    return;
  }
  const handler = (room as unknown as { onPageLeave?: EventListener }).onPageLeave;
  if (!handler) {
    return;
  }
  window.removeEventListener('freeze', handler);
  window.removeEventListener('pagehide', handler);
  window.removeEventListener('beforeunload', handler);
}

/**
 * LiveKit media session for a chat thread.
 * Web uses browser WebRTC; native registers globals via `@livekit/react-native`.
 */
export function useChatLiveVoice(conversationId: string | null): UseChatLiveVoiceResult {
  const roomRef = useRef<Room | null>(null);
  const joiningRef = useRef(false);
  const intentionalLeaveRef = useRef(false);
  /** Session still wants media (join started; not hangup / leave). */
  const expectConnectedRef = useRef(false);
  const conversationIdRef = useRef(conversationId);
  conversationIdRef.current = conversationId;
  const prevConversationIdRef = useRef(conversationId);
  const statusRef = useRef<ChatLiveVoiceStatus>('idle');
  const autoRejoinAttemptsRef = useRef(0);
  const autoRejoinTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const joinRef = useRef<(id?: string, options?: JoinLiveOptions) => Promise<void>>(async () => undefined);
  const [status, setStatus] = useState<ChatLiveVoiceStatus>('idle');
  statusRef.current = status;
  const [error, setError] = useState<string | null>(null);
  const [muted, setMuted] = useState(false);
  const [deafened, setDeafened] = useState(false);
  const [cameraOn, setCameraOn] = useState(false);
  const [volumeById, setVolumeById] = useState<Record<string, number>>({});
  const deafenedRef = useRef(false);
  const volumeByIdRef = useRef<Record<string, number>>({});
  volumeByIdRef.current = volumeById;
  const [participants, setParticipants] = useState<ChatLiveVoiceParticipant[]>([]);
  const [urgentById, setUrgentById] = useState<Record<string, boolean>>({});
  const urgentByIdRef = useRef<Record<string, boolean>>({});
  urgentByIdRef.current = urgentById;
  const lastUrgentSentAtRef = useRef(0);
  const dataHandlersRef = useRef<Map<string, Set<RoomDataHandler>>>(new Map());

  const subscribeRoomData = useCallback((topic: string, handler: RoomDataHandler) => {
    const key = topic.trim();
    if (!key) {
      return () => undefined;
    }
    let set = dataHandlersRef.current.get(key);
    if (!set) {
      set = new Set();
      dataHandlersRef.current.set(key, set);
    }
    set.add(handler);
    return () => {
      const current = dataHandlersRef.current.get(key);
      if (!current) {
        return;
      }
      current.delete(handler);
      if (current.size === 0) {
        dataHandlersRef.current.delete(key);
      }
    };
  }, []);

  const publishRoomData = useCallback(async (topic: string, payload: object) => {
    const room = roomRef.current;
    if (!room || room.state !== ConnectionState.Connected) {
      return;
    }
    const key = topic.trim();
    if (!key) {
      return;
    }
    const bytes = new TextEncoder().encode(JSON.stringify(payload));
    try {
      await room.localParticipant.publishData(bytes, {
        reliable: true,
        topic: key,
      });
    } catch (error) {
      console.warn('[voice] publishData failed', key, error);
    }
  }, []);

  const setUrgent = useCallback((identity: string, active: boolean, playSound: boolean) => {
    if (!identity) {
      return;
    }
    setUrgentById((prev) => {
      const was = Boolean(prev[identity]);
      if (active === was) {
        return prev;
      }
      if (!active) {
        if (!was) {
          return prev;
        }
        const next = { ...prev };
        delete next[identity];
        return next;
      }
      return { ...prev, [identity]: true };
    });
    if (active && playSound) {
      playUrgentRequestAlert();
    }
  }, []);

  const refreshParticipants = useCallback(() => {
    const room = roomRef.current;
    if (!room) {
      setParticipants([]);
      setCameraOn(false);
      return;
    }
    setParticipants(mapParticipants(room));
    setCameraOn(Boolean(getCameraVideoTrack(room.localParticipant)));
    setMuted(!room.localParticipant.isMicrophoneEnabled);
  }, []);

  const teardownRoom = useCallback(async (room: Room | null) => {
    clearRemoteAudioElements();
    setUrgentById({});
    if (!room) {
      await stopLivekitAudioSession().catch(() => undefined);
      return;
    }
    room.removeAllListeners();
    try {
      await room.disconnect(true);
    } catch {
      // already gone
    }
    await stopLivekitAudioSession().catch(() => undefined);
  }, []);

  const clearAutoRejoinTimer = useCallback(() => {
    if (autoRejoinTimerRef.current) {
      clearTimeout(autoRejoinTimerRef.current);
      autoRejoinTimerRef.current = null;
    }
  }, []);

  const tryAutoRejoin = useCallback(() => {
    if (intentionalLeaveRef.current || !expectConnectedRef.current) {
      return;
    }
    const id = conversationIdRef.current;
    if (!id || roomRef.current || joiningRef.current) {
      return;
    }
    if (statusRef.current !== 'error' && statusRef.current !== 'idle') {
      return;
    }
    if (Platform.OS === 'web' && typeof document !== 'undefined' && document.visibilityState === 'hidden') {
      return;
    }
    void joinRef.current(id);
  }, []);

  const scheduleAutoRejoin = useCallback(() => {
    clearAutoRejoinTimer();
    if (!expectConnectedRef.current || intentionalLeaveRef.current) {
      return;
    }
    if (autoRejoinAttemptsRef.current >= AUTO_REJOIN_MAX_ATTEMPTS) {
      return;
    }
    const attempt = autoRejoinAttemptsRef.current;
    const delayMs = Math.min(800 * 2 ** attempt, 6_000);
    autoRejoinTimerRef.current = setTimeout(() => {
      autoRejoinTimerRef.current = null;
      if (intentionalLeaveRef.current || !expectConnectedRef.current) {
        return;
      }
      if (roomRef.current || joiningRef.current) {
        return;
      }
      if (Platform.OS === 'web' && typeof document !== 'undefined' && document.visibilityState === 'hidden') {
        // Wait for visibilitychange / AppState — don't burn attempts while backgrounded.
        return;
      }
      autoRejoinAttemptsRef.current += 1;
      tryAutoRejoin();
    }, delayMs);
  }, [clearAutoRejoinTimer, tryAutoRejoin]);

  const leave = useCallback(async () => {
    intentionalLeaveRef.current = true;
    expectConnectedRef.current = false;
    joiningRef.current = false;
    autoRejoinAttemptsRef.current = 0;
    clearAutoRejoinTimer();
    preferredOutputDeviceId = null;
    const room = roomRef.current;
    roomRef.current = null;
    await teardownRoom(room);
    setParticipants([]);
    setMuted(false);
    setDeafened(false);
    setCameraOn(false);
    setVolumeById({});
    volumeByIdRef.current = {};
    deafenedRef.current = false;
    setStatus('idle');
    setError(null);
  }, [clearAutoRejoinTimer, teardownRoom]);

  const join = useCallback(async (conversationIdOverride?: string, options?: JoinLiveOptions) => {
    const targetId = conversationIdOverride ?? conversationId;
    const primedMic = options?.primedMic ?? null;
    if (!targetId || roomRef.current || joiningRef.current) {
      stopMediaStream(primedMic);
      return;
    }

    if (isInsecureLanWeb()) {
      stopMediaStream(primedMic);
      setStatus('error');
      setError(
        'Не удалось получить доступ к микрофону',
      );
      return;
    }

    joiningRef.current = true;
    intentionalLeaveRef.current = false;
    expectConnectedRef.current = true;
    clearAutoRejoinTimer();
    setStatus('connecting');
    setError(null);

    let room: Room | null = null;
    let connectTimedOut = false;
    try {
      if (Platform.OS !== 'web') {
        await startLivekitAudioSession();
      }

      const { url, token } = await createChatVoiceToken(targetId);
      if (intentionalLeaveRef.current) {
        stopMediaStream(primedMic);
        return;
      }

      room = new Room({
        adaptiveStream: true,
        dynacast: true,
        // iOS Safari fires pagehide/freeze on brief background — don't drop the call.
        // LiveKit still registers `freeze`; we strip it after connect (see detachLivekitPageLeaveHandlers).
        disconnectOnPageLeave: false,
        // Safari/iOS ignore HTMLMediaElement.volume — GainNode via webAudioMix
        // makes per-participant local volume actually audible.
        webAudioMix: shouldUseWebAudioMix(),
        // LiveKit defaults voiceIsolation: true — mobile Chrome/Safari reject it
        // with OverconstrainedError ("Invalid constraint") right after mic permission.
        audioCaptureDefaults: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          voiceIsolation: false,
          deviceId: { ideal: 'default' },
        },
        videoCaptureDefaults: {
          facingMode: 'user',
          resolution: Platform.OS === 'web' ? VideoPresets.h720.resolution : VideoPresets.h540.resolution,
        },
      });
      roomRef.current = room;

      const sync = () => refreshParticipants();
      room
        .on(RoomEvent.ParticipantConnected, sync)
        .on(RoomEvent.ParticipantDisconnected, (participant: RemoteParticipant) => {
          const id = participant.identity;
          if (id) {
            setUrgent(id, false, false);
            remoteAudioByIdentity.delete(id);
          }
          sync();
        })
        .on(RoomEvent.ActiveSpeakersChanged, sync)
        .on(RoomEvent.TrackMuted, sync)
        .on(RoomEvent.TrackUnmuted, sync)
        .on(RoomEvent.LocalTrackPublished, sync)
        .on(RoomEvent.LocalTrackUnpublished, sync)
        .on(
          RoomEvent.TrackSubscribed,
          (track: RemoteTrack, _pub: RemoteTrackPublication, participant: RemoteParticipant) => {
            const userVol = clampPlaybackVolume(
              volumeByIdRef.current[participant.identity] ?? 1,
            );
            const effective = deafenedRef.current ? 0 : userVol;
            attachRemoteAudio(track, deafenedRef.current, participant.identity, effective);
            if (track.kind === Track.Kind.Audio) {
              if (typeof participant.setVolume === 'function') {
                const source =
                  _pub.source === Track.Source.ScreenShareAudio
                    ? Track.Source.ScreenShareAudio
                    : Track.Source.Microphone;
                participant.setVolume(effective, source);
              }
              const audio = track as RemoteAudioTrack;
              if (typeof audio.setVolume === 'function') {
                audio.setVolume(effective);
              }
            }
            sync();
          },
        )
        .on(RoomEvent.TrackUnsubscribed, (track: RemoteTrack, _pub: RemoteTrackPublication, participant?: RemoteParticipant) => {
          if (Platform.OS === 'web' && track.kind === Track.Kind.Audio) {
            for (const el of track.detach()) {
              remoteAudioElements.delete(el);
              if (participant?.identity) {
                remoteAudioByIdentity.get(participant.identity)?.delete(el);
              }
              try {
                el.pause();
                el.remove();
              } catch {
                // already gone
              }
            }
          }
          sync();
        })
        .on(
          RoomEvent.DataReceived,
          (payload: Uint8Array, participant?: RemoteParticipant | undefined, _kind?: unknown, topic?: string) => {
            const topicKey = typeof topic === 'string' ? topic.trim() : '';
            if (topicKey && topicKey !== URGENT_TOPIC) {
              const handlers = dataHandlersRef.current.get(topicKey);
              if (handlers?.size) {
                for (const handler of handlers) {
                  try {
                    handler(payload, participant);
                  } catch {
                    // ignore subscriber errors
                  }
                }
              }
              return;
            }
            try {
              const raw = new TextDecoder().decode(payload);
              const parsed = JSON.parse(raw) as UrgentPayload;
              if (parsed?.type !== 'urgent_request' && parsed?.type !== 'urgent_clear') {
                return;
              }
              const identity =
                (typeof parsed.identity === 'string' && parsed.identity.trim()) ||
                participant?.identity ||
                '';
              if (!identity) {
                return;
              }
              setUrgent(identity, parsed.type === 'urgent_request', true);
            } catch {
              // ignore malformed packets
            }
          },
        )
        .on(RoomEvent.ConnectionStateChanged, (state: ConnectionState) => {
          if (state === ConnectionState.Connected) {
            setStatus('connected');
            sync();
          }
        })
        .on(RoomEvent.Disconnected, (reason?: DisconnectReason) => {
          if (intentionalLeaveRef.current) {
            return;
          }
          roomRef.current = null;
          joiningRef.current = false;
          clearRemoteAudioElements();
          void stopLivekitAudioSession().catch(() => undefined);
          setParticipants([]);
          setUrgentById({});
          setMuted(false);
          setDeafened(false);
          setCameraOn(false);
          setVolumeById({});
          volumeByIdRef.current = {};
          deafenedRef.current = false;
          // Another tab/PWA stole this identity — don't fight it with auto-rejoin.
          if (reason === DisconnectReason.DUPLICATE_IDENTITY) {
            expectConnectedRef.current = false;
            setStatus('idle');
            setError(null);
            return;
          }
          // CLIENT_INITIATED often means freeze/pagehide (or engine drop), not user hangup.
          // Keep expectConnected and show Retry; auto-rejoin when foregrounded.
          setStatus('error');
          setError(
            'Соединение с голосовым чатом оборвалось. Проверь интернет — иногда нужен VPN.',
          );
          if (expectConnectedRef.current) {
            scheduleAutoRejoin();
          }
        })
        .on(RoomEvent.MediaDevicesError, (err: Error) => {
          // First mic attempt often fails on phones (voiceIsolation / exact deviceId);
          // applyMicPipelineToRoom retries with safer constraints — don't flash English DOM errors.
          if (/invalid constraint|overconstrained/i.test(err.message ?? '')) {
            return;
          }
          setError(localizeErrorMessage(err, 'Нет доступа к камере или микрофону'));
        });

      let connectTimeoutHandle: ReturnType<typeof setTimeout> | null = setTimeout(() => {
        if (roomRef.current !== room || intentionalLeaveRef.current) {
          return;
        }
        if (room.state === ConnectionState.Connected) {
          return;
        }
        connectTimedOut = true;
        roomRef.current = null;
        joiningRef.current = false;
        void teardownRoom(room).finally(() => {
          setStatus('error');
          setError(
            'Не удалось установить соединение за 20 сек. Проверь интернет — иногда нужен VPN.',
          );
          if (expectConnectedRef.current && !intentionalLeaveRef.current) {
            scheduleAutoRejoin();
          }
        });
      }, VOICE_CONNECT_TIMEOUT_MS);

      try {
        await room.connect(url, token, { autoSubscribe: true });
      } finally {
        if (connectTimeoutHandle) {
          clearTimeout(connectTimeoutHandle);
          connectTimeoutHandle = null;
        }
      }
      if (connectTimedOut || intentionalLeaveRef.current || roomRef.current !== room) {
        if (!connectTimedOut) {
          await teardownRoom(room);
        }
        return;
      }

      // Connect registers freeze→disconnect; strip it so iOS background doesn't kick peers.
      detachLivekitPageLeaveHandlers(room);
      autoRejoinAttemptsRef.current = 0;

      if (Platform.OS === 'web') {
        try {
          await room.startAudio();
        } catch {
          // retry on next interaction
        }
      }

      const prefs = await loadVoiceDevicePrefs();
      preferredOutputDeviceId = prefs.outputDeviceId;
      if (isUsableMediaDeviceId(prefs.inputDeviceId)) {
        try {
          await room.switchActiveDevice('audioinput', prefs.inputDeviceId!);
        } catch {
          // device may have been unplugged — fall back to default
        }
      }
      if (isUsableMediaDeviceId(prefs.outputDeviceId)) {
        try {
          await room.switchActiveDevice('audiooutput', prefs.outputDeviceId!);
        } catch {
          // Safari / some Chromium builds reject sink switches
        }
      }

      const mic = await applyMicPipelineToRoom(room, {
        deviceId: isUsableMediaDeviceId(prefs.inputDeviceId) ? prefs.inputDeviceId : null,
        micGain: prefs.micGain,
        noiseSuppression: prefs.noiseSuppression,
        primedStream: primedMic,
      });
      // Ownership transferred to LiveKit (or track already ended) — don't stop here.
      await applyPreferredOutputToAllRemote();
      const micOn = mic.enabled && room.localParticipant.isMicrophoneEnabled;
      setMuted(!micOn);
      setDeafened(false);
      setCameraOn(false);
      setVolumeById({});
      volumeByIdRef.current = {};
      deafenedRef.current = false;
      setStatus('connected');
      if (!micOn) {
        setError('Не удалось получить доступ к микрофону');
      } else {
        setError(null);
      }
      refreshParticipants();
    } catch (err) {
      stopMediaStream(primedMic);
      if (connectTimedOut) {
        return;
      }
      roomRef.current = null;
      await teardownRoom(room);
      setStatus('error');
      setError(voiceConnectErrorMessage(err));
      if (expectConnectedRef.current && !intentionalLeaveRef.current) {
        scheduleAutoRejoin();
      }
    } finally {
      joiningRef.current = false;
    }
  }, [clearAutoRejoinTimer, conversationId, refreshParticipants, scheduleAutoRejoin, setUrgent, teardownRoom]);

  joinRef.current = join;

  const toggleMute = useCallback(async () => {
    const room = roomRef.current;
    if (!room || status !== 'connected') {
      return;
    }
    const currentlyMuted = !room.localParticipant.isMicrophoneEnabled;
    try {
      if (!currentlyMuted) {
        await room.localParticipant.setMicrophoneEnabled(false);
        setMuted(true);
        playMicToggleSound(true);
        refreshParticipants();
        return;
      }

      // Prefer a plain unmute when the track already exists — re-running the
      // full capture/processor pipeline often leaves the mic stuck off.
      const pub = room.localParticipant.getTrackPublication(Track.Source.Microphone);
      if (pub?.track) {
        await room.localParticipant.setMicrophoneEnabled(true);
      } else {
        const prefs = await loadVoiceDevicePrefs();
        const primed = await takePrimedMicrophone();
        const result = await applyMicPipelineToRoom(room, {
          deviceId: isUsableMediaDeviceId(prefs.inputDeviceId) ? prefs.inputDeviceId : null,
          micGain: prefs.micGain,
          noiseSuppression: prefs.noiseSuppression,
          primedStream: primed,
        });
        if (!result.enabled) {
          stopMediaStream(primed);
        }
      }

      const enabled = room.localParticipant.isMicrophoneEnabled;
      if (!enabled) {
        await room.localParticipant.setMicrophoneEnabled(true);
      }
      const finallyEnabled = room.localParticipant.isMicrophoneEnabled;
      setMuted(!finallyEnabled);
      playMicToggleSound(false);
      refreshParticipants();
      if (!finallyEnabled) {
        setError('Не удалось включить микрофон');
      } else {
        setError(null);
      }
    } catch (err) {
      setMuted(!room.localParticipant.isMicrophoneEnabled);
      setError(localizeErrorMessage(err, 'Не удалось переключить микрофон'));
      refreshParticipants();
    }
  }, [refreshParticipants, status]);

  const toggleDeafen = useCallback(async () => {
    if (status !== 'connected') {
      return;
    }
    const next = !deafenedRef.current;
    deafenedRef.current = next;
    setDeafened(next);
    setRemoteOutputsDeafened(next);
    applyRemotePlaybackVolumes(roomRef.current, next, volumeByIdRef.current);
  }, [status]);

  const setParticipantVolume = useCallback((identity: string, volume: number) => {
    const id = identity.trim();
    if (!id) {
      return;
    }
    const nextVol = clampPlaybackVolume(volume);
    const prev = volumeByIdRef.current;
    const current = clampPlaybackVolume(prev[id] ?? 1);
    if (Math.abs(current - nextVol) < 0.001) {
      return;
    }
    const next = { ...prev, [id]: nextVol };
    volumeByIdRef.current = next;
    setVolumeById(next);
    applyRemotePlaybackVolumes(roomRef.current, deafenedRef.current, next);
  }, []);

  const toggleCamera = useCallback(async () => {
    const room = roomRef.current;
    if (!room || (status !== 'connected' && status !== 'connecting')) {
      return;
    }
    const next = !cameraOn;
    const prefs = await loadVoiceDevicePrefs();
    try {
      await room.localParticipant.setCameraEnabled(next, {
        facingMode: 'user',
        resolution: Platform.OS === 'web' ? VideoPresets.h720.resolution : VideoPresets.h540.resolution,
        ...(prefs.videoDeviceId?.trim() ? { deviceId: prefs.videoDeviceId.trim() } : {}),
      });
    } catch (error) {
      throw new Error(localizeErrorMessage(error, 'Не удалось включить камеру'));
    }
    refreshParticipants();
  }, [cameraOn, refreshParticipants, status]);

  const sendUrgentRequest = useCallback(async () => {
    const room = roomRef.current;
    if (!room || status !== 'connected') {
      return;
    }
    const now = Date.now();
    if (now - lastUrgentSentAtRef.current < URGENT_COOLDOWN_MS) {
      return;
    }
    lastUrgentSentAtRef.current = now;
    const identity = room.localParticipant.identity;
    const nextActive = !urgentByIdRef.current[identity];
    const payload: UrgentPayload = {
      type: nextActive ? 'urgent_request' : 'urgent_clear',
      identity,
      at: now,
    };
    const bytes = new TextEncoder().encode(JSON.stringify(payload));
    try {
      await room.localParticipant.publishData(bytes, {
        reliable: true,
        topic: URGENT_TOPIC,
      });
    } catch (error) {
      console.warn('[voice] urgent publish failed', error);
    }
    setUrgent(identity, nextActive, nextActive);
  }, [setUrgent, status]);

  useEffect(() => {
    return () => {
      intentionalLeaveRef.current = true;
      expectConnectedRef.current = false;
      joiningRef.current = false;
      if (autoRejoinTimerRef.current) {
        clearTimeout(autoRejoinTimerRef.current);
        autoRejoinTimerRef.current = null;
      }
      const room = roomRef.current;
      roomRef.current = null;
      void teardownRoom(room);
    };
  }, [teardownRoom]);

  // Foreground after background drop (iOS freeze / network) → rejoin while session still wants media.
  useEffect(() => {
    const onForeground = () => {
      if (intentionalLeaveRef.current || !expectConnectedRef.current) {
        return;
      }
      if (!conversationIdRef.current || roomRef.current || joiningRef.current) {
        return;
      }
      if (statusRef.current !== 'error' && statusRef.current !== 'idle') {
        return;
      }
      tryAutoRejoin();
    };

    if (Platform.OS === 'web') {
      if (typeof document === 'undefined') {
        return;
      }
      const onVisibility = () => {
        if (document.visibilityState === 'visible') {
          onForeground();
        }
      };
      document.addEventListener('visibilitychange', onVisibility);
      window.addEventListener('pageshow', onForeground);
      return () => {
        document.removeEventListener('visibilitychange', onVisibility);
        window.removeEventListener('pageshow', onForeground);
      };
    }

    const sub = AppState.addEventListener('change', (next) => {
      if (next === 'active') {
        onForeground();
      }
    });
    return () => sub.remove();
  }, [tryAutoRejoin]);

  // Settings → live call: switch mic/speaker/camera without rejoining.
  useEffect(() => {
    let applySeq = 0;
    return subscribeVoiceDevicePrefs((prefs) => {
      const room = roomRef.current;
      if (!room || room.state !== ConnectionState.Connected) {
        return;
      }
      const seq = ++applySeq;
      void (async () => {
        preferredOutputDeviceId = prefs.outputDeviceId;
        if (isUsableMediaDeviceId(prefs.outputDeviceId)) {
          try {
            await room.switchActiveDevice('audiooutput', prefs.outputDeviceId!);
          } catch {
            // Safari / some Chromium builds reject sink switches
          }
        }
        await applyPreferredOutputToAllRemote();
        if (seq !== applySeq || roomRef.current !== room) {
          return;
        }

        await syncVoicePrefsToRoom(room, {
          deviceId: prefs.inputDeviceId,
          micGain: prefs.micGain,
          noiseSuppression: prefs.noiseSuppression,
        });
        if (seq !== applySeq || roomRef.current !== room) {
          return;
        }

        if (
          room.localParticipant.isCameraEnabled &&
          isUsableMediaDeviceId(prefs.videoDeviceId)
        ) {
          try {
            await room.switchActiveDevice('videoinput', prefs.videoDeviceId!);
          } catch {
            // camera may have been unplugged
          }
        }
        refreshParticipants();
      })();
    });
  }, [refreshParticipants]);

  useEffect(() => {
    const prev = prevConversationIdRef.current;
    if (prev === conversationId) {
      return;
    }
    prevConversationIdRef.current = conversationId;
    if (prev) {
      void leave();
    }
  }, [conversationId, leave]);

  return {
    status,
    error,
    muted,
    deafened,
    cameraOn,
    participants,
    urgentById,
    volumeById,
    join,
    leave,
    toggleMute,
    toggleDeafen,
    toggleCamera,
    sendUrgentRequest,
    setParticipantVolume,
    publishRoomData,
    subscribeRoomData,
  };
}
