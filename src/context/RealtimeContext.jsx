import { createContext, useContext, useEffect, useMemo, useRef, useState, } from 'react';
import { AppState, Platform } from 'react-native';
import { useAuth } from '@/context/AuthContext';
import { getNotificationsUnreadCount, } from '@/services/notifications/notificationsApi';
import { bindRealtimeHandlers, connectRealtime, disconnectRealtime, ensureRealtimeConnected, updateRealtimeAuthToken, } from '@/services/realtime/socket';
import { notifyIncomingChatMessage, notifyIncomingPortalNotification, stopNewMessageTitleBlink, unlockChatAlerts, } from '@/utils/chat-alerts';
import { appendCachedThreadMessage } from '@/utils/chat-thread-cache';
import { hydrateNotificationSoundSettingsFromProfile } from '@/utils/notification-sound-settings';
const RealtimeContext = createContext(null);
export function RealtimeProvider({ children }) {
    const { token, isAuthenticated, isLoading, user } = useAuth();
    const [unreadChats, setUnreadChats] = useState(0);
    const [unreadNotifications, setUnreadNotifications] = useState(0);
    const [lastMessage, setLastMessage] = useState(null);
    const [lastConversationUpdate, setLastConversationUpdate] = useState(null);
    const [lastConversationRead, setLastConversationRead] = useState(null);
    const [lastConversationDeleted, setLastConversationDeleted] = useState(null);
    const [lastPresence, setLastPresence] = useState(null);
    const [lastNotification, setLastNotification] = useState(null);
    const messageListenersRef = useRef(new Set());
    const callListenersRef = useRef(new Set());
    const userIdRef = useRef(user?.id);
    userIdRef.current = user?.id;
    const subscribeMessages = useMemo(() => (listener) => {
        messageListenersRef.current.add(listener);
        return () => {
            messageListenersRef.current.delete(listener);
        };
    }, []);
    const subscribeCallEvents = useMemo(() => (listener) => {
        callListenersRef.current.add(listener);
        return () => {
            callListenersRef.current.delete(listener);
        };
    }, []);
    const publishConversationUpdate = useMemo(() => (conversation) => {
        setLastConversationUpdate(conversation);
        setLastConversationDeleted((prev) => prev?.conversationId === conversation.id ? null : prev);
    }, []);
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
        void hydrateNotificationSoundSettingsFromProfile();
        const unbind = bindRealtimeHandlers({
            onMessageNew: (message) => {
                appendCachedThreadMessage(message.conversationId, message);
                setLastMessage(message);
                setLastConversationDeleted((prev) => prev?.conversationId === message.conversationId ? null : prev);
                messageListenersRef.current.forEach((listener) => listener(message));
                if (message.senderId !== userIdRef.current &&
                    message.kind !== 'favorite_received' &&
                    message.kind !== 'favorite_removed' &&
                    message.kind !== 'user_blocked' &&
                    message.kind !== 'missed_voice_call') {
                    notifyIncomingChatMessage(message.conversationId);
                }
            },
            onConversationUpdated: (conversation) => {
                setLastConversationUpdate(conversation);
                setLastConversationDeleted((prev) => prev?.conversationId === conversation.id ? null : prev);
            },
            onConversationRead: setLastConversationRead,
            onConversationDeleted: (payload) => {
                setLastConversationDeleted(payload);
                setLastConversationUpdate((prev) => prev?.id === payload.conversationId ? null : prev);
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
            onUnreadSync: (payload) => {
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
        let visibilityHandler = null;
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
    const value = useMemo(() => ({
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
    }), [
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
    ]);
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
