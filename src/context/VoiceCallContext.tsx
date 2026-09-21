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
import {
  useChatLiveVoice,
  type ChatLiveVoiceParticipant,
  type ChatLiveVoiceStatus,
} from '@/hooks/use-chat-live-voice';
import {
  acceptChatVoiceCall,
  declineChatVoiceCall,
  endChatVoiceCall,
  inviteChatVoiceCall,
  joinChatVoiceCall,
  type VoiceCallPeer,
} from '@/services/chats/chatsApi';
import type { CallInvitePayload } from '@/services/realtime/socket';
import { startCallRingback, startCallRingtone, stopCallRingtone, playHangupSound } from '@/utils/call-ringtone';
import { localizeErrorMessage } from '@/utils/localizeError';

/** Discord-like: stop showing unanswered invitees after this. */
const RINGING_PEER_TIMEOUT_MS = 30_000;

export type VoiceCallPhase = 'idle' | 'outgoing' | 'incoming' | 'active' | 'error';

export type VoiceCallRingingPeer = {
  userId: string;
  nickname: string;
  avatarUrl: string | null;
};

type VoiceCallContextValue = {
  phase: VoiceCallPhase;
  callId: string | null;
  conversationId: string | null;
  peerName: string | null;
  peerAvatarUrl: string | null;
  isGroup: boolean;
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
    opts?: { isGroup?: boolean; ringingPeers?: VoiceCallRingingPeer[] },
  ) => Promise<void>;
  joinOngoingCall: (
    conversationId: string,
    callId: string,
    peerName?: string | null,
    peerAvatarUrl?: string | null,
    opts?: { isGroup?: boolean },
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
  ringingPeers: VoiceCallRingingPeer[];
  phase: Exclude<VoiceCallPhase, 'idle'>;
};

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

