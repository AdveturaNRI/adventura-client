import { io } from 'socket.io-client';
import { API_ORIGIN } from '@/constants/api.config';
export const REALTIME_EVENTS = {
    MESSAGE_NEW: 'message:new',
    CONVERSATION_UPDATED: 'conversation:updated',
    CONVERSATION_READ: 'conversation:read',
    CONVERSATION_DELETED: 'conversation:deleted',
    NOTIFICATION_NEW: 'notification:new',
    UNREAD_SYNC: 'unread:sync',
    PRESENCE_UPDATE: 'presence:update',
    CALL_INVITE: 'call:invite',
    CALL_ACCEPTED: 'call:accepted',
    CALL_DECLINED: 'call:declined',
    CALL_ENDED: 'call:ended',
};
let socket = null;
let handlers = {};
let listenersBound = false;
function ensureListeners(current) {
    if (listenersBound) {
        return;
    }
    listenersBound = true;
    current.on(REALTIME_EVENTS.MESSAGE_NEW, (payload) => {
        handlers.onMessageNew?.(payload);
    });
    current.on(REALTIME_EVENTS.CONVERSATION_UPDATED, (payload) => {
        handlers.onConversationUpdated?.(payload);
    });
    current.on(REALTIME_EVENTS.CONVERSATION_READ, (payload) => {
        handlers.onConversationRead?.(payload);
    });
    current.on(REALTIME_EVENTS.CONVERSATION_DELETED, (payload) => {
        handlers.onConversationDeleted?.(payload);
    });
    current.on(REALTIME_EVENTS.NOTIFICATION_NEW, (payload) => {
        handlers.onNotificationNew?.(payload);
    });
    current.on(REALTIME_EVENTS.UNREAD_SYNC, (payload) => {
        handlers.onUnreadSync?.(payload);
    });
    current.on(REALTIME_EVENTS.PRESENCE_UPDATE, (payload) => {
        handlers.onPresenceUpdate?.(payload);
    });
    current.on(REALTIME_EVENTS.CALL_INVITE, (payload) => {
        handlers.onCallEvent?.({ type: 'invite', payload });
    });
    current.on(REALTIME_EVENTS.CALL_ACCEPTED, (payload) => {
        handlers.onCallEvent?.({ type: 'accepted', payload });
    });
    current.on(REALTIME_EVENTS.CALL_DECLINED, (payload) => {
        handlers.onCallEvent?.({ type: 'declined', payload });
    });
    current.on(REALTIME_EVENTS.CALL_ENDED, (payload) => {
        handlers.onCallEvent?.({ type: 'ended', payload });
    });
}
export function getRealtimeSocket() {
    return socket;
}
export function connectRealtime(token) {
    if (socket) {
        socket.auth = { token };
        if (!socket.connected) {
            socket.connect();
        }
        ensureListeners(socket);
        return socket;
    }
    socket = io(`${API_ORIGIN}/realtime`, {
        transports: ['websocket', 'polling'],
        auth: { token },
        autoConnect: true,
        withCredentials: true,
        reconnection: true,
        reconnectionAttempts: Infinity,
        reconnectionDelay: 500,
    });
    ensureListeners(socket);
    return socket;
}
/** Update JWT on an existing socket (e.g. after silent HTTP refresh). */
export function updateRealtimeAuthToken(token) {
    if (!socket || !token.trim()) {
        return;
    }
    socket.auth = { token: token.trim() };
}
/** Re-auth + connect if the socket dropped while the user is still in the app. */
export function ensureRealtimeConnected(token) {
    if (!token.trim()) {
        return;
    }
    const current = connectRealtime(token.trim());
    if (!current.connected) {
        current.connect();
    }
}
export function disconnectRealtime() {
    listenersBound = false;
    socket?.removeAllListeners();
    socket?.disconnect();
    socket = null;
}
export function bindRealtimeHandlers(nextHandlers) {
    handlers = nextHandlers;
    if (socket) {
        ensureListeners(socket);
    }
    return () => {
        if (handlers === nextHandlers) {
            handlers = {};
        }
    };
}
