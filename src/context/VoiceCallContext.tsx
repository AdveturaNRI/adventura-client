import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { StyleSheet, View, Platform } from 'react-native';

import { IncomingCallModal } from '@/components/chats/IncomingCallModal';
import { VoiceCallOverlay } from '@/components/chats/VoiceCallOverlay';
import { toast } from '@/components/ui';
import { useAuth } from '@/context/AuthContext';
import { useRealtime } from '@/context/RealtimeContext';
import { setVoiceCallOwnsDice } from '@/context/voice-call-dice-gate';
import {
  useChatLiveVoice,
  type ChatLiveVoiceParticipant,
  type ChatLiveVoiceStatus,
} from '@/hooks/use-chat-live-voice';
import { useCallSharedMusic } from '@/hooks/use-call-shared-music';
import {
  acceptChatVoiceCall,
  declineChatVoiceCall,
  endChatVoiceCall,
  inviteChatVoiceCall,
  joinChatVoiceCall,
  listChatMembers,
  type VoiceCallPeer,
} from '@/services/chats/chatsApi';
import type { CallInvitePayload } from '@/services/realtime/socket';
import { startCallRingback, startCallRingtone, stopCallRingtone, playHangupSound } from '@/utils/call-ringtone';
import { localizeErrorMessage } from '@/utils/localizeError';
import {
  beginMicrophonePrimeFromGesture,
  discardPrimedMicrophone,
  stopMediaStream,
  takePrimedMicrophone,
} from '@/utils/voice-media-devices';

/** Discord-like: stop showing unanswered invitees after this. */
const RINGING_PEER_TIMEOUT_MS = 30_000;

export type VoiceCallPhase = 'idle' | 'outgoing' | 'incoming' | 'active' | 'error';

export type VoiceCallRingingPeer = {
  userId: string;
  nickname: string;
  avatarUrl: string | null;
  /** Accepted / joining LiveKit — keep the tile with a loader. */
  connecting?: boolean;
};

export type VoiceCallGroupRole = 'owner' | 'admin' | 'member';

type VoiceCallContextValue = {
  phase: VoiceCallPhase;
  callId: string | null;
  conversationId: string | null;
  peerName: string | null;
  peerAvatarUrl: string | null;
  isGroup: boolean;
  myRole: VoiceCallGroupRole | null;
  minimized: boolean;
  liveStatus: ChatLiveVoiceStatus;
  liveError: string | null;
  muted: boolean;
  deafened: boolean;
  cameraOn: boolean;
  participants: ChatLiveVoiceParticipant[];
  startCall: (
    conversationId: string,
    peerName?: string | null,
    peerAvatarUrl?: string | null,
    opts?: {
      isGroup?: boolean;
      ringingPeers?: VoiceCallRingingPeer[];
      myRole?: VoiceCallGroupRole | null;
    },
  ) => Promise<void>;
  joinOngoingCall: (
    conversationId: string,
    callId: string,
    peerName?: string | null,
    peerAvatarUrl?: string | null,
    opts?: { isGroup?: boolean; myRole?: VoiceCallGroupRole | null },
  ) => Promise<void>;
  hangup: () => Promise<void>;
  toggleMute: () => Promise<void>;
  toggleDeafen: () => Promise<void>;
  toggleCamera: () => Promise<void>;
  retryLive: () => Promise<void>;
  minimize: () => void;
  expand: () => void;
  sendUrgentRequest: () => Promise<void>;
};

const VoiceCallContext = createContext<VoiceCallContextValue | null>(null);

type Session = {
  callId: string;
  conversationId: string;
  role: 'caller' | 'callee';
  peerName: string;
  peerAvatarUrl: string | null;
  callerName: string | null;
  isGroup: boolean;
  myRole: VoiceCallGroupRole | null;
  ringingPeers: VoiceCallRingingPeer[];
  phase: Exclude<VoiceCallPhase, 'idle'>;
};

/** Incoming invite while already in another call — shown without replacing the session. */
type PendingInvite = {
  callId: string;
  conversationId: string;
  peerName: string;
  peerAvatarUrl: string | null;
  callerName: string | null;
  isGroup: boolean;
  myRole: VoiceCallGroupRole | null;
};

