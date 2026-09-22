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
import { applyAudioOutputToElement, stopMediaStream, takePrimedMicrophone } from '@/utils/voice-media-devices';
import { applyMicPipelineToRoom, isUsableMediaDeviceId } from '@/utils/voice-mic-pipeline';

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

type UseChatLiveVoiceResult = {
  status: ChatLiveVoiceStatus;
  error: string | null;
  muted: boolean;
  deafened: boolean;
  cameraOn: boolean;
  participants: ChatLiveVoiceParticipant[];
  /** identity → urgent flag (cleared only by sender toggle / leave) */
  urgentById: Record<string, boolean>;
  join: (conversationIdOverride?: string, options?: JoinLiveOptions) => Promise<void>;
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
    /not allowed by the user agent|notallowederror|permission denied|secure context|getusermedia/i.test(
      lower,
    )
  ) {
    return 'Браузер заблокировал микрофон. Разреши доступ сразу по нажатию «Позвонить» / «Ответить».';
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
  const [urgentById, setUrgentById] = useState<Record<string, boolean>>({});
  const urgentByIdRef = useRef<Record<string, boolean>>({});
  urgentByIdRef.current = urgentById;
  const lastUrgentSentAtRef = useRef(0);

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
        'Браузер не даёт доступ к микрофону. Открой чат на компьютере или попробуй позже.',
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
        stopMediaStream(primedMic);
        return;
      }

      room = new Room({
        adaptiveStream: true,
        dynacast: true,
        disconnectOnPageLeave: true,
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
      deafenedRef.current = false;
      setStatus('connected');
      if (!micOn) {
        setError(
          'Микрофон не включился. На iPhone нажми кнопку звонка ещё раз и сразу разреши доступ — браузер не даёт включить мик после долгого ожидания сети.',
        );
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
    } finally {
      joiningRef.current = false;
    }
  }, [conversationId, refreshParticipants, setUrgent, teardownRoom]);

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
        setError(
          'Микрофон не включился: соединение с сервером есть, а медиа-канал не поднялся. Проверь разрешение мика или сеть — иногда нужен VPN.',
        );
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
    urgentById,
    join,
    leave,
    toggleMute,
    toggleDeafen,
    toggleCamera,
    sendUrgentRequest,
  };
}
