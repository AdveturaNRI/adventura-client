import { io, type Socket } from 'socket.io-client';

import { API_ORIGIN } from '@/constants/api.config';
import type { ChatMessage, ConversationListItem } from '@/services/chats/chatsApi';
import type { PortalNotification } from '@/services/notifications/notificationsApi';

export const REALTIME_EVENTS = {
  MESSAGE_NEW: 'message:new',
  CONVERSATION_UPDATED: 'conversation:updated',
  CONVERSATION_READ: 'conversation:read',
  CONVERSATION_DELETED: 'conversation:deleted',
  NOTIFICATION_NEW: 'notification:new',
  UNREAD_SYNC: 'unread:sync',
  PRESENCE_UPDATE: 'presence:update',
} as const;

export type UnreadSyncPayload = {
  chats: number;
  notifications: number;
};

export type PresenceUpdatePayload = {
  userId: string;
  online: boolean;
  lastSeenAt: string | null;
};

export type ConversationReadPayload = {
  conversationId: string;
  readerId: string;
  lastReadAt: string;
};

export type ConversationDeletedPayload = {
  conversationId: string;
};

export type RealtimeHandlers = {
  onMessageNew?: (message: ChatMessage) => void;
  onConversationUpdated?: (conversation: ConversationListItem) => void;
  onConversationRead?: (payload: ConversationReadPayload) => void;
  onConversationDeleted?: (payload: ConversationDeletedPayload) => void;
  onNotificationNew?: (notification: PortalNotification) => void;
  onUnreadSync?: (payload: UnreadSyncPayload) => void;
  onPresenceUpdate?: (payload: PresenceUpdatePayload) => void;
};

let socket: Socket | null = null;
let handlers: RealtimeHandlers = {};
let listenersBound = false;

function ensureListeners(current: Socket) {
  if (listenersBound) {
    return;
  }
  listenersBound = true;

  current.on(REALTIME_EVENTS.MESSAGE_NEW, (payload: ChatMessage) => {
    handlers.onMessageNew?.(payload);
  });
  current.on(REALTIME_EVENTS.CONVERSATION_UPDATED, (payload: ConversationListItem) => {
    handlers.onConversationUpdated?.(payload);
  });
  current.on(REALTIME_EVENTS.CONVERSATION_READ, (payload: ConversationReadPayload) => {
    handlers.onConversationRead?.(payload);
  });
  current.on(REALTIME_EVENTS.CONVERSATION_DELETED, (payload: ConversationDeletedPayload) => {
    handlers.onConversationDeleted?.(payload);
  });
  current.on(REALTIME_EVENTS.NOTIFICATION_NEW, (payload: PortalNotification) => {
    handlers.onNotificationNew?.(payload);
  });
  current.on(REALTIME_EVENTS.UNREAD_SYNC, (payload: UnreadSyncPayload) => {
    handlers.onUnreadSync?.(payload);
  });
  current.on(REALTIME_EVENTS.PRESENCE_UPDATE, (payload: PresenceUpdatePayload) => {
    handlers.onPresenceUpdate?.(payload);
  });
}

export function getRealtimeSocket() {
  return socket;
}

export function connectRealtime(token: string) {
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

export function disconnectRealtime() {
  listenersBound = false;
  socket?.removeAllListeners();
  socket?.disconnect();
  socket = null;
}

export function bindRealtimeHandlers(nextHandlers: RealtimeHandlers) {
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
