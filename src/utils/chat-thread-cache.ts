import type {
  ChatMessage,
  ConversationListItem,
  MessagesPage,
} from '@/services/chats/chatsApi';
import { listMessages } from '@/services/chats/chatsApi';

export type CachedChatThread = {
  conversation: ConversationListItem | null;
  messages: ChatMessage[];
  nextCursor: string | null;
  peerLastReadAt: string | null;
  updatedAt: number;
};

const MAX_THREADS = 24;

let conversationsCache: ConversationListItem[] | null = null;
const threadCache = new Map<string, CachedChatThread>();

function touchThread(conversationId: string, entry: CachedChatThread) {
  threadCache.delete(conversationId);
  threadCache.set(conversationId, entry);
  while (threadCache.size > MAX_THREADS) {
    const oldest = threadCache.keys().next().value;
    if (oldest === undefined) {
      break;
    }
    threadCache.delete(oldest);
  }
}

export function getCachedConversations(): ConversationListItem[] | null {
  return conversationsCache;
}

export function setCachedConversations(items: ConversationListItem[]) {
  conversationsCache = items;
}

export function upsertCachedConversation(item: ConversationListItem) {
  const list = conversationsCache ?? [];
  const index = list.findIndex((row) => row.id === item.id);
  const next =
    index >= 0
      ? list.map((row, i) => (i === index ? item : row))
      : [item, ...list];
  conversationsCache = [...next].sort((left, right) => {
    const leftPinned = Boolean(left.isPinned);
    const rightPinned = Boolean(right.isPinned);
    if (leftPinned !== rightPinned) {
      return leftPinned ? -1 : 1;
    }
    if (leftPinned && rightPinned) {
      const leftOrder = left.pinSortOrder ?? Number.MAX_SAFE_INTEGER;
      const rightOrder = right.pinSortOrder ?? Number.MAX_SAFE_INTEGER;
      if (leftOrder !== rightOrder) {
        return leftOrder - rightOrder;
      }
    }
    const leftAt = left.lastMessage?.createdAt ?? left.updatedAt;
    const rightAt = right.lastMessage?.createdAt ?? right.updatedAt;
    return rightAt.localeCompare(leftAt);
  });

  const thread = threadCache.get(item.id);
  if (thread) {
    touchThread(item.id, {
      ...thread,
      conversation: item,
      peerLastReadAt: item.peerLastReadAt ?? thread.peerLastReadAt,
      updatedAt: Date.now(),
    });
  }
}

export function removeCachedConversation(conversationId: string) {
  if (conversationsCache) {
    conversationsCache = conversationsCache.filter((item) => item.id !== conversationId);
  }
  threadCache.delete(conversationId);
}

export function getCachedConversation(conversationId: string): ConversationListItem | null {
  const fromList = conversationsCache?.find((item) => item.id === conversationId);
  if (fromList) {
    return fromList;
  }
  return threadCache.get(conversationId)?.conversation ?? null;
}

export function getCachedThread(conversationId: string): CachedChatThread | null {
  return threadCache.get(conversationId) ?? null;
}

export function setCachedThread(
  conversationId: string,
  input: {
    conversation?: ConversationListItem | null;
    messages: ChatMessage[];
    nextCursor: string | null;
    peerLastReadAt: string | null;
  },
) {
  const prev = threadCache.get(conversationId);
  const conversation =
    input.conversation !== undefined
      ? input.conversation
      : (prev?.conversation ?? getCachedConversation(conversationId));

  touchThread(conversationId, {
    conversation,
    messages: input.messages,
    nextCursor: input.nextCursor,
    peerLastReadAt: input.peerLastReadAt,
    updatedAt: Date.now(),
  });

  if (conversation) {
    upsertCachedConversation(conversation);
  }
}

export function mergeCachedThreadMessages(
  conversationId: string,
  page: MessagesPage,
  conversation?: ConversationListItem | null,
) {
  const prev = threadCache.get(conversationId);
  const byId = new Map((prev?.messages ?? []).map((item) => [item.id, item]));
  for (const item of page.items) {
    byId.set(item.id, item);
  }
  const messages = [...byId.values()].sort((left, right) =>
    left.createdAt.localeCompare(right.createdAt),
  );

  const nextConversation =
    conversation ??
    prev?.conversation ??
    getCachedConversation(conversationId);

  const patchedConversation =
    nextConversation &&
    (page.blockedByMe !== undefined || page.blockedMe !== undefined)
      ? {
          ...nextConversation,
          blockedByMe: page.blockedByMe ?? nextConversation.blockedByMe,
          blockedMe: page.blockedMe ?? nextConversation.blockedMe,
          peerLastReadAt: page.peerLastReadAt ?? nextConversation.peerLastReadAt,
        }
      : nextConversation;

  setCachedThread(conversationId, {
    conversation: patchedConversation,
    messages,
    nextCursor: page.nextCursor,
    peerLastReadAt: page.peerLastReadAt,
  });

  return {
    conversation: patchedConversation,
    messages,
    nextCursor: page.nextCursor,
    peerLastReadAt: page.peerLastReadAt,
  };
}

