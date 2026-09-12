import { apiMultipart, apiRequest } from '@/services/api/client';
import { Platform } from 'react-native';

export type ChatPeer = {
  id: string;
  nickname: string;
  avatarUrl: string | null;
  online: boolean;
  lastSeenAt: string | null;
};

export type ChatMember = {
  id: string;
  nickname: string;
  avatarUrl: string | null;
  role: 'owner' | 'member';
  online: boolean;
  lastSeenAt: string | null;
};

export type ChatAttachmentKind = 'image' | 'audio' | 'file';

export type ChatAttachment = {
  kind: ChatAttachmentKind;
  name: string;
  mimeType: string;
  url: string | null;
  image: Partial<Record<string, string>> | null;
};

export type ChatMessageKind =
  | 'user'
  | 'favorite_received'
  | 'favorite_removed'
  | 'user_blocked'
  | 'user_unblocked';

export type ChatMessageSender = {
  id: string;
  nickname: string;
  avatarUrl: string | null;
};

export type ChatMessage = {
  id: string;
  conversationId: string;
  senderId: string;
  sender?: ChatMessageSender;
  body: string | null;
  kind?: ChatMessageKind;
  createdAt: string;
  image: Partial<Record<string, string>> | null;
  attachment: ChatAttachment | null;
};

export type ConversationListItem = {
  id: string;
  type?: 'direct' | 'group';
  title?: string | null;
  gameId?: string | null;
  peer: ChatPeer | null;
  memberCount?: number;
  membersPreview?: ChatPeer[];
  peerLastReadAt: string | null;
  lastMessage: {
    id: string;
    body: string | null;
    senderId: string;
    createdAt: string;
    hasImage: boolean;
    attachmentKind: ChatAttachmentKind | null;
    kind?: ChatMessageKind;
  } | null;
  unread: boolean;
  isFavorite?: boolean;
  peerFavoritedMe?: boolean;
  blockedByMe?: boolean;
  blockedMe?: boolean;
  updatedAt: string;
};

export type MessagesPage = {
  items: ChatMessage[];
  nextCursor: string | null;
  peerLastReadAt: string | null;
  blockedByMe?: boolean;
  blockedMe?: boolean;
};

export function listConversations() {
  return apiRequest<ConversationListItem[]>('/chats');
}

export function openConversationWith(userId: string) {
  return apiRequest<ConversationListItem>(`/chats/with/${userId}`, {
    method: 'POST',
  });
}

export function createGroupChat(title: string, memberIds: string[]) {
  return apiRequest<ConversationListItem>('/chats/groups', {
    method: 'POST',
    body: { title, memberIds },
  });
}

export function openGameChat(gameId: string) {
  return apiRequest<ConversationListItem>(`/chats/games/${encodeURIComponent(gameId)}`, {
    method: 'POST',
  });
}

export function listChatMembers(conversationId: string) {
  return apiRequest<ChatMember[]>(`/chats/${conversationId}/members`);
}

export function leaveGroup(conversationId: string) {
  return apiRequest<{ ok: true }>(`/chats/${conversationId}/leave`, {
    method: 'POST',
  });
}

export function listMessages(conversationId: string, cursor?: string) {
  const query = cursor ? `?cursor=${encodeURIComponent(cursor)}` : '';
  return apiRequest<MessagesPage>(`/chats/${conversationId}/messages${query}`, {
    skipLoading: true,
  });
}

export function markConversationRead(conversationId: string) {
  return apiRequest<{ ok: true }>(`/chats/${conversationId}/read`, {
    method: 'POST',
    skipLoading: true,
  });
}

export function deleteConversation(conversationId: string, forEveryone = false) {
  const query = forEveryone ? '?forEveryone=true' : '';
  return apiRequest<{ ok: true }>(`/chats/${conversationId}${query}`, {
    method: 'DELETE',
  });
}

export function blockPeer(conversationId: string) {
  return apiRequest<ConversationListItem>(`/chats/${conversationId}/block`, {
    method: 'POST',
  });
}

export function unblockPeer(conversationId: string) {
  return apiRequest<ConversationListItem>(`/chats/${conversationId}/block`, {
    method: 'DELETE',
  });
}

export function unblockPeerByUserId(userId: string) {
  return apiRequest<ConversationListItem>(`/chats/with/${encodeURIComponent(userId)}/block`, {
    method: 'DELETE',
  });
}

export async function sendChatMessage(
  conversationId: string,
  options: {
    body?: string;
    fileUri?: string;
    fileName?: string;
    mimeType?: string;
  },
) {
  const formData = new FormData();

  if (options.body?.trim()) {
    formData.append('body', options.body.trim());
  }

  if (options.fileUri) {
    const fileName = options.fileName ?? 'attachment';
    const mimeType = options.mimeType ?? 'application/octet-stream';

    if (Platform.OS === 'web') {
      const response = await fetch(options.fileUri);
      const blob = await response.blob();
      formData.append('file', blob, fileName);
    } else {
      formData.append('file', {
        uri: options.fileUri,
        name: fileName,
        type: mimeType,
      } as unknown as Blob);
    }
  }

  return apiMultipart<ChatMessage>(`/chats/${conversationId}/messages`, formData);
}
