import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { AppState, Platform } from 'react-native';

import { useAuth } from '@/context/AuthContext';
import type { ChatMessage, ConversationListItem } from '@/services/chats/chatsApi';
import {
  getNotificationsUnreadCount,
  type PortalNotification,
} from '@/services/notifications/notificationsApi';
import {
  bindRealtimeHandlers,
  connectRealtime,
  disconnectRealtime,
  ensureRealtimeConnected,
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

type RealtimeContextValue = {
  unreadChats: number;
  unreadNotifications: number;
  lastMessage: ChatMessage | null;
  lastConversationUpdate: ConversationListItem | null;
  lastConversationRead: ConversationReadPayload | null;
  lastConversationDeleted: ConversationDeletedPayload | null;
  lastPresence: PresenceUpdatePayload | null;
  lastNotification: PortalNotification | null;
  setUnreadChats: (value: number) => void;
  setUnreadNotifications: (value: number) => void;
  publishConversationUpdate: (conversation: ConversationListItem) => void;
  subscribeMessages: (listener: (message: ChatMessage) => void) => () => void;
  subscribeCallEvents: (listener: (event: CallRealtimeEvent) => void) => () => void;
};

const RealtimeContext = createContext<RealtimeContextValue | null>(null);

export function RealtimeProvider({ children }: { children: ReactNode }) {
  const { token, isAuthenticated, isLoading, user } = useAuth();
  const [unreadChats, setUnreadChats] = useState(0);
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const [lastMessage, setLastMessage] = useState<ChatMessage | null>(null);
  const [lastConversationUpdate, setLastConversationUpdate] =
    useState<ConversationListItem | null>(null);
  const [lastConversationRead, setLastConversationRead] =
    useState<ConversationReadPayload | null>(null);
  const [lastConversationDeleted, setLastConversationDeleted] =
    useState<ConversationDeletedPayload | null>(null);
  const [lastPresence, setLastPresence] = useState<PresenceUpdatePayload | null>(null);
  const [lastNotification, setLastNotification] = useState<PortalNotification | null>(null);
  const messageListenersRef = useRef(new Set<(message: ChatMessage) => void>());
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
      setLastConversationDeleted((prev) =>
        prev?.conversationId === conversation.id ? null : prev,
      );
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

    const unbind = bindRealtimeHandlers({
      onMessageNew: (message) => {
        setLastMessage(message);
        setLastConversationDeleted((prev) =>
          prev?.conversationId === message.conversationId ? null : prev,
        );
        messageListenersRef.current.forEach((listener) => listener(message));
        if (
          message.senderId !== userIdRef.current &&
          message.kind !== 'favorite_received' &&
          message.kind !== 'favorite_removed' &&
          message.kind !== 'user_blocked' &&
          message.kind !== 'missed_voice_call'
        ) {
          notifyIncomingChatMessage();
        }
      },
      onConversationUpdated: (conversation) => {
        setLastConversationUpdate(conversation);
        setLastConversationDeleted((prev) =>
          prev?.conversationId === conversation.id ? null : prev,
        );
      },
      onConversationRead: setLastConversationRead,
      onConversationDeleted: (payload) => {
        setLastConversationDeleted(payload);
        setLastConversationUpdate((prev) =>
          prev?.id === payload.conversationId ? null : prev,
        );
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
  useEffect(() => {
    if (isLoading || !isAuthenticated || !token) {
      return;
    }

    const keepAlive = () => {
      ensureRealtimeConnected(token);
    };

    keepAlive();

    const appSub = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        keepAlive();
      }
    });

    let visibilityHandler: (() => void) | null = null;
    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      visibilityHandler = () => {
        if (document.visibilityState === 'visible') {
          keepAlive();
        }
      };
      document.addEventListener('visibilitychange', visibilityHandler);
      window.addEventListener('focus', keepAlive);
    }

    const interval = setInterval(keepAlive, 30_000);

    return () => {
      appSub.remove();
      clearInterval(interval);
      if (Platform.OS === 'web' && typeof document !== 'undefined') {
        if (visibilityHandler) {
          document.removeEventListener('visibilitychange', visibilityHandler);
        }
        window.removeEventListener('focus', keepAlive);
      }
    };
  }, [isAuthenticated, isLoading, token]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const onInteract = () => {
      unlockChatAlerts();
      stopNewMessageTitleBlink();
    };
    const onVisibility = () => {
      if (document.visibilityState === 'visible') {
        stopNewMessageTitleBlink();
      }
    };

    window.addEventListener('pointerdown', onInteract, true);
    window.addEventListener('touchstart', onInteract, true);
    window.addEventListener('click', onInteract, true);
    window.addEventListener('keydown', onInteract, true);
    window.addEventListener('focus', stopNewMessageTitleBlink);
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      window.removeEventListener('pointerdown', onInteract, true);
      window.removeEventListener('touchstart', onInteract, true);
      window.removeEventListener('click', onInteract, true);
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
      lastMessage,
      lastConversationUpdate,
      lastConversationRead,
      lastConversationDeleted,
      lastPresence,
      lastNotification,
      setUnreadChats,
      setUnreadNotifications,
      publishConversationUpdate,
      subscribeMessages,
      subscribeCallEvents,
    }),
    [
      unreadChats,
      unreadNotifications,
      lastMessage,
      lastConversationUpdate,
      lastConversationRead,
      lastConversationDeleted,
      lastPresence,
      lastNotification,
      publishConversationUpdate,
      subscribeMessages,
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
