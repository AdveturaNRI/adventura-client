import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { AppState, Platform } from 'react-native';

import { useAuth } from '@/context/AuthContext';
import type { ChatMessage, ChatReactionEvent, ConversationListItem } from '@/services/chats/chatsApi';
import { appendCachedThreadMessage } from '@/utils/chat-thread-cache';
import { getNotificationsUnreadCount, type PortalNotification } from '@/services/notifications/notificationsApi';
import {
  bindRealtimeHandlers,
  connectRealtime,
  disconnectRealtime,
  ensureRealtimeConnected,
  getRealtimeSocket,
  updateRealtimeAuthToken,
  type CallRealtimeEvent,
  type ConversationDeletedPayload,
  type ConversationReadPayload,
  type PresenceUpdatePayload,
  type UnreadSyncPayload,
} from '@/services/realtime/socket';
import {
  notifyIncomingChatMessage,
  notifyIncomingPortalNotification,
  stopNewMessageTitleBlink,
  unlockChatAlerts,
} from '@/utils/chat-alerts';
import { hydrateNotificationSoundSettingsFromProfile } from '@/utils/notification-sound-settings';

type RealtimeContextValue = {
  unreadChats: number;
  unreadNotifications: number;
  /** Bumps when the app returns to foreground / socket reconnects — catch up via HTTP. */
  dataResyncAt: number;
  lastMessage: ChatMessage | null;
  lastMessageReaction: ChatReactionEvent | null;
  lastReactionUnread: { conversationId: string; count: number } | null;
  lastConversationUpdate: ConversationListItem | null;
  lastConversationRead: ConversationReadPayload | null;
  lastConversationDeleted: ConversationDeletedPayload | null;
  lastPresence: PresenceUpdatePayload | null;
  lastNotification: PortalNotification | null;
  setUnreadChats: (value: number) => void;
  setUnreadNotifications: (value: number) => void;
  publishConversationUpdate: (conversation: ConversationListItem) => void;
  subscribeMessages: (listener: (message: ChatMessage) => void) => () => void;
  subscribeMessageReactions: (listener: (event: ChatReactionEvent) => void) => () => void;
  subscribeCallEvents: (listener: (event: CallRealtimeEvent) => void) => () => void;
};

const RealtimeContext = createContext<RealtimeContextValue | null>(null);