export function appendCachedThreadMessage(conversationId: string, message: ChatMessage) {
  const prev = threadCache.get(conversationId);
  if (!prev) {
    // Пользователь на сайте, тред ещё не открывал — всё равно копим входящие,
    // чтобы при входе сразу были свежие сообщения (история догрузится bootstrap'ом).
    touchThread(conversationId, {
      conversation: getCachedConversation(conversationId),
      messages: [message],
      nextCursor: null,
      peerLastReadAt: null,
      updatedAt: Date.now(),
    });
    return;
  }
  if (prev.messages.some((item) => item.id === message.id)) {
    return;
  }
  const messages = [...prev.messages, message].sort((left, right) =>
    left.createdAt.localeCompare(right.createdAt),
  );
  touchThread(conversationId, {
    ...prev,
    messages,
    updatedAt: Date.now(),
  });
}

export function messageFromConversationPreview(
  conversation: ConversationListItem,
): ChatMessage | null {
  const preview = conversation.lastMessage;
  if (!preview) {
    return null;
  }

  const peer = conversation.peer;
  const previewMember = conversation.membersPreview?.find((item) => item.id === preview.senderId);
  const sender =
    peer && peer.id === preview.senderId
      ? {
          id: peer.id,
          nickname: peer.nickname,
          avatarUrl: peer.avatarUrl,
          badges: peer.badges,
          avatarFrameId: peer.avatarFrameId,
        }
      : previewMember
        ? {
            id: previewMember.id,
            nickname: previewMember.nickname,
            avatarUrl: previewMember.avatarUrl,
            badges: previewMember.badges,
            avatarFrameId: previewMember.avatarFrameId,
          }
        : undefined;

  return {
    id: preview.id,
    conversationId: conversation.id,
    senderId: preview.senderId,
    sender,
    body: preview.body,
    kind: preview.kind ?? 'user',
    createdAt: preview.createdAt,
    image: null,
    attachment: null,
    attachments: [],
  };
}

export type HydratedChatThread = {
  conversation: ConversationListItem | null;
  messages: ChatMessage[];
  nextCursor: string | null;
  peerLastReadAt: string | null;
  ready: boolean;
};

/** Синхронный снимок для первого кадра: без лоадера, сразу последние сообщения. */
export function hydrateChatThread(conversationId?: string): HydratedChatThread {
  if (!conversationId) {
    return {
      conversation: null,
      messages: [],
      nextCursor: null,
      peerLastReadAt: null,
      ready: false,
    };
  }

  const thread = getCachedThread(conversationId);
  const conversation = thread?.conversation ?? getCachedConversation(conversationId);
  let messages = thread?.messages ?? [];
  const preview = conversation?.lastMessage;

  if (conversation && preview && !messages.some((item) => item.id === preview.id)) {
    const stub = messageFromConversationPreview(conversation);
    if (stub) {
      appendCachedThreadMessage(conversationId, stub);
      messages = [...messages, stub].sort((left, right) =>
        left.createdAt.localeCompare(right.createdAt),
      );
    }
  }

  return {
    conversation,
    messages,
    nextCursor: thread?.nextCursor ?? null,
    peerLastReadAt: thread?.peerLastReadAt ?? conversation?.peerLastReadAt ?? null,
    ready: Boolean(conversation) || messages.length > 0,
  };
}

export function mergeVisibleThreadMessages(
  server: ChatMessage[],
  local: ChatMessage[],
  hiddenIds?: Iterable<string>,
): ChatMessage[] {
  const byId = new Map(server.map((item) => [item.id, item]));
  for (const item of local) {
    if (!byId.has(item.id)) {
      byId.set(item.id, item);
    }
  }
  if (hiddenIds) {
    for (const id of hiddenIds) {
      byId.delete(id);
    }
  }
  return [...byId.values()].sort((left, right) =>
    left.createdAt.localeCompare(right.createdAt),
  );
}

export function clearChatCaches() {
  conversationsCache = null;
  threadCache.clear();
  inflightPrefetch.clear();
}

const inflightPrefetch = new Map<
  string,
  Promise<{
    conversation: ConversationListItem | null | undefined;
    messages: ChatMessage[];
    nextCursor: string | null;
    peerLastReadAt: string | null;
  }>
>();

/**
 * Тянет первую страницу последних сообщений в кэш.
 * Дедуп in-flight: press + bootstrap + top-N не бьют API трижды.
 */
export function prefetchChatThread(
  conversationId: string,
  conversation?: ConversationListItem | null,
) {
  const pending = inflightPrefetch.get(conversationId);
  if (pending) {
    return pending;
  }

  const run = listMessages(conversationId)
    .then((page) => mergeCachedThreadMessages(conversationId, page, conversation))
    .finally(() => {
      inflightPrefetch.delete(conversationId);
    });

  inflightPrefetch.set(conversationId, run);
  return run;
}

/** Фоном греет верх списка — без await у вызывающего. */
export function prefetchChatThreads(
  items: ConversationListItem[],
  options?: { limit?: number; concurrency?: number },
) {
  const limit = options?.limit ?? 8;
  const concurrency = options?.concurrency ?? 3;
  const targets = items.slice(0, limit);
  if (targets.length === 0) {
    return;
  }

  void (async () => {
    for (let i = 0; i < targets.length; i += concurrency) {
      const batch = targets.slice(i, i + concurrency);
      await Promise.all(
        batch.map((item) =>
          prefetchChatThread(item.id, item).catch(() => null),
        ),
      );
    }
  })();
}