function inviteFromPayload(invite: CallInvitePayload): PendingInvite {
  const isGroup = Boolean(invite.isGroup);
  return {
    callId: invite.callId,
    conversationId: invite.conversationId,
    peerName:
      (isGroup ? invite.conversationTitle?.trim() : null) ||
      invite.fromNickname ||
      'Собеседник',
    peerAvatarUrl: invite.fromAvatarUrl,
    callerName: invite.fromNickname,
    isGroup,
    myRole: null,
  };
}

function mapInviteRinging(peers?: VoiceCallPeer[] | VoiceCallRingingPeer[]): VoiceCallRingingPeer[] {
  if (!peers?.length) {
    return [];
  }
  return peers.map((peer) => ({
    userId: peer.userId,
    nickname: peer.nickname,
    avatarUrl: peer.avatarUrl ?? null,
  }));
}

function dropRingingPeer(peers: VoiceCallRingingPeer[], userId: string) {
  return peers.filter((peer) => peer.userId !== userId);
}

async function resolveGroupRole(
  conversationId: string,
  userId: string | undefined,
): Promise<VoiceCallGroupRole> {
  if (!userId) {
    return 'member';
  }
  try {
    const members = await listChatMembers(conversationId);
    const mine = members.find((member) => member.id === userId);
    if (mine?.role === 'owner' || mine?.role === 'admin' || mine?.role === 'member') {
      return mine.role;
    }
  } catch {
    // keep conservative default
  }
  return 'member';
}