export function RealtimeProvider({ children }: { children: ReactNode }) {
  const { token, isAuthenticated, isLoading, user } = useAuth();
  const [unreadChats, setUnreadChats] = useState(0);
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const [dataResyncAt, setDataResyncAt] = useState(0);
  const [lastMessage, setLastMessage] = useState<ChatMessage | null>(null);
  const [lastMessageReaction, setLastMessageReaction] = useState<ChatReactionEvent | null>(null);
  const [lastReactionUnread, setLastReactionUnread] = useState<{
    conversationId: string;
    count: number;
  } | null>(null);
  const [lastConversationUpdate, setLastConversationUpdate] = useState<ConversationListItem | null>(null);
  const [lastConversationRead, setLastConversationRead] = useState<ConversationReadPayload | null>(null);
  const [lastConversationDeleted, setLastConversationDeleted] = useState<ConversationDeletedPayload | null>(null);
  const [lastPresence, setLastPresence] = useState<PresenceUpdatePayload | null>(null);
  const [lastNotification, setLastNotification] = useState<PortalNotification | null>(null);
  const messageListenersRef = useRef(new Set<(message: ChatMessage) => void>());
  const reactionListenersRef = useRef(new Set<(event: ChatReactionEvent) => void>());
  const callListenersRef = useRef(new Set<(event: CallRealtimeEvent) => void>());
  const userIdRef = useRef(user?.id);

  userIdRef.current = user?.id;

  const subscribeMessages = useMemo(
    () => (listener: (message: ChatMessage) => void) => {
      messageListenersRef.current.add(listener);
      return () => {
        messageListenersRef.current.delete(listener);
      };
    },
    [],
  );

  const subscribeMessageReactions = useMemo(
    () => (listener: (event: ChatReactionEvent) => void) => {
      reactionListenersRef.current.add(listener);
      return () => reactionListenersRef.current.delete(listener);
    },
    [],
  );

  const subscribeCallEvents = useMemo(
    () => (listener: (event: CallRealtimeEvent) => void) => {
      callListenersRef.current.add(listener);
      return () => {
        callListenersRef.current.delete(listener);
      };
    },
    [],
  );

  const publishConversationUpdate = useMemo(
    () => (conversation: ConversationListItem) => {
      setLastConversationUpdate(conversation);
      setLastConversationDeleted((prev) => (prev?.conversationId === conversation.id ? null : prev));
    },
    [],
  );

  useEffect(() => {
    // Don't tear down the socket while Auth is still restoring the session.
    if (isLoading) {
      return;
    }

    if (!isAuthenticated || !token) {
      disconnectRealtime();
      setUnreadChats(0);
      setUnreadNotifications(0);
      setLastMessage(null);
      setLastMessageReaction(null);
      setLastReactionUnread(null);
      setLastConversationUpdate(null);
      setLastConversationRead(null);
      setLastConversationDeleted(null);
      setLastPresence(null);
      setLastNotification(null);
      return;
    }

    connectRealtime(token);
    updateRealtimeAuthToken(token);
    let cancelled = false;
    let hasUnreadSynced = false;
    void hydrateNotificationSoundSettingsFromProfile();

    const unbind = bindRealtimeHandlers({
      onMessageNew: (message) => {
        // Пока сокет жив — кладём сообщение в кэш треда (даже если чат не открыт).
        appendCachedThreadMessage(message.conversationId, message);
        setLastMessage(message);
        setLastConversationDeleted((prev) => (prev?.conversationId === message.conversationId ? null : prev));
        messageListenersRef.current.forEach((listener) => listener(message));
        if (
          message.senderId !== userIdRef.current &&
          message.kind !== 'favorite_received' &&
          message.kind !== 'favorite_removed' &&
          message.kind !== 'user_blocked' &&
          message.kind !== 'missed_voice_call'
        ) {
          notifyIncomingChatMessage(message.conversationId);
        }
      },
      onMessageReaction: (event) => {
        setLastMessageReaction(event);
        reactionListenersRef.current.forEach((listener) => listener(event));
        if (event.actorId !== userIdRef.current) {
          notifyIncomingChatMessage(event.conversationId);
        }
      },
      onReactionUnreadSync: setLastReactionUnread,
      onConversationUpdated: (conversation) => {
        setLastConversationUpdate(conversation);
        setLastConversationDeleted((prev) => (prev?.conversationId === conversation.id ? null : prev));
      },
      onConversationRead: setLastConversationRead,
      onConversationDeleted: (payload) => {
        setLastConversationDeleted(payload);
        setLastConversationUpdate((prev) => (prev?.id === payload.conversationId ? null : prev));
      },
      onPresenceUpdate: setLastPresence,
      onNotificationNew: (notification) => {
        setLastNotification(notification);
        if (!notification.readAt) {
          setUnreadNotifications((prev) => prev + 1);
        }
        notifyIncomingPortalNotification({
          type: notification.type,
          actorName: notification.actor.nickname,
          subject: notification.subject,
          actionText: notification.actionText,
          messageText: notification.messageText,
        });
      },
      onUnreadSync: (payload: UnreadSyncPayload) => {
        hasUnreadSynced = true;
        setUnreadChats(payload.chats);
        setUnreadNotifications(payload.notifications);
      },
      onCallEvent: (event) => {
        callListenersRef.current.forEach((listener) => listener(event));
      },
    });

    void getNotificationsUnreadCount()
      .then((result) => {
        if (!cancelled && !hasUnreadSynced) {
          setUnreadNotifications(result.count);
        }
      })
      .catch(() => {
        // Keep 0 until the first unread:sync from the socket.
      });

    return () => {
      cancelled = true;
      unbind();
    };
  }, [isAuthenticated, isLoading, token]);

  // Keep presence alive on any app section — reconnect when the app/tab is focused again.
  // iOS Safari freezes WS while locked; after unlock we force reconnect + bump dataResyncAt
  // so screens catch up missed message:new / conversation:updated events via HTTP.
  useEffect(() => {
    if (isLoading || !isAuthenticated || !token) {
      return;
    }

    let hiddenSince: number | null = null;
    let resyncTimer: ReturnType<typeof setTimeout> | null = null;
    let sawDisconnect = false;

    const bumpDataResync = () => {
      if (resyncTimer) {
        clearTimeout(resyncTimer);
      }
      // Debounce: visibility + AppState + focus + socket connect often fire together.
      resyncTimer = setTimeout(() => {
        resyncTimer = null;
        setDataResyncAt((value) => value + 1);
        void getNotificationsUnreadCount()
          .then((result) => {
            setUnreadNotifications(result.count);
          })
          .catch(() => {
            // unread:sync from socket may still arrive.
          });
      }, 320);
    };

    const keepAlive = (options?: { force?: boolean; resync?: boolean }) => {
      const returning = Boolean(options?.resync);
      const awayMs = hiddenSince != null ? Date.now() - hiddenSince : 0;
      // Only force-tear the socket when coming back — not on the 30s heartbeat.
      const force = Boolean(options?.force) || (returning && awayMs >= 3_000);
      ensureRealtimeConnected(token, { force });
      if (returning) {
        bumpDataResync();
        hiddenSince = null;
      }
    };

    const markHidden = () => {
      if (hiddenSince == null) {
        hiddenSince = Date.now();
      }
    };

    /** Resync only if we were actually backgrounded — bare `focus` would spam HTTP. */
    const onResume = () => {
      if (hiddenSince == null) {
        keepAlive();
        return;
      }
      keepAlive({ resync: true });
    };

    keepAlive();

    const appSub = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        onResume();
      } else if (state === 'background' || state === 'inactive') {
        markHidden();
      }
    });

    let visibilityHandler: (() => void) | null = null;
    let pageshowHandler: ((event: PageTransitionEvent) => void) | null = null;
    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      visibilityHandler = () => {
        if (document.visibilityState === 'visible') {
          onResume();
        } else {
          markHidden();
        }
      };
      pageshowHandler = (event) => {
        // bfcache restore after iOS freeze — always catch up.
        if (event.persisted || hiddenSince != null) {
          keepAlive({ resync: true });
        }
      };
      document.addEventListener('visibilitychange', visibilityHandler);
      window.addEventListener('focus', onResume);
      window.addEventListener('pageshow', pageshowHandler);
    }

    const interval = setInterval(() => keepAlive(), 30_000);

    const socket = getRealtimeSocket();
    const onSocketDisconnect = () => {
      sawDisconnect = true;
    };
    const onSocketConnect = () => {
      // Skip the first connect after mount — screens already bootstrap via HTTP.
      if (sawDisconnect) {
        bumpDataResync();
      }
    };
    socket?.on('disconnect', onSocketDisconnect);
    socket?.on('connect', onSocketConnect);

    return () => {
      appSub.remove();
      clearInterval(interval);
      if (resyncTimer) {
        clearTimeout(resyncTimer);
      }
      socket?.off('disconnect', onSocketDisconnect);
      socket?.off('connect', onSocketConnect);
      if (Platform.OS === 'web' && typeof document !== 'undefined') {
        if (visibilityHandler) {
          document.removeEventListener('visibilitychange', visibilityHandler);
        }
        window.removeEventListener('focus', onResume);
        if (pageshowHandler) {
          window.removeEventListener('pageshow', pageshowHandler);
        }
      }
    };
  }, [isAuthenticated, isLoading, token]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const onGestureUnlock = () => {
      unlockChatAlerts();
    };
    const onInteract = () => {
      stopNewMessageTitleBlink();
    };
    const onVisibility = () => {
      if (document.visibilityState === 'visible') {
        stopNewMessageTitleBlink();
      }
    };

    // One gesture is enough to unlock autoplay — do not re-fetch sounds on every click.
    window.addEventListener('pointerdown', onGestureUnlock, {
      capture: true,
      once: true,
    });
    window.addEventListener('keydown', onGestureUnlock, {
      capture: true,
      once: true,
    });

    window.addEventListener('pointerdown', onInteract, true);
    window.addEventListener('keydown', onInteract, true);
    window.addEventListener('focus', stopNewMessageTitleBlink);
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      window.removeEventListener('pointerdown', onGestureUnlock, true);
      window.removeEventListener('keydown', onGestureUnlock, true);
      window.removeEventListener('pointerdown', onInteract, true);
      window.removeEventListener('keydown', onInteract, true);
      window.removeEventListener('focus', stopNewMessageTitleBlink);
      document.removeEventListener('visibilitychange', onVisibility);
      stopNewMessageTitleBlink();
    };
  }, []);

  const value = useMemo(
    () => ({
      unreadChats,
      unreadNotifications,
      dataResyncAt,
      lastMessage,
      lastMessageReaction,
      lastReactionUnread,
      lastConversationUpdate,
      lastConversationRead,
      lastConversationDeleted,
      lastPresence,
      lastNotification,
      setUnreadChats,
      setUnreadNotifications,
      publishConversationUpdate,
      subscribeMessages,
      subscribeMessageReactions,
      subscribeCallEvents,
    }),
    [
      unreadChats,
      unreadNotifications,
      dataResyncAt,
      lastMessage,
      lastMessageReaction,
      lastReactionUnread,
      lastConversationUpdate,
      lastConversationRead,
      lastConversationDeleted,
      lastPresence,
      lastNotification,
      publishConversationUpdate,
      subscribeMessages,
      subscribeMessageReactions,
      subscribeCallEvents,
    ],
  );

  return <RealtimeContext.Provider value={value}>{children}</RealtimeContext.Provider>;
}

export function useRealtime() {
  const context = useContext(RealtimeContext);
  if (!context) {
    throw new Error('useRealtime must be used within RealtimeProvider');
  }
  return context;
}

export function useRealtimeOptional() {
  return useContext(RealtimeContext);
}
