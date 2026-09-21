import { useCallback, useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';
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
import { loadVoiceDevicePrefs } from '@/utils/voice-device-settings';
import { applyAudioOutputToElement } from '@/utils/voice-media-devices';
import { applyMicPipelineToRoom } from '@/utils/voice-mic-pipeline';

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
const URGENT_TTL_MS = 8_000;
const URGENT_COOLDOWN_MS = 4_000;

type UrgentPayload = {
  type: 'urgent_request';
  identity: string;
  at: number;
};

type UseChatLiveVoiceResult = {
  status: ChatLiveVoiceStatus;
  error: string | null;
  muted: boolean;
  deafened: boolean;
  cameraOn: boolean;
  participants: ChatLiveVoiceParticipant[];
  /** identity → expiresAt ms */
  urgentUntilById: Record<string, number>;
  join: (conversationIdOverride?: string) => Promise<void>;
  leave: () => Promise<void>;
  toggleMute: () => Promise<void>;
  toggleDeafen: () => Promise<void>;
  toggleCamera: () => Promise<void>;
  sendUrgentRequest: () => Promise<void>;
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
/** Preferred speaker device from Settings; applied to every remote audio element. */
let preferredOutputDeviceId: string | null = null;

function attachRemoteAudio(track: RemoteTrack, deafened: boolean) {
  if (Platform.OS !== 'web' || track.kind !== Track.Kind.Audio) {
    return;
  }
  const el = track.attach();
  el.autoplay = true;
  el.muted = deafened;
  el.setAttribute('playsinline', 'true');
  el.style.display = 'none';
  document.body.appendChild(el);
  remoteAudioElements.add(el);
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
  for (const el of remoteAudioElements) {
    el.muted = deafened;
  }
}

function setNativeRemoteAudioVolume(room: Room | null, deafened: boolean) {
  if (!room || Platform.OS === 'web') {
    return;
  }
  const volume = deafened ? 0 : 1;
  for (const participant of room.remoteParticipants.values()) {
    for (const pub of participant.audioTrackPublications.values()) {
      const track = pub.track as RemoteAudioTrack | undefined;
      if (track && typeof track.setVolume === 'function') {
        track.setVolume(volume);
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
}

function voiceConnectErrorMessage(err: unknown): string {
  const raw = localizeErrorMessage(err, '');
  const lower = raw.toLowerCase();
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

/**
 * LiveKit media session for a chat thread.
 * Web uses browser WebRTC; native registers globals via `@livekit/react-native`.
 */
export function useChatLiveVoice(conversationId: string | null): UseChatLiveVoiceResult {
  const roomRef = useRef<Room | null>(null);
  const joiningRef = useRef(false);
  const intentionalLeaveRef = useRef(false);
  const [status, setStatus] = useState<ChatLiveVoiceStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const [muted, setMuted] = useState(false);
  const [deafened, setDeafened] = useState(false);
  const [cameraOn, setCameraOn] = useState(false);
  const deafenedRef = useRef(false);
  const [participants, setParticipants] = useState<ChatLiveVoiceParticipant[]>([]);
  const [urgentUntilById, setUrgentUntilById] = useState<Record<string, number>>({});
  const lastUrgentSentAtRef = useRef(0);
  const urgentTimersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const clearUrgentTimers = useCallback(() => {
    for (const timer of urgentTimersRef.current.values()) {
      clearTimeout(timer);
    }
    urgentTimersRef.current.clear();
  }, []);

  const applyUrgent = useCallback((identity: string, playSound: boolean) => {
    if (!identity) {
      return;
    }
    const expiresAt = Date.now() + URGENT_TTL_MS;
    setUrgentUntilById((prev) => ({ ...prev, [identity]: expiresAt }));
    const existing = urgentTimersRef.current.get(identity);
    if (existing) {
      clearTimeout(existing);
    }
    const timer = setTimeout(() => {
      urgentTimersRef.current.delete(identity);
      setUrgentUntilById((prev) => {
        if (!prev[identity]) {
          return prev;
        }
        const next = { ...prev };
        delete next[identity];
        return next;
      });
    }, URGENT_TTL_MS);
    urgentTimersRef.current.set(identity, timer);
    if (playSound) {
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
    clearUrgentTimers();
    setUrgentUntilById({});
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
  }, [clearUrgentTimers]);

  const leave = useCallback(async () => {
    intentionalLeaveRef.current = true;
    joiningRef.current = false;
    preferredOutputDeviceId = null;
    const room = roomRef.current;
    roomRef.current = null;
    await teardownRoom(room);
    setParticipants([]);
    setMuted(false);
    setDeafened(false);
    setCameraOn(false);
    deafenedRef.current = false;
    setStatus('idle');
    setError(null);
  }, [teardownRoom]);

  const join = useCallback(async (conversationIdOverride?: string) => {
    const targetId = conversationIdOverride ?? conversationId;
    if (!targetId || roomRef.current || joiningRef.current) {
      return;
    }

    if (isInsecureLanWeb()) {
      setStatus('error');
      setError(
        'На телефоне нужен HTTPS: открой чат с localhost на компьютере или через туннель Expo',
      );
      return;
    }

    joiningRef.current = true;
    intentionalLeaveRef.current = false;
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
        return;
      }

      room = new Room({
        adaptiveStream: true,
        dynacast: true,
        disconnectOnPageLeave: true,
        videoCaptureDefaults: {
          facingMode: 'user',
          resolution: Platform.OS === 'web' ? VideoPresets.h720.resolution : VideoPresets.h540.resolution,
        },
      });
      roomRef.current = room;

      const sync = () => refreshParticipants();
      room
        .on(RoomEvent.ParticipantConnected, sync)
        .on(RoomEvent.ParticipantDisconnected, sync)
        .on(RoomEvent.ActiveSpeakersChanged, sync)
        .on(RoomEvent.TrackMuted, sync)
        .on(RoomEvent.TrackUnmuted, sync)
        .on(RoomEvent.LocalTrackPublished, sync)
        .on(RoomEvent.LocalTrackUnpublished, sync)
        .on(
          RoomEvent.TrackSubscribed,
          (track: RemoteTrack, _pub: RemoteTrackPublication, _participant: RemoteParticipant) => {
            attachRemoteAudio(track, deafenedRef.current);
            if (Platform.OS !== 'web' && track.kind === Track.Kind.Audio) {
              const audio = track as RemoteAudioTrack;
              if (typeof audio.setVolume === 'function') {
                audio.setVolume(deafenedRef.current ? 0 : 1);
              }
            }
            sync();
          },
        )
        .on(RoomEvent.TrackUnsubscribed, (track: RemoteTrack) => {
          if (Platform.OS === 'web' && track.kind === Track.Kind.Audio) {
            for (const el of track.detach()) {
              remoteAudioElements.delete(el);
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
            if (topic && topic !== URGENT_TOPIC) {
              return;
            }
            try {
              const raw = new TextDecoder().decode(payload);
              const parsed = JSON.parse(raw) as UrgentPayload;
              if (parsed?.type !== 'urgent_request') {
                return;
              }
              const identity =
                (typeof parsed.identity === 'string' && parsed.identity.trim()) ||
                participant?.identity ||
                '';
              if (!identity) {
                return;
              }
              applyUrgent(identity, true);
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
          setUrgentUntilById({});
          clearUrgentTimers();
          setMuted(false);
          setDeafened(false);
          setCameraOn(false);
          deafenedRef.current = false;
          if (
            reason === DisconnectReason.DUPLICATE_IDENTITY ||
            reason === DisconnectReason.CLIENT_INITIATED
          ) {
            setStatus('idle');
            setError(null);
            return;
          }
          setStatus('error');
          setError(
            'Соединение с голосовым чатом оборвалось. Проверь интернет — иногда нужен VPN.',
          );
        })
        .on(RoomEvent.MediaDevicesError, (err: Error) => {
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

      if (Platform.OS === 'web') {
        try {
          await room.startAudio();
        } catch {
          // retry on next interaction
        }
      }

      const prefs = await loadVoiceDevicePrefs();
      preferredOutputDeviceId = prefs.outputDeviceId;
      if (prefs.inputDeviceId) {
        try {
          await room.switchActiveDevice('audioinput', prefs.inputDeviceId);
        } catch {
          // device may have been unplugged — fall back to default
        }
      }
      if (prefs.outputDeviceId) {
        try {
          await room.switchActiveDevice('audiooutput', prefs.outputDeviceId);
        } catch {
          // Safari / some Chromium builds reject sink switches
        }
      }

      await applyMicPipelineToRoom(room, {
        deviceId: prefs.inputDeviceId,
        micGain: prefs.micGain,
        noiseSuppression: prefs.noiseSuppression,
      });
      await applyPreferredOutputToAllRemote();
      setMuted(!room.localParticipant.isMicrophoneEnabled);
      setDeafened(false);
      setCameraOn(false);
      deafenedRef.current = false;
      setStatus('connected');
      refreshParticipants();
    } catch (err) {
      if (connectTimedOut) {
        return;
      }
      roomRef.current = null;
      await teardownRoom(room);
      setStatus('error');
      setError(voiceConnectErrorMessage(err));
    } finally {
      joiningRef.current = false;
    }
  }, [applyUrgent, clearUrgentTimers, conversationId, refreshParticipants, teardownRoom]);

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
        await applyMicPipelineToRoom(room, {
          deviceId: prefs.inputDeviceId,
          micGain: prefs.micGain,
          noiseSuppression: prefs.noiseSuppression,
        });
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
        setError('Не удалось включить микрофон — проверь разрешение браузера');
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
    setNativeRemoteAudioVolume(roomRef.current, next);
  }, [status]);

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
    const payload: UrgentPayload = {
      type: 'urgent_request',
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
    applyUrgent(identity, true);
  }, [applyUrgent, status]);

  useEffect(() => {
    return () => {
      intentionalLeaveRef.current = true;
      joiningRef.current = false;
      const room = roomRef.current;
      roomRef.current = null;
      void teardownRoom(room);
    };
  }, [teardownRoom]);

  const conversationIdRef = useRef(conversationId);
  useEffect(() => {
    const prev = conversationIdRef.current;
    if (prev === conversationId) {
      return;
    }
    conversationIdRef.current = conversationId;
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
    urgentUntilById,
    join,
    leave,
    toggleMute,
    toggleDeafen,
    toggleCamera,
    sendUrgentRequest,
  };
}