export function VoiceCallProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const { subscribeCallEvents } = useRealtime();
  const [session, setSession] = useState<Session | null>(null);
  const sessionRef = useRef<Session | null>(null);
  sessionRef.current = session;
  const [minimized, setMinimized] = useState(false);
  const ringingStartedAtRef = useRef<number | null>(null);
  const hadRemoteRef = useRef(false);

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
    urgentUntilById,
    join,
    leave,
    toggleMute,
    toggleDeafen,
    toggleCamera,
    sendUrgentRequest,
  } = useChatLiveVoice(liveConversationId);

  const clearSession = useCallback(async (opts?: { endRemote?: boolean; playHangup?: boolean }) => {
    if (opts?.playHangup) {
      stopCallRingtone();
      playHangupSound();
    } else {
      stopCallRingtone();
    }
    ringingStartedAtRef.current = null;
    hadRemoteRef.current = false;
    setMinimized(false);
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
  }, [leave]);

  const startCall = useCallback(
    async (
      conversationId: string,
      peerName?: string | null,
      peerAvatarUrl?: string | null,
      opts?: { isGroup?: boolean; ringingPeers?: VoiceCallRingingPeer[] },
    ) => {
      if (sessionRef.current) {
        toast.info('Сначала завершите текущий звонок');
        return;
      }
      try {
        const { callId, isGroup, ringing } = await inviteChatVoiceCall(conversationId);
        const ringingPeers =
          mapInviteRinging(ringing).length > 0
            ? mapInviteRinging(ringing)
            : mapInviteRinging(opts?.ringingPeers);
        const next: Session = {
          callId,
          conversationId,
          role: 'caller',
          peerName: peerName?.trim() || 'Собеседник',
          peerAvatarUrl: peerAvatarUrl ?? null,
          callerName: null,
          isGroup: opts?.isGroup ?? Boolean(isGroup),
          ringingPeers,
          phase: 'outgoing',
        };
        sessionRef.current = next;
        setSession(next);
        setMinimized(false);
        hadRemoteRef.current = false;
        ringingStartedAtRef.current = ringingPeers.length > 0 ? Date.now() : null;
        startCallRingback();
        await join(conversationId);
      } catch (error) {
        stopCallRingtone();
        await leave();
        sessionRef.current = null;
        setSession(null);
        toast.error(localizeErrorMessage(error, 'Не удалось начать звонок'));
      }
    },
    [join, leave],
  );

  const joinOngoingCall = useCallback(
    async (
      conversationId: string,
      callId: string,
      peerName?: string | null,
      peerAvatarUrl?: string | null,
      opts?: { isGroup?: boolean },
    ) => {
      if (sessionRef.current) {
        toast.info('Сначала завершите текущий звонок');
        return;
      }
      try {
        await joinChatVoiceCall(conversationId, callId);
        const next: Session = {
          callId,
          conversationId,
          role: 'callee',
          peerName: peerName?.trim() || 'Голосовой чат',
          peerAvatarUrl: peerAvatarUrl ?? null,
          callerName: null,
          isGroup: opts?.isGroup ?? true,
          ringingPeers: [],
          phase: 'active',
        };
        sessionRef.current = next;
        setSession(next);
        setMinimized(false);
        hadRemoteRef.current = false;
        ringingStartedAtRef.current = null;
        await join(conversationId);
      } catch (error) {
        await leave();
        sessionRef.current = null;
        setSession(null);
        toast.error(localizeErrorMessage(error, 'Не удалось войти в звонок'));
      }
    },
    [join, leave],
  );

  const hangup = useCallback(async () => {
    await clearSession({ endRemote: true, playHangup: true });
  }, [clearSession]);

  const acceptIncoming = useCallback(async () => {
    const current = sessionRef.current;
    if (!current || current.phase !== 'incoming') {
      return;
    }
    stopCallRingtone();
    const next: Session = { ...current, phase: 'active', ringingPeers: [] };
    sessionRef.current = next;
    setSession(next);
    setMinimized(false);
    hadRemoteRef.current = false;
    ringingStartedAtRef.current = null;
    try {
      await acceptChatVoiceCall(current.conversationId, current.callId);
      await join(current.conversationId);
    } catch (error) {
      await clearSession();
      toast.error(localizeErrorMessage(error, 'Не удалось принять звонок'));
    }
  }, [clearSession, join]);

  const declineIncoming = useCallback(async () => {
    const current = sessionRef.current;
    if (!current || current.phase !== 'incoming') {
      return;
    }
    stopCallRingtone();
    try {
      await declineChatVoiceCall(current.conversationId, current.callId);
    } catch {
      // ignore
    }
    await clearSession();
  }, [clearSession]);

  const retryLive = useCallback(async () => {
    const current = sessionRef.current;
    if (!current) {
      return;
    }
    await join(current.conversationId);
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

      if (event.type === 'invite') {
        const invite = event.payload as CallInvitePayload;
        if (invite.fromUserId === user?.id) {
          return;
        }
        if (current) {
          // Busy — soft-decline so the group call keeps ringing for others.
          void declineChatVoiceCall(invite.conversationId, invite.callId).catch(() => undefined);
          return;
        }
        const isGroup = Boolean(invite.isGroup);
        const next: Session = {
          callId: invite.callId,
          conversationId: invite.conversationId,
          role: 'callee',
          peerName:
            (isGroup ? invite.conversationTitle?.trim() : null) ||
            invite.fromNickname ||
            'Собеседник',
          peerAvatarUrl: invite.fromAvatarUrl,
          callerName: invite.fromNickname,
          isGroup,
          ringingPeers: [],
          phase: 'incoming',
        };
        sessionRef.current = next;
        setSession(next);
        setMinimized(false);
        ringingStartedAtRef.current = null;
        startCallRingtone();
        return;
      }

      if (!current || event.payload.callId !== current.callId) {
        return;
      }

      if (event.type === 'accepted') {
        const byUserId = event.payload.byUserId;
        const ringingPeers = dropRingingPeer(current.ringingPeers, byUserId);
        if (current.role === 'caller' && current.phase === 'outgoing') {
          stopCallRingtone();
          const next: Session = { ...current, phase: 'active', ringingPeers };
          sessionRef.current = next;
          setSession(next);
          return;
        }
        if (ringingPeers.length !== current.ringingPeers.length) {
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
        stopCallRingtone();
        if (current.phase === 'active' || current.phase === 'outgoing') {
          playHangupSound();
        }
        void leave();
        ringingStartedAtRef.current = null;
        setMinimized(false);
        sessionRef.current = null;
        setSession(null);
        if (wasOutgoing) {
          toast.info('Нет ответа');
        }
      }
    });
  }, [leave, subscribeCallEvents, user?.id]);

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
    const ringingChanged = ringingPeers.length !== current.ringingPeers.length;
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

  // Last remote left the LiveKit room — hang up so the server call actually ends.
  useEffect(() => {
    const current = sessionRef.current;
    if (!current || current.phase !== 'active' || liveStatus !== 'connected') {
      return;
    }
    const hasRemote = participants.some((p) => !p.isLocal);
    if (hasRemote) {
      hadRemoteRef.current = true;
      return;
    }
    if (!hadRemoteRef.current) {
      return;
    }
    const timer = setTimeout(() => {
      const latest = sessionRef.current;
      if (!latest || latest.callId !== current.callId || latest.phase !== 'active') {
        return;
      }
      void hangup();
    }, 1800);
    return () => clearTimeout(timer);
  }, [hangup, liveStatus, participants]);

  // Discord-like: after 30s unanswered invitees leave the overlay (pulse stops with them).
  useEffect(() => {
    const current = session;
    if (
      !current ||
      (current.phase !== 'outgoing' && current.phase !== 'active') ||
      current.ringingPeers.length === 0
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
      if (!latest || latest.ringingPeers.length === 0) {
        return;
      }
      stopCallRingtone();
      ringingStartedAtRef.current = null;
      const next: Session = {
        ...latest,
        ringingPeers: [],
        phase: latest.phase === 'outgoing' ? 'active' : latest.phase,
      };
      sessionRef.current = next;
      setSession(next);
    }, remaining);
    return () => clearTimeout(timer);
  }, [session?.callId, session?.phase, session?.ringingPeers.length]);

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
          urgentUntilById={urgentUntilById}
          onToggleMute={() => void toggleMute()}
          onToggleDeafen={() => void toggleDeafen()}
          onToggleCamera={() => void handleToggleCamera()}
          onHangup={() => void hangup()}
          onRetry={() => void retryLive()}
          onMinimize={minimize}
          onExpand={expand}
          onUrgentRequest={() => void sendUrgentRequest()}
          conversationId={session?.conversationId ?? null}
          diceSenderNickname={user?.nickname ?? 'Вы'}
        />
        {children}
        <IncomingCallModal
          visible={session?.phase === 'incoming'}
          callerName={session?.peerName ?? ''}
          callerAvatarUrl={session?.peerAvatarUrl ?? null}
          subtitle={
            session?.isGroup && session.callerName
              ? `${session.callerName} звонит в группу`
              : session?.isGroup
                ? 'Групповой звонок'
                : undefined
          }
          onAccept={() => void acceptIncoming()}
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