export function VoiceCallProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const { subscribeCallEvents } = useRealtime();
  const [session, setSession] = useState<Session | null>(null);
  const sessionRef = useRef<Session | null>(null);
  sessionRef.current = session;
  const [pendingInvite, setPendingInvite] = useState<PendingInvite | null>(null);
  const pendingInviteRef = useRef<PendingInvite | null>(null);
  pendingInviteRef.current = pendingInvite;
  const [minimized, setMinimized] = useState(false);
  const ringingStartedAtRef = useRef<number | null>(null);
  const switchingCallRef = useRef(false);

  // Drop any leftover gesture-primed mic from a previous session / cancelled tap.
  useEffect(() => {
    discardPrimedMicrophone();
    return () => {
      discardPrimedMicrophone();
    };
  }, []);

  const liveConversationId =
    session && (session.phase === 'outgoing' || session.phase === 'active')
      ? session.conversationId
      : null;

  const {
    status: liveStatus,
    error: liveError,
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
  } = useChatLiveVoice(liveConversationId);

  const canControlMusic =
    !session?.isGroup || session.myRole === 'owner' || session.myRole === 'admin';

  const musicEnabled =
    session?.phase === 'outgoing' || session?.phase === 'active';

  const sharedMusic = useCallSharedMusic({
    enabled: musicEnabled,
    liveStatus,
    canControl: canControlMusic,
    localDisplayName: user?.nickname?.trim() || 'Участник',
    deafened,
    publishRoomData,
    subscribeRoomData,
  });

  const clearPendingInvite = useCallback(() => {
    pendingInviteRef.current = null;
    setPendingInvite(null);
  }, []);

  const clearSession = useCallback(async (opts?: { endRemote?: boolean; playHangup?: boolean }) => {
    if (opts?.playHangup) {
      stopCallRingtone();
      playHangupSound();
    } else {
      stopCallRingtone();
    }
    ringingStartedAtRef.current = null;
    setMinimized(false);

    const parked = !switchingCallRef.current ? pendingInviteRef.current : null;
    if (!switchingCallRef.current) {
      clearPendingInvite();
    }

    const current = sessionRef.current;
    sessionRef.current = null;
    setSession(null);

    // End on server first — leave() must not block / skip hangup for solo cancels.
    if (opts?.endRemote && current) {
      try {
        await endChatVoiceCall(current.conversationId, current.callId);
      } catch {
        // already gone on server
      }
    }

    try {
      await leave();
    } catch {
      // LiveKit may already be down
    }

    // After leaving the current call, promote a parked invite into a normal incoming UI.
    if (parked) {
      const next: Session = {
        callId: parked.callId,
        conversationId: parked.conversationId,
        role: 'callee',
        peerName: parked.peerName,
        peerAvatarUrl: parked.peerAvatarUrl,
        callerName: parked.callerName,
        isGroup: parked.isGroup,
        myRole: parked.myRole,
        ringingPeers: [],
        phase: 'incoming',
      };
      sessionRef.current = next;
      setSession(next);
      startCallRingtone();
    }
  }, [clearPendingInvite, leave]);

  const enterCallFromInvite = useCallback(
    async (invite: PendingInvite) => {
      // Prefer stream started in onPressIn; fall back to getUserMedia now.
      const primedMic = await takePrimedMicrophone();
      let myRole = invite.myRole;
      if (invite.isGroup && !myRole) {
        myRole = await resolveGroupRole(invite.conversationId, user?.id);
      }
      const next: Session = {
        callId: invite.callId,
        conversationId: invite.conversationId,
        role: 'callee',
        peerName: invite.peerName,
        peerAvatarUrl: invite.peerAvatarUrl,
        callerName: invite.callerName,
        isGroup: invite.isGroup,
        myRole: invite.isGroup ? myRole ?? 'member' : null,
        ringingPeers: [],
        phase: 'active',
      };
      sessionRef.current = next;
      setSession(next);
      setMinimized(false);
      ringingStartedAtRef.current = null;
      try {
        await acceptChatVoiceCall(invite.conversationId, invite.callId);
        await join(invite.conversationId, { primedMic });
      } catch (error) {
        stopMediaStream(primedMic);
        await clearSession();
        toast.error(localizeErrorMessage(error, 'Не удалось принять звонок'));
      }
    },
    [clearSession, join, user?.id],
  );

  const startCall = useCallback(
    async (
      conversationId: string,
      peerName?: string | null,
      peerAvatarUrl?: string | null,
      opts?: {
        isGroup?: boolean;
        ringingPeers?: VoiceCallRingingPeer[];
        myRole?: VoiceCallGroupRole | null;
      },
    ) => {
      if (sessionRef.current) {
        toast.info('Сначала завершите текущий звонок');
        return;
      }
      const primedMic = await takePrimedMicrophone();
      try {
        const { callId, isGroup, ringing } = await inviteChatVoiceCall(conversationId);
        const ringingPeers =
          mapInviteRinging(ringing).length > 0
            ? mapInviteRinging(ringing)
            : mapInviteRinging(opts?.ringingPeers);
        const group = opts?.isGroup ?? Boolean(isGroup);
        let myRole: VoiceCallGroupRole | null = group ? opts?.myRole ?? null : null;
        if (group && !myRole) {
          myRole = await resolveGroupRole(conversationId, user?.id);
        }
        const next: Session = {
          callId,
          conversationId,
          role: 'caller',
          peerName: peerName?.trim() || 'Собеседник',
          peerAvatarUrl: peerAvatarUrl ?? null,
          callerName: null,
          isGroup: group,
          myRole: group ? myRole ?? 'member' : null,
          ringingPeers,
          phase: 'outgoing',
        };
        sessionRef.current = next;
        setSession(next);
        setMinimized(false);
        ringingStartedAtRef.current = ringingPeers.length > 0 ? Date.now() : null;
        startCallRingback();
        await join(conversationId, { primedMic });
      } catch (error) {
        stopMediaStream(primedMic);
        stopCallRingtone();
        await leave();
        sessionRef.current = null;
        setSession(null);
        toast.error(localizeErrorMessage(error, 'Не удалось начать звонок'));
      }
    },
    [join, leave, user?.id],
  );

  const joinOngoingCall = useCallback(
    async (
      conversationId: string,
      callId: string,
      peerName?: string | null,
      peerAvatarUrl?: string | null,
      opts?: { isGroup?: boolean; myRole?: VoiceCallGroupRole | null },
    ) => {
      if (sessionRef.current) {
        toast.info('Сначала завершите текущий звонок');
        return;
      }
      const primedMic = await takePrimedMicrophone();
      try {
        await joinChatVoiceCall(conversationId, callId);
        const group = opts?.isGroup ?? true;
        let myRole: VoiceCallGroupRole | null = group ? opts?.myRole ?? null : null;
        if (group && !myRole) {
          myRole = await resolveGroupRole(conversationId, user?.id);
        }
        const next: Session = {
          callId,
          conversationId,
          role: 'callee',
          peerName: peerName?.trim() || 'Голосовой чат',
          peerAvatarUrl: peerAvatarUrl ?? null,
          callerName: null,
          isGroup: group,
          myRole: group ? myRole ?? 'member' : null,
          ringingPeers: [],
          phase: 'active',
        };
        sessionRef.current = next;
        setSession(next);
        setMinimized(false);
        ringingStartedAtRef.current = null;
        await join(conversationId, { primedMic });
      } catch (error) {
        stopMediaStream(primedMic);
        await leave();
        sessionRef.current = null;
        setSession(null);
        toast.error(localizeErrorMessage(error, 'Не удалось войти в звонок'));
      }
    },
    [join, leave, user?.id],
  );

  const hangup = useCallback(async () => {
    await clearSession({ endRemote: true, playHangup: true });
  }, [clearSession]);

  const acceptIncoming = useCallback(async () => {
    const parked = pendingInviteRef.current;
    const current = sessionRef.current;

    // Already in another call — leave it, then join the parked invite.
    if (parked && current && current.phase !== 'incoming') {
      stopCallRingtone();
      clearPendingInvite();
      switchingCallRef.current = true;
      try {
        await clearSession({ endRemote: true, playHangup: true });
        await enterCallFromInvite(parked);
      } finally {
        switchingCallRef.current = false;
      }
      return;
    }

    if (!current || current.phase !== 'incoming') {
      return;
    }
    stopCallRingtone();
    clearPendingInvite();
    const invite: PendingInvite = {
      callId: current.callId,
      conversationId: current.conversationId,
      peerName: current.peerName,
      peerAvatarUrl: current.peerAvatarUrl,
      callerName: current.callerName,
      isGroup: current.isGroup,
      myRole: current.myRole,
    };
    await enterCallFromInvite(invite);
  }, [clearPendingInvite, clearSession, enterCallFromInvite]);

  const declineIncoming = useCallback(async () => {
    discardPrimedMicrophone();
    const parked = pendingInviteRef.current;
    const current = sessionRef.current;

    // Decline only the parked invite — keep the active call.
    if (parked && current && current.phase !== 'incoming') {
      stopCallRingtone();
      clearPendingInvite();
      try {
        await declineChatVoiceCall(parked.conversationId, parked.callId);
      } catch {
        // ignore
      }
      return;
    }

    if (!current || current.phase !== 'incoming') {
      return;
    }
    stopCallRingtone();
    clearPendingInvite();
    try {
      await declineChatVoiceCall(current.conversationId, current.callId);
    } catch {
      // ignore
    }
    await clearSession();
  }, [clearPendingInvite, clearSession]);

  const retryLive = useCallback(async () => {
    const current = sessionRef.current;
    if (!current) {
      return;
    }
    const primedMic = await takePrimedMicrophone();
    try {
      await join(current.conversationId, { primedMic });
    } catch (error) {
      stopMediaStream(primedMic);
      toast.error(localizeErrorMessage(error, 'Не удалось переподключиться'));
    }
  }, [join]);

  const handleToggleCamera = useCallback(async () => {
    try {
      await toggleCamera();
    } catch (error) {
      toast.error(localizeErrorMessage(error, 'Не удалось включить камеру'));
    }
  }, [toggleCamera]);

  useEffect(() => {
    return subscribeCallEvents((event) => {
      const current = sessionRef.current;
      const parked = pendingInviteRef.current;

      if (event.type === 'invite') {
        const invite = event.payload as CallInvitePayload;
        if (invite.fromUserId === user?.id) {
          return;
        }

        // Already showing this invite.
        if (
          (current?.phase === 'incoming' && current.callId === invite.callId) ||
          parked?.callId === invite.callId
        ) {
          return;
        }

        const nextInvite = inviteFromPayload(invite);

        // In another call — park the invite as a notification, do not soft-decline.
        if (current && (current.phase === 'outgoing' || current.phase === 'active')) {
          // Replace a previous parked invite so we don't stack modals.
          if (parked && parked.callId !== invite.callId) {
            void declineChatVoiceCall(parked.conversationId, parked.callId).catch(() => undefined);
          }
          pendingInviteRef.current = nextInvite;
          setPendingInvite(nextInvite);
          startCallRingtone();
          return;
        }

        // Already ringing for someone else — keep that UI, soft-decline the new one.
        if (current?.phase === 'incoming') {
          void declineChatVoiceCall(invite.conversationId, invite.callId).catch(() => undefined);
          return;
        }

        const next: Session = {
          callId: nextInvite.callId,
          conversationId: nextInvite.conversationId,
          role: 'callee',
          peerName: nextInvite.peerName,
          peerAvatarUrl: nextInvite.peerAvatarUrl,
          callerName: nextInvite.callerName,
          isGroup: nextInvite.isGroup,
          myRole: nextInvite.myRole,
          ringingPeers: [],
          phase: 'incoming',
        };
        sessionRef.current = next;
        setSession(next);
        setMinimized(false);
        ringingStartedAtRef.current = null;
        clearPendingInvite();
        startCallRingtone();
        return;
      }

      // Parked invite's call ended — dismiss notification, keep current call.
      if (parked && event.type === 'ended' && event.payload.callId === parked.callId) {
        clearPendingInvite();
        stopCallRingtone();
        if (current?.phase === 'outgoing') {
          startCallRingback();
        }
        return;
      }

      // Answered / declined on another device of this account — stop local ring.
      const answeredElsewhere =
        (event.type === 'accepted' || event.type === 'declined') &&
        Boolean(user?.id) &&
        event.payload.byUserId === user?.id;
      if (answeredElsewhere) {
        if (parked && parked.callId === event.payload.callId) {
          clearPendingInvite();
          stopCallRingtone();
          if (current?.phase === 'outgoing') {
            startCallRingback();
          }
          return;
        }
        if (current?.phase === 'incoming' && current.callId === event.payload.callId) {
          stopCallRingtone();
          clearPendingInvite();
          ringingStartedAtRef.current = null;
          setMinimized(false);
          sessionRef.current = null;
          setSession(null);
          return;
        }
      }

      if (!current || event.payload.callId !== current.callId) {
        return;
      }

      if (event.type === 'accepted') {
        const byUserId = event.payload.byUserId;
        let found = false;
        const ringingPeers = current.ringingPeers.map((peer) => {
          if (peer.userId !== byUserId) {
            return peer;
          }
          found = true;
          return { ...peer, connecting: true };
        });
        if (!found && byUserId !== user?.id) {
          ringingPeers.push({
            userId: byUserId,
            nickname: 'Участник',
            avatarUrl: null,
            connecting: true,
          });
        }
        if (current.role === 'caller' && current.phase === 'outgoing') {
          stopCallRingtone();
          const next: Session = { ...current, phase: 'active', ringingPeers };
          sessionRef.current = next;
          setSession(next);
          return;
        }
        if (
          found ||
          ringingPeers.length !== current.ringingPeers.length ||
          ringingPeers.some((peer, i) => peer.connecting !== current.ringingPeers[i]?.connecting)
        ) {
          const next: Session = { ...current, ringingPeers };
          sessionRef.current = next;
          setSession(next);
        }
        return;
      }

      if (event.type === 'declined') {
        // Soft decline / ring timeout — drop that waiting tile, keep the call.
        const ringingPeers = dropRingingPeer(current.ringingPeers, event.payload.byUserId);
        if (ringingPeers.length !== current.ringingPeers.length) {
          const next: Session = { ...current, ringingPeers };
          sessionRef.current = next;
          setSession(next);
          // Ring phase over for everyone — stop гудки, stay in lobby.
          if (
            ringingPeers.length === 0 &&
            current.role === 'caller' &&
            (current.phase === 'outgoing' || current.phase === 'active')
          ) {
            stopCallRingtone();
          }
        }
        return;
      }

      if (event.type === 'ended') {
        const wasOutgoing = current.role === 'caller' && current.phase === 'outgoing';
        // Switching to another call — ignore end of the call we just left.
        if (switchingCallRef.current) {
          return;
        }
        stopCallRingtone();
        if (current.phase === 'active' || current.phase === 'outgoing') {
          playHangupSound();
        }
        void leave();
        ringingStartedAtRef.current = null;
        setMinimized(false);
        sessionRef.current = null;
        setSession(null);

        const nextParked = pendingInviteRef.current;
        if (nextParked) {
          clearPendingInvite();
          const next: Session = {
            callId: nextParked.callId,
            conversationId: nextParked.conversationId,
            role: 'callee',
            peerName: nextParked.peerName,
            peerAvatarUrl: nextParked.peerAvatarUrl,
            callerName: nextParked.callerName,
            isGroup: nextParked.isGroup,
            myRole: nextParked.myRole,
            ringingPeers: [],
            phase: 'incoming',
          };
          sessionRef.current = next;
          setSession(next);
          startCallRingtone();
        } else if (wasOutgoing) {
          toast.info('Нет ответа');
        }
      }
    });
  }, [clearPendingInvite, leave, subscribeCallEvents, user?.id]);

  useEffect(() => {
    return () => {
      stopCallRingtone();
    };
  }, []);

  // Drop waiting tiles once people actually join LiveKit; go active on first remote.
  useEffect(() => {
    const current = sessionRef.current;
    if (!current || (current.phase !== 'outgoing' && current.phase !== 'active')) {
      return;
    }
    const liveIds = new Set(participants.map((p) => p.identity));
    const ringingPeers = current.ringingPeers.filter((peer) => !liveIds.has(peer.userId));
    const hasRemote = participants.some((p) => !p.isLocal);
    const phaseChanged = current.phase === 'outgoing' && hasRemote;
    const ringingChanged =
      ringingPeers.length !== current.ringingPeers.length ||
      ringingPeers.some(
        (peer, i) =>
          peer.userId !== current.ringingPeers[i]?.userId ||
          peer.connecting !== current.ringingPeers[i]?.connecting,
      );
    if (!phaseChanged && !ringingChanged) {
      return;
    }
    if (phaseChanged) {
      stopCallRingtone();
    }
    if (ringingPeers.length === 0) {
      ringingStartedAtRef.current = null;
    }
    const next: Session = {
      ...current,
      ringingPeers,
      phase: phaseChanged ? 'active' : current.phase,
    };
    sessionRef.current = next;
    setSession(next);
  }, [participants]);

  // Solo lobby stays up — server ends the call after the wait/abandon timer (5 min).

  // Discord-like: after 30s unanswered invitees leave the overlay (pulse stops with them).
  // Connecting peers (accepted, joining LiveKit) stay until they appear in the room.
  useEffect(() => {
    const current = session;
    const unanswered = (current?.ringingPeers ?? []).filter((peer) => !peer.connecting);
    if (
      !current ||
      (current.phase !== 'outgoing' && current.phase !== 'active') ||
      unanswered.length === 0
    ) {
      return;
    }
    if (ringingStartedAtRef.current == null) {
      ringingStartedAtRef.current = Date.now();
    }
    const startedAt = ringingStartedAtRef.current;
    const remaining = Math.max(0, RINGING_PEER_TIMEOUT_MS - (Date.now() - startedAt));
    const timer = setTimeout(() => {
      const latest = sessionRef.current;
      if (!latest) {
        return;
      }
      const nextPeers = latest.ringingPeers.filter((peer) => peer.connecting);
      if (nextPeers.length === latest.ringingPeers.length) {
        return;
      }
      stopCallRingtone();
      if (nextPeers.length === 0) {
        ringingStartedAtRef.current = null;
      }
      const next: Session = {
        ...latest,
        ringingPeers: nextPeers,
        phase: latest.phase === 'outgoing' ? 'active' : latest.phase,
      };
      sessionRef.current = next;
      setSession(next);
    }, remaining);
    return () => clearTimeout(timer);
  }, [session?.callId, session?.phase, session?.ringingPeers]);

  const minimize = useCallback(() => {
    if (!sessionRef.current) {
      return;
    }
    setMinimized(true);
  }, []);

  const expand = useCallback(() => {
    setMinimized(false);
  }, []);

  // Web call hotkeys: Ctrl/Cmd+Shift+M mute, Ctrl/Cmd+Shift+D deafen, Esc minimize.
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') {
      return;
    }
    const inCall =
      session?.phase === 'outgoing' ||
      session?.phase === 'active' ||
      liveStatus === 'connected' ||
      liveStatus === 'error';
    if (!inCall) {
      return;
    }

    const isTypingTarget = (target: EventTarget | null) => {
      if (!(target instanceof HTMLElement)) {
        return false;
      }
      const tag = target.tagName.toLowerCase();
      return tag === 'input' || tag === 'textarea' || tag === 'select' || target.isContentEditable;
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (isTypingTarget(event.target)) {
        return;
      }

      if (event.key === 'Escape') {
        if (!minimized && sessionRef.current) {
          event.preventDefault();
          minimize();
        }
        return;
      }

      const key = event.key.toLowerCase();
      const mod = event.metaKey || event.ctrlKey;
      if (!mod || !event.shiftKey) {
        return;
      }

      if (key === 'm') {
        event.preventDefault();
        void toggleMute();
        return;
      }
      if (key === 'd') {
        event.preventDefault();
        void toggleDeafen();
        return;
      }
      if (key === 'v') {
        event.preventDefault();
        void handleToggleCamera();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [handleToggleCamera, liveStatus, minimize, minimized, session?.phase, toggleDeafen, toggleMute]);

  const phase: VoiceCallPhase = session?.phase ?? (liveStatus === 'error' ? 'error' : 'idle');

  const waitingPeers = useMemo(
    () =>
      (session?.ringingPeers ?? []).map((peer) => ({
        id: peer.userId,
        name: peer.nickname,
        avatarUrl: peer.avatarUrl,
        connecting: Boolean(peer.connecting),
      })),
    [session?.ringingPeers],
  );

  const value = useMemo<VoiceCallContextValue>(
    () => ({
      phase,
      callId: session?.callId ?? null,
      conversationId: session?.conversationId ?? null,
      peerName: session?.peerName ?? null,
      peerAvatarUrl: session?.peerAvatarUrl ?? null,
      isGroup: session?.isGroup ?? false,
      myRole: session?.myRole ?? null,
      minimized,
      liveStatus,
      liveError,
      muted,
      deafened,
      cameraOn,
      participants,
      startCall,
      joinOngoingCall,
      hangup,
      toggleMute,
      toggleDeafen,
      toggleCamera: handleToggleCamera,
      retryLive,
      minimize,
      expand,
      sendUrgentRequest,
    }),
    [
      phase,
      session?.callId,
      session?.conversationId,
      session?.peerName,
      session?.peerAvatarUrl,
      session?.isGroup,
      session?.myRole,
      minimized,
      liveStatus,
      liveError,
      muted,
      deafened,
      cameraOn,
      participants,
      startCall,
      joinOngoingCall,
      hangup,
      toggleMute,
      toggleDeafen,
      handleToggleCamera,
      retryLive,
      minimize,
      expand,
      sendUrgentRequest,
    ],
  );

  const overlayVisible =
    session?.phase === 'outgoing' ||
    session?.phase === 'active' ||
    (session != null && liveStatus === 'error');

  useEffect(() => {
    setVoiceCallOwnsDice(Boolean(overlayVisible));
    return () => setVoiceCallOwnsDice(false);
  }, [overlayVisible]);

  const overlayTitle = session?.isGroup
    ? session.peerName
      ? `Группа · ${session.peerName}`
      : 'Групповой звонок'
    : session?.peerName
      ? `Звонок · ${session.peerName}`
      : 'Голосовой чат';

  return (
    <VoiceCallContext.Provider value={value}>
      <View style={providerStyles.root}>
        <VoiceCallOverlay
          visible={Boolean(overlayVisible)}
          minimized={minimized}
          title={overlayTitle}
          isGroup={Boolean(session?.isGroup)}
          status={liveStatus}
          ringing={session?.phase === 'outgoing'}
          error={liveError}
          muted={muted}
          deafened={deafened}
          cameraOn={cameraOn}
          participants={participants}
          waitingPeers={waitingPeers}
          urgentById={urgentById}
          volumeById={volumeById}
          onToggleMute={() => void toggleMute()}
          onMicGesture={() => beginMicrophonePrimeFromGesture()}
          onToggleDeafen={() => void toggleDeafen()}
          onToggleCamera={() => void handleToggleCamera()}
          onHangup={() => void hangup()}
          onRetry={() => void retryLive()}
          onMinimize={minimize}
          onExpand={expand}
          onUrgentRequest={() => void sendUrgentRequest()}
          onSetParticipantVolume={setParticipantVolume}
          conversationId={session?.conversationId ?? null}
          diceSenderNickname={user?.nickname ?? 'Вы'}
          canControlMusic={canControlMusic}
          bardPresent={sharedMusic.snapshot.bardPresent}
          bardTrackTitle={sharedMusic.snapshot.trackTitle}
          bardPlaying={sharedMusic.snapshot.playing}
          bardTrackId={sharedMusic.snapshot.trackId}
          bardCurrentEntryId={sharedMusic.snapshot.currentEntryId}
          bardQueue={sharedMusic.snapshot.queue}
          bardPositionSec={sharedMusic.livePositionSec}
          bardDurationSec={sharedMusic.durationSec}
          bardLocalVolume={sharedMusic.localVolume}
          bardGlobalVolume={sharedMusic.snapshot.globalVolume}
          bardLocalDisplayName={sharedMusic.localDisplayName}
          onSummonBard={() => void sharedMusic.summonBard()}
          onDismissBard={() => void sharedMusic.dismissBard()}
          onSetBardLocalVolume={sharedMusic.setLocalVolume}
          onEnqueueBardTrack={(trackId, title, durationSec) =>
            void sharedMusic.enqueueTrack(trackId, title, durationSec)
          }
          onPlayBardQueueEntry={(entryId) => void sharedMusic.playQueueEntry(entryId)}
          onRemoveBardQueueEntry={(entryId) => void sharedMusic.removeQueueEntry(entryId)}
          onToggleBardPlay={() => void sharedMusic.togglePlay()}
          onSeekBard={(positionSec) => void sharedMusic.seek(positionSec)}
          onStopBardTrack={() => void sharedMusic.stopTrack()}
          onSetBardGlobalVolume={(volume) => void sharedMusic.setGlobalVolume(volume)}
          onRequestBardSync={() => sharedMusic.requestSync()}
        />
        {children}
        <IncomingCallModal
          visible={Boolean(pendingInvite) || session?.phase === 'incoming'}
          callerName={(pendingInvite ?? session)?.peerName ?? ''}
          callerAvatarUrl={(pendingInvite ?? session)?.peerAvatarUrl ?? null}
          subtitle={(() => {
            const invite = pendingInvite ?? (session?.phase === 'incoming' ? session : null);
            if (!invite) {
              return undefined;
            }
            const switching =
              Boolean(pendingInvite) &&
              (session?.phase === 'outgoing' || session?.phase === 'active');
            if (switching) {
              return invite.isGroup && invite.callerName
                ? `${invite.callerName} · принять — выйти из текущего`
                : 'Принять — выйти из текущего звонка';
            }
            if (invite.isGroup && invite.callerName) {
              return `${invite.callerName} звонит в группу`;
            }
            if (invite.isGroup) {
              return 'Групповой звонок';
            }
            return undefined;
          })()}
          onAccept={() => void acceptIncoming()}
          onAcceptPressIn={() => beginMicrophonePrimeFromGesture()}
          onDecline={() => void declineIncoming()}
        />
      </View>
    </VoiceCallContext.Provider>
  );
}

const providerStyles = StyleSheet.create({
  root: {
    flex: 1,
  },
});

export function useVoiceCall() {
  const value = useContext(VoiceCallContext);
  if (!value) {
    throw new Error('useVoiceCall must be used within VoiceCallProvider');
  }
  return value;
}
