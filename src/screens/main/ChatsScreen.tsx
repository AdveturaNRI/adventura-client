import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useFocusEffect, usePathname, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import DraggableFlatList, {
  ScaleDecorator,
  type RenderItemParams,
} from 'react-native-draggable-flatlist';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { BlockUserDialog } from '@/components/chats/BlockUserDialog';
import { CreateGroupDialog, contactsFromConversations } from '@/components/chats/CreateGroupDialog';
import { CrownOffIcon } from '@/components/chats/CrownOffIcon';
import { DeleteChatDialog } from '@/components/chats/DeleteChatDialog';
import { MobileScreenHeader } from '@/components/navigation/MobileScreenHeader';
import { useIsDesktopSidebarVisible } from '@/components/navigation/DesktopThemeToggle';
import { ScreenTransition } from '@/components/navigation/ScreenTransition';
import { toast } from '@/components/ui';
import { FontSize, Spacing, type ThemeColors } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';
import { useRealtime } from '@/context/RealtimeContext';
import { useVoicePlayback } from '@/context/VoicePlaybackContext';
import { useTheme } from '@/hooks/use-theme';
import { useThemedStyles } from '@/hooks/use-themed-styles';
import { useMainScreenStyles } from '@/screens/main/main-screen.styles';
import {
  blockPeer,
  createGroupChat,
  deleteConversation,
  leaveGroup,
  listConversations,
  pinConversation,
  reorderPinnedConversations,
  unblockPeer,
  unpinConversation,
  type ConversationListItem,
} from '@/services/chats/chatsApi';
import { ApiError } from '@/services/api/api-error';
import { upsertWandererReaction, clearWandererReaction } from '@/services/profile/wanderersApi';
import { diceRollPreviewText, parseDiceRollPayload } from '@/utils/chat-dice-roll';
import { localizeErrorMessage } from '@/utils/localizeError';

function isGroupChat(item: ConversationListItem) {
  return item.type === 'group';
}

function sortConversations(items: ConversationListItem[]) {
  return [...items].sort((left, right) => {
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
    return right.updatedAt.localeCompare(left.updatedAt);
  });
}

function conversationTitle(item: ConversationListItem) {
  if (isGroupChat(item)) {
    return item.title?.trim() || 'Группа';
  }
  return item.peer?.nickname ?? 'Чат';
}
function createStyles(colors: ThemeColors, isRail: boolean) {
  return StyleSheet.create({
    container: {
      flex: 1,
      minHeight: 0,
      backgroundColor: colors.background,
      paddingHorizontal: isRail ? Spacing.sm : Spacing.lg,
      paddingTop: isRail ? Spacing.md : undefined,
      gap: Spacing.sm,
    },
    title: {
      fontSize: isRail ? 22 : FontSize.h1,
      fontWeight: '700',
      color: colors.text,
      paddingHorizontal: Spacing.sm,
      paddingBottom: Spacing.xs,
    },
    list: {
      flex: 1,
      minHeight: 0,
      width: '100%',
    },
    listContent: {
      paddingBottom: Spacing.xl,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: Spacing.sm,
      paddingVertical: 12,
      paddingHorizontal: Spacing.sm,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    rowSelected: {
      backgroundColor: 'rgba(21, 122, 254, 0.06)',
    },
    rowMain: {
      flex: 1,
      minWidth: 0,
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.md,
    },
    rowPressed: {
      opacity: 0.72,
    },
    rowFavorite: {
      borderBottomColor: 'rgba(201, 162, 39, 0.35)',
    },
    rowPinned: {
      backgroundColor: 'rgba(21, 122, 254, 0.04)',
    },
    rowDragging: {
      backgroundColor: 'rgba(21, 122, 254, 0.12)',
      ...Platform.select({
        web: { boxShadow: '0 8px 24px rgba(0,0,0,0.18)' } as object,
        default: {
          shadowColor: '#000',
          shadowOpacity: 0.18,
          shadowRadius: 10,
          shadowOffset: { width: 0, height: 4 },
          elevation: 6,
        },
      }),
    },
    pinSeal: {
      position: 'absolute',
      right: -2,
      top: -2,
      width: 18,
      height: 18,
      borderRadius: 9,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: 'rgba(21, 122, 254, 0.35)',
      zIndex: 3,
      ...Platform.select({
        web: { boxShadow: '0 1px 4px rgba(21, 122, 254, 0.2)' } as object,
        default: {
          shadowColor: colors.primary,
          shadowOpacity: 0.2,
          shadowRadius: 3,
          shadowOffset: { width: 0, height: 1 },
          elevation: 2,
        },
      }),
    },
    dragHandle: {
      width: 22,
      height: 28,
      borderRadius: 8,
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: 2,
      marginRight: -2,
      flexShrink: 0,
      opacity: 0.55,
    },
    favoriteSeal: {
      position: 'absolute',
      right: -2,
      bottom: -2,
      width: 18,
      height: 18,
      borderRadius: 9,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.background,
      borderWidth: 1,
      borderColor: '#D4AF37',
      zIndex: 3,
    },
    nameFavorite: {
      color: colors.text,
    },
    favoriteMark: {
      fontSize: 10,
      fontWeight: '700',
      color: '#9A7518',
      letterSpacing: 0.3,
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: 8,
      overflow: 'hidden',
      backgroundColor: 'rgba(212, 175, 55, 0.16)',
      flexShrink: 0,
    },
    avatarWrap: {
      width: 48,
      height: 48,
      flexShrink: 0,
    },
    avatarFavorite: {
      borderWidth: 1.5,
      borderColor: '#D4AF37',
    },
    avatar: {
      width: 48,
      height: 48,
      borderRadius: 24,
      backgroundColor: colors.primary,
      overflow: 'hidden',
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
    },
    avatarImage: {
      width: '100%',
      height: '100%',
    },
    avatarInitial: {
      fontSize: 18,
      fontWeight: '700',
      color: colors.onPrimary,
    },
    avatarFill: {
      ...StyleSheet.absoluteFill,
      backgroundColor: colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    body: {
      flex: 1,
      minWidth: 0,
      gap: 3,
      justifyContent: 'center',
    },
    nameRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.sm,
    },
    name: {
      flex: 1,
      minWidth: 0,
      fontSize: 16,
      fontWeight: '600',
      color: colors.text,
    },
    time: {
      fontSize: FontSize.caption,
      color: colors.textSubtle,
      flexShrink: 0,
    },
    previewRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.sm,
    },
    preview: {
      flex: 1,
      fontSize: FontSize.label,
      color: colors.textSecondary,
    },
    previewUnread: {
      color: colors.text,
      fontWeight: '600',
    },
    unreadDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: colors.primary,
      flexShrink: 0,
    },
    menuButton: {
      width: 28,
      height: 28,
      borderRadius: 14,
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: 2,
      flexShrink: 0,
    },
    menuRoot: {
      flex: 1,
    },
    menuBackdrop: {
      ...StyleSheet.absoluteFill,
    },
    menu: {
      position: 'absolute',
      minWidth: 200,
      paddingVertical: 6,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.background,
      shadowColor: colors.shadow,
      shadowOffset: { width: 0, height: 10 },
      shadowOpacity: 0.14,
      shadowRadius: 20,
      elevation: 8,
    },
    menuItem: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.sm,
      paddingHorizontal: Spacing.md,
      paddingVertical: 12,
    },
    menuItemPressed: {
      opacity: 0.7,
    },
    menuItemLabel: {
      fontSize: FontSize.label,
      fontWeight: '600',
      color: colors.destructive,
    },
    menuItemLabelFavorite: {
      color: '#9A7518',
    },
    empty: {
      paddingVertical: Spacing.xl,
      paddingHorizontal: Spacing.sm,
      gap: Spacing.sm,
    },
    emptyTitle: {
      fontSize: FontSize.button,
      fontWeight: '600',
      color: colors.text,
    },
    emptyHint: {
      fontSize: FontSize.label,
      color: colors.textSecondary,
      lineHeight: FontSize.label * 1.45,
    },
    headerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: Spacing.sm,
      paddingHorizontal: isRail ? 0 : undefined,
    },
    newGroupButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: Spacing.sm,
      paddingVertical: 8,
      borderRadius: 12,
      backgroundColor: 'rgba(21, 122, 254, 0.12)',
    },
    newGroupLabel: {
      fontSize: FontSize.caption,
      fontWeight: '700',
      color: colors.primary,
    },
    groupAvatarStack: {
      width: 48,
      height: 48,
    },
    groupAvatarChip: {
      position: 'absolute',
      width: 28,
      height: 28,
      borderRadius: 14,
      overflow: 'hidden',
      borderWidth: 1.5,
      borderColor: colors.background,
      backgroundColor: colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    groupAvatarChipImage: {
      width: '100%',
      height: '100%',
    },
    groupAvatarChipInitial: {
      fontSize: 11,
      fontWeight: '700',
      color: colors.onPrimary,
    },
    groupMeta: {
      fontSize: FontSize.caption,
      color: colors.primary,
      fontWeight: '600',
    },
  });
}

function formatPreview(item: ConversationListItem) {
  if (!item.lastMessage) {
    return isGroupChat(item) ? 'Группа создана' : 'Начните переписку';
  }
  const peerId = item.peer?.id;
  if (item.lastMessage.kind === 'favorite_received') {
    return item.lastMessage.senderId === peerId
      ? `${item.peer?.nickname ?? 'Кто-то'} добавил вас в избранные`
      : 'Вы добавили в избранные';
  }
  if (item.lastMessage.kind === 'favorite_removed') {
    return item.lastMessage.senderId === peerId
      ? `${item.peer?.nickname ?? 'Кто-то'} убрал вас из избранных`
      : 'Вы убрали из избранных';
  }
  if (item.lastMessage.kind === 'user_blocked') {
    return item.lastMessage.senderId === peerId
      ? 'Вас заблокировали'
      : 'Вы заблокировали пользователя';
  }
  if (item.lastMessage.kind === 'user_unblocked') {
    return item.lastMessage.senderId === peerId
      ? 'Разблокировал вас'
      : 'Вы разблокировали пользователя';
  }
  if (item.lastMessage.kind === 'dice_roll') {
    const raw = item.lastMessage.body?.trim() || '';
    const payload = parseDiceRollPayload(raw);
    if (payload) {
      return diceRollPreviewText(payload);
    }
    // Уже отформатированное превью с API / старый кэш
    return raw || 'Бросок костей';
  }
  if (item.lastMessage.body?.trim()) {
    return item.lastMessage.body.trim();
  }
  if (item.lastMessage.attachmentKind === 'image' || item.lastMessage.hasImage) {
    return 'Фото';
  }
  if (item.lastMessage.attachmentKind === 'audio') {
    return 'Аудио';
  }
  if (item.lastMessage.attachmentKind === 'file') {
    return 'Файл';
  }
  return 'Сообщение';
}

function formatListTime(iso: string | null | undefined) {
  if (!iso) {
    return '';
  }

  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return '';
  }

  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfThatDay = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const dayDiff = Math.round((startOfToday.getTime() - startOfThatDay.getTime()) / 86_400_000);

  if (dayDiff === 0) {
    return date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
  }
  if (dayDiff === 1) {
    return 'вчера';
  }
  if (date.getFullYear() === now.getFullYear()) {
    return date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
  }
  return date.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

type ChatsScreenProps = {
  variant?: 'page' | 'rail';
};

export default function ChatsScreen({ variant = 'page' }: ChatsScreenProps) {
  const pageStyles = useMainScreenStyles();
  const colors = useTheme();
  const { visible: voicePlayerVisible } = useVoicePlayback();
  const hasDesktopSidebar = useIsDesktopSidebarVisible();
  const isRail = variant === 'rail';
  const localStyles = useThemedStyles((themeColors) => createStyles(themeColors, isRail));
  // На среднем экране (768–1023) чаты уже в split/rail, но сайдбара ещё нет —
  // оставляем MobileScreenHeader с меню вкладок.
  const showCompactNav = !hasDesktopSidebar;
  const router = useRouter();
  const pathname = usePathname();
  const {
    lastConversationUpdate,
    lastConversationDeleted,
    lastMessage,
    publishConversationUpdate,
  } = useRealtime();
  const { user } = useAuth();

  const [items, setItems] = useState<ConversationListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [pendingDelete, setPendingDelete] = useState<ConversationListItem | null>(null);
  const [pendingBlock, setPendingBlock] = useState<ConversationListItem | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [createGroupOpen, setCreateGroupOpen] = useState(false);
  const [creatingGroup, setCreatingGroup] = useState(false);
  const [menuTarget, setMenuTarget] = useState<ConversationListItem | null>(null);
  const [menuAnchor, setMenuAnchor] = useState<{ x: number; y: number; width: number; height: number } | null>(
    null,
  );
  const menuTriggerRefs = useRef<Record<string, View | null>>({});
  const itemsRef = useRef<ConversationListItem[]>([]);
  itemsRef.current = items;

  const load = useCallback(async () => {
    try {
      const next = await listConversations();
      setItems((prev) => {
        // Only merge onto conversations that still exist on the server.
        // Stale local rows (already deleted for everyone) must not resurrect.
        const merged = next.map((incoming) => {
          const local = prev.find((item) => item.id === incoming.id);
          if (!local || local.updatedAt <= incoming.updatedAt) {
            return incoming;
          }
          return {
            ...local,
            isFavorite: incoming.isFavorite,
            peerFavoritedMe: incoming.peerFavoritedMe,
            blockedByMe: incoming.blockedByMe,
            blockedMe: incoming.blockedMe,
            isPinned: incoming.isPinned,
            pinSortOrder: incoming.pinSortOrder,
          };
        });
        return sortConversations(merged);
      });
    } catch (error) {
      toast.error(localizeErrorMessage(error, 'Не удалось загрузить чаты'));
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  useEffect(() => {
    if (!lastConversationUpdate) {
      return;
    }
    setItems((prev) => {
      const exists = prev.some((item) => item.id === lastConversationUpdate.id);
      const next = exists
        ? prev.map((item) =>
            item.id === lastConversationUpdate.id
              ? {
                  ...lastConversationUpdate,
                  isPinned: lastConversationUpdate.isPinned ?? item.isPinned,
                  pinSortOrder:
                    lastConversationUpdate.pinSortOrder ?? item.pinSortOrder ?? null,
                }
              : item,
          )
        : [lastConversationUpdate, ...prev];
      return sortConversations(next);
    });
  }, [lastConversationUpdate]);

  useEffect(() => {
    if (!lastMessage) {
      return;
    }

    if (!itemsRef.current.some((item) => item.id === lastMessage.conversationId)) {
      void load();
      return;
    }

    setItems((prev) => {
      const existing = prev.find((item) => item.id === lastMessage.conversationId);
      if (!existing) {
        return prev;
      }

      const mine = user?.id != null && lastMessage.senderId === user.id;
      const kind = lastMessage.kind ?? 'user';
      const nextItem: ConversationListItem = {
        ...existing,
        unread: mine ? existing.unread : true,
        updatedAt: lastMessage.createdAt,
        ...(kind === 'user_blocked'
          ? mine
            ? { isFavorite: false, peerFavoritedMe: existing.peerFavoritedMe, blockedByMe: true }
            : { blockedMe: true }
          : {}),
        ...(kind === 'user_unblocked'
          ? mine
            ? { blockedByMe: false }
            : { blockedMe: false }
          : {}),
        ...(kind === 'favorite_received'
          ? mine
            ? { isFavorite: true }
            : { peerFavoritedMe: true }
          : {}),
        ...(kind === 'favorite_removed'
          ? mine
            ? { isFavorite: false }
            : { peerFavoritedMe: false }
          : {}),
        lastMessage: {
          id: lastMessage.id,
          body: lastMessage.body,
          senderId: lastMessage.senderId,
          createdAt: lastMessage.createdAt,
          hasImage: Boolean(
            lastMessage.attachment?.kind === 'image' || lastMessage.image,
          ),
          attachmentKind: lastMessage.attachment?.kind ?? null,
          kind,
        },
      };

      const without = prev.filter((item) => item.id !== lastMessage.conversationId);
      return sortConversations([nextItem, ...without]);
    });
  }, [lastMessage, load, user?.id]);

  useEffect(() => {
    if (!lastConversationDeleted) {
      return;
    }
    setItems((prev) =>
      prev.filter((item) => item.id !== lastConversationDeleted.conversationId),
    );
  }, [lastConversationDeleted]);

  const handleDelete = useCallback(async (forEveryone: boolean) => {
    if (!pendingDelete) {
      return;
    }
    const targetId = pendingDelete.id;
    setIsDeleting(true);
    // Optimistic local remove — chat may already be gone on the server (404).
    setItems((prev) => prev.filter((item) => item.id !== targetId));
    setPendingDelete(null);
    if (pathname?.includes(targetId)) {
      router.replace('/chats');
    }
    try {
      await deleteConversation(targetId, forEveryone);
    } catch (error) {
      if (error instanceof ApiError && error.status === 404) {
        return;
      }
      toast.error(localizeErrorMessage(error, 'Не удалось удалить чат'));
      void load();
    } finally {
      setIsDeleting(false);
    }
  }, [load, pathname, pendingDelete, router]);

  const handleBlock = useCallback(
    async (deleteChat: boolean) => {
      if (!pendingBlock) {
        return;
      }
      setIsDeleting(true);
      try {
        const next = await blockPeer(pendingBlock.id);
        if (deleteChat) {
          await deleteConversation(pendingBlock.id, false);
          setItems((prev) => prev.filter((item) => item.id !== pendingBlock.id));
          if (pathname?.includes(pendingBlock.id)) {
            router.replace('/chats');
          }
        } else {
          setItems((prev) => prev.map((item) => (item.id === next.id ? next : item)));
        }
        toast.success(`${pendingBlock.peer?.nickname ?? 'Пользователь'} заблокирован`);
        setPendingBlock(null);
      } catch (error) {
        toast.error(localizeErrorMessage(error, 'Не удалось заблокировать'));
      } finally {
        setIsDeleting(false);
      }
    },
    [pathname, pendingBlock, router],
  );

  const handleUnblock = useCallback(async (item: ConversationListItem) => {
    if (!item.peer) {
      return;
    }
    try {
      const next = await unblockPeer(item.id);
      setItems((prev) => prev.map((row) => (row.id === next.id ? next : row)));
      toast.success(`${item.peer.nickname} разблокирован`);
    } catch (error) {
      toast.error(localizeErrorMessage(error, 'Не удалось разблокировать'));
    }
  }, []);

  const handleFavorite = useCallback(
    async (item: ConversationListItem) => {
      if (!item.peer || item.isFavorite || item.blockedByMe || item.blockedMe) {
        return;
      }
      try {
        await upsertWandererReaction(item.peer.id, 'favorite');
        const next = { ...item, isFavorite: true };
        setItems((prev) => prev.map((row) => (row.id === next.id ? next : row)));
        publishConversationUpdate(next);
        toast.success(`${item.peer.nickname} добавлен в избранные`);
      } catch (error) {
        toast.error(localizeErrorMessage(error, 'Не удалось добавить в избранные'));
      }
    },
    [publishConversationUpdate],
  );

  const handleUnfavorite = useCallback(
    async (item: ConversationListItem) => {
      if (!item.peer || !item.isFavorite || item.blockedByMe || item.blockedMe) {
        return;
      }
      try {
        await clearWandererReaction(item.peer.id);
        const next = { ...item, isFavorite: false };
        setItems((prev) => prev.map((row) => (row.id === next.id ? next : row)));
        publishConversationUpdate(next);
        toast.success(`${item.peer.nickname} удалён из избранных`);
      } catch (error) {
        toast.error(localizeErrorMessage(error, 'Не удалось удалить из избранных'));
      }
    },
    [publishConversationUpdate],
  );

  const handlePin = useCallback(
    async (item: ConversationListItem) => {
      if (item.isPinned) {
        return;
      }
      try {
        const next = await pinConversation(item.id);
        setItems((prev) =>
          sortConversations(prev.map((row) => (row.id === next.id ? next : row))),
        );
        publishConversationUpdate(next);
      } catch (error) {
        toast.error(localizeErrorMessage(error, 'Не удалось закрепить чат'));
      }
    },
    [publishConversationUpdate],
  );

  const handleUnpin = useCallback(
    async (item: ConversationListItem) => {
      if (!item.isPinned) {
        return;
      }
      try {
        const next = await unpinConversation(item.id);
        setItems((prev) =>
          sortConversations(
            prev.map((row) =>
              row.id === next.id
                ? next
                : row.isPinned
                  ? row
                  : row,
            ),
          ),
        );
        // Refresh pin order for remaining pinned after server renumbered them
        void load();
        publishConversationUpdate(next);
      } catch (error) {
        toast.error(localizeErrorMessage(error, 'Не удалось открепить чат'));
      }
    },
    [load, publishConversationUpdate],
  );

  const handlePinnedReorder = useCallback(
    (data: ConversationListItem[]) => {
      const pinned = data.filter((item) => item.isPinned);
      const unpinned = data
        .filter((item) => !item.isPinned)
        .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
      const nextPinned = pinned.map((item, index) => ({
        ...item,
        pinSortOrder: index,
      }));
      const next = [...nextPinned, ...unpinned];
      const prevPinnedIds = itemsRef.current
        .filter((item) => item.isPinned)
        .map((item) => item.id);
      const nextPinnedIds = nextPinned.map((item) => item.id);
      const orderChanged =
        prevPinnedIds.length === nextPinnedIds.length &&
        prevPinnedIds.some((id, index) => id !== nextPinnedIds[index]);

      setItems(next);
      if (!orderChanged || nextPinnedIds.length === 0) {
        return;
      }

      void reorderPinnedConversations(nextPinnedIds)
        .then((serverItems) => {
          setItems(sortConversations(serverItems));
        })
        .catch((error) => {
          toast.error(localizeErrorMessage(error, 'Не удалось сохранить порядок'));
          void load();
        });
    },
    [load],
  );

  const handleLeaveGroup = useCallback(
    async (item: ConversationListItem) => {
      setItems((prev) => prev.filter((row) => row.id !== item.id));
      if (pathname?.includes(item.id)) {
        router.replace('/chats');
      }
      try {
        await leaveGroup(item.id);
        toast.success(item.gameId ? 'Чат скрыт' : 'Вы вышли из группы');
      } catch (error) {
        toast.error(localizeErrorMessage(error, 'Не удалось выйти из группы'));
        void load();
      }
    },
    [load, pathname, router],
  );

  const handleCreateGroup = useCallback(
    async (title: string, memberIds: string[]) => {
      setCreatingGroup(true);
      try {
        const created = await createGroupChat(title, memberIds);
        setItems((prev) => {
          const without = prev.filter((item) => item.id !== created.id);
          return [created, ...without];
        });
        setCreateGroupOpen(false);
        router.push(`/chats/${created.id}`);
      } catch (error) {
        toast.error(localizeErrorMessage(error, 'Не удалось создать группу'));
      } finally {
        setCreatingGroup(false);
      }
    },
    [router],
  );

  const closeMenu = useCallback(() => {
    setMenuTarget(null);
    setMenuAnchor(null);
  }, []);

  const openMenu = useCallback((item: ConversationListItem) => {
    const trigger = menuTriggerRefs.current[item.id];
    if (!trigger) {
      setMenuTarget(item);
      return;
    }
    trigger.measureInWindow((x, y, width, height) => {
      setMenuAnchor({ x, y, width, height });
      setMenuTarget(item);
    });
  }, []);

  const menuStyle = menuAnchor
    ? {
        top: menuAnchor.y + menuAnchor.height + 6,
        left: Math.max(12, menuAnchor.x + menuAnchor.width - 200),
      }
    : menuTarget
      ? { top: 72, right: 16 }
      : null;

  const renderChatRow = useCallback(
    ({ item, drag, isActive }: RenderItemParams<ConversationListItem>) => {
      const group = isGroupChat(item);
      const title = conversationTitle(item);
      const initial = [...title.trim()][0]?.toUpperCase() ?? '?';
      const timeLabel = formatListTime(item.lastMessage?.createdAt ?? item.updatedAt);
      const selected = Boolean(pathname?.includes(`/chats/${item.id}`));
      const isFavorite =
        !group && Boolean(item.isFavorite) && !item.blockedByMe && !item.blockedMe;
      const isPinned = Boolean(item.isPinned);
      const previewMembers = item.membersPreview ?? [];

      return (
        <ScaleDecorator>
          <View
            style={[
              localStyles.row,
              selected && localStyles.rowSelected,
              isFavorite && localStyles.rowFavorite,
              isPinned && localStyles.rowPinned,
              isActive && localStyles.rowDragging,
            ]}>
            {isPinned ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Перетащить закреплённый чат"
                onLongPress={drag}
                delayLongPress={180}
                style={({ pressed }) => [
                  localStyles.dragHandle,
                  pressed && { opacity: 0.9 },
                ]}>
                <Ionicons name="reorder-two" size={18} color={colors.textMuted} />
              </Pressable>
            ) : null}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={title}
              onPress={() => {
                if (!isActive) {
                  router.push(`/chats/${item.id}`);
                }
              }}
              onLongPress={isPinned ? drag : undefined}
              delayLongPress={220}
              style={({ pressed }) => [
                localStyles.rowMain,
                pressed && !isActive && localStyles.rowPressed,
              ]}>
              <View style={localStyles.avatarWrap}>
                {group ? (
                  <View style={localStyles.groupAvatarStack}>
                    {(previewMembers.length > 0 ? previewMembers.slice(0, 2) : [null]).map(
                      (member, index) => {
                        const chipInitial =
                          [...(member?.nickname ?? title).trim()][0]?.toUpperCase() ?? '?';
                        return (
                          <View
                            key={member?.id ?? `empty-${index}`}
                            style={[
                              localStyles.groupAvatarChip,
                              {
                                left: index * 14,
                                top: index * 10,
                                zIndex: 2 - index,
                              },
                            ]}>
                            {member?.avatarUrl ? (
                              <Image
                                source={{ uri: member.avatarUrl }}
                                style={localStyles.groupAvatarChipImage}
                              />
                            ) : (
                              <Text style={localStyles.groupAvatarChipInitial}>{chipInitial}</Text>
                            )}
                          </View>
                        );
                      },
                    )}
                  </View>
                ) : (
                  <View style={[localStyles.avatar, isFavorite && localStyles.avatarFavorite]}>
                    {item.peer?.avatarUrl ? (
                      <Image
                        source={{ uri: item.peer.avatarUrl }}
                        style={localStyles.avatarImage}
                      />
                    ) : (
                      <View style={localStyles.avatarFill}>
                        <Text style={localStyles.avatarInitial}>{initial}</Text>
                      </View>
                    )}
                  </View>
                )}
                {isPinned ? (
                  <View style={localStyles.pinSeal} accessibilityLabel="Закреплён">
                    <Ionicons
                      name="attach"
                      size={12}
                      color={colors.primary}
                      style={{ transform: [{ rotate: '-45deg' }] }}
                    />
                  </View>
                ) : null}
                {isFavorite ? (
                  <View style={localStyles.favoriteSeal}>
                    <MaterialCommunityIcons name="crown" size={11} color="#E4C56A" />
                  </View>
                ) : null}
              </View>
              <View style={localStyles.body}>
                <View style={localStyles.nameRow}>
                  <Text
                    style={[localStyles.name, isFavorite && localStyles.nameFavorite]}
                    numberOfLines={1}>
                    {title}
                  </Text>
                  {isFavorite ? <Text style={localStyles.favoriteMark}>избранный</Text> : null}
                  {group ? (
                    <Text style={localStyles.groupMeta}>
                      {item.memberCount ?? previewMembers.length}
                    </Text>
                  ) : null}
                  {timeLabel ? <Text style={localStyles.time}>{timeLabel}</Text> : null}
                </View>
                <View style={localStyles.previewRow}>
                  <Text
                    style={[localStyles.preview, item.unread && localStyles.previewUnread]}
                    numberOfLines={1}>
                    {formatPreview(item)}
                  </Text>
                  {item.unread ? <View style={localStyles.unreadDot} /> : null}
                </View>
              </View>
            </Pressable>
            <View
              ref={(node) => {
                menuTriggerRefs.current[item.id] = node;
              }}
              collapsable={false}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Ещё"
                hitSlop={8}
                onPress={() => openMenu(item)}
                style={localStyles.menuButton}>
                <Ionicons name="ellipsis-vertical" size={16} color={colors.textSubtle} />
              </Pressable>
            </View>
          </View>
        </ScaleDecorator>
      );
    },
    [colors.primary, colors.textMuted, colors.textSubtle, localStyles, openMenu, pathname, router],
  );

  const content = (
      <View
        style={[
          isRail ? localStyles.container : pageStyles.container,
          !isRail && voicePlayerVisible ? { paddingTop: Spacing.md } : null,
        ]}>
        {showCompactNav ? (
          <View style={localStyles.headerRow}>
            <View style={{ flex: 1, minWidth: 0 }}>
              <MobileScreenHeader title="Чаты" />
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Новая группа"
              onPress={() => setCreateGroupOpen(true)}
              style={localStyles.newGroupButton}>
              <Ionicons name="people-outline" size={16} color={colors.primary} />
              <Text style={localStyles.newGroupLabel}>Группа</Text>
            </Pressable>
          </View>
        ) : (
          <View style={localStyles.headerRow}>
            <Text style={isRail ? localStyles.title : pageStyles.title}>Чаты</Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Новая группа"
              onPress={() => setCreateGroupOpen(true)}
              style={localStyles.newGroupButton}>
              <Ionicons name="people-outline" size={16} color={colors.primary} />
              <Text style={localStyles.newGroupLabel}>Группа</Text>
            </Pressable>
          </View>
        )}

        {loading ? (
          <View style={pageStyles.stateWrap}>
            <ActivityIndicator />
          </View>
        ) : items.length === 0 ? (
          <View style={localStyles.empty}>
            <Text style={localStyles.emptyTitle}>Пока нет переписок</Text>
            <Text style={localStyles.emptyHint}>
              Напишите страннику или соберите группу из тех, с кем уже переписывались.
            </Text>
          </View>
        ) : (
          <GestureHandlerRootView style={{ flex: 1, minHeight: 0 }}>
            <DraggableFlatList
              style={localStyles.list}
              contentContainerStyle={localStyles.listContent}
              data={items}
              keyExtractor={(item) => item.id}
              onDragEnd={({ data }) => handlePinnedReorder(data)}
              activationDistance={12}
              renderItem={renderChatRow}
            />
          </GestureHandlerRootView>
        )}

        <Modal
          visible={menuTarget != null}
          transparent
          animationType="fade"
          onRequestClose={closeMenu}>
          <View style={localStyles.menuRoot}>
            <Pressable style={localStyles.menuBackdrop} onPress={closeMenu} />
            {menuStyle ? (
              <View style={[localStyles.menu, menuStyle]}>
                {menuTarget && isGroupChat(menuTarget) ? (
                  <>
                    <Pressable
                      accessibilityRole="button"
                      onPress={() => {
                        const target = menuTarget;
                        closeMenu();
                        if (target) {
                          if (target.isPinned) {
                            void handleUnpin(target);
                          } else {
                            void handlePin(target);
                          }
                        }
                      }}
                      style={({ pressed }) => [
                        localStyles.menuItem,
                        pressed && localStyles.menuItemPressed,
                      ]}>
                      <Ionicons
                        name={menuTarget.isPinned ? 'attach' : 'attach-outline'}
                        size={18}
                        color={colors.primary}
                        style={menuTarget.isPinned ? { transform: [{ rotate: '-45deg' }] } : undefined}
                      />
                      <Text style={localStyles.menuItemLabel}>
                        {menuTarget.isPinned ? 'Открепить' : 'Закрепить'}
                      </Text>
                    </Pressable>
                    <Pressable
                      accessibilityRole="button"
                      onPress={() => {
                        const target = menuTarget;
                        closeMenu();
                        if (target) {
                          void handleLeaveGroup(target);
                        }
                      }}
                      style={({ pressed }) => [
                        localStyles.menuItem,
                        pressed && localStyles.menuItemPressed,
                      ]}>
                      <Ionicons name="exit-outline" size={18} color={colors.destructive} />
                      <Text style={localStyles.menuItemLabel}>
                        {menuTarget.gameId ? 'Скрыть чат' : 'Выйти из группы'}
                      </Text>
                    </Pressable>
                    <Pressable
                      accessibilityRole="button"
                      onPress={() => {
                        const target = menuTarget;
                        closeMenu();
                        if (target) {
                          setPendingDelete(target);
                        }
                      }}
                      style={({ pressed }) => [
                        localStyles.menuItem,
                        pressed && localStyles.menuItemPressed,
                      ]}>
                      <Ionicons name="trash-outline" size={18} color={colors.destructive} />
                      <Text style={localStyles.menuItemLabel}>Скрыть у себя</Text>
                    </Pressable>
                  </>
                ) : (
                  <>
                    {menuTarget ? (
                      <Pressable
                        accessibilityRole="button"
                        onPress={() => {
                          const target = menuTarget;
                          closeMenu();
                          if (target) {
                            if (target.isPinned) {
                              void handleUnpin(target);
                            } else {
                              void handlePin(target);
                            }
                          }
                        }}
                        style={({ pressed }) => [
                          localStyles.menuItem,
                          pressed && localStyles.menuItemPressed,
                        ]}>
                        <Ionicons
                          name={menuTarget.isPinned ? 'attach' : 'attach-outline'}
                          size={18}
                          color={colors.primary}
                          style={
                            menuTarget.isPinned ? { transform: [{ rotate: '-45deg' }] } : undefined
                          }
                        />
                        <Text style={localStyles.menuItemLabel}>
                          {menuTarget.isPinned ? 'Открепить' : 'Закрепить'}
                        </Text>
                      </Pressable>
                    ) : null}
                    {menuTarget &&
                    !menuTarget.isFavorite &&
                    !menuTarget.blockedByMe &&
                    !menuTarget.blockedMe ? (
                      <Pressable
                        accessibilityRole="button"
                        onPress={() => {
                          const target = menuTarget;
                          closeMenu();
                          if (target) {
                            void handleFavorite(target);
                          }
                        }}
                        style={({ pressed }) => [
                          localStyles.menuItem,
                          pressed && localStyles.menuItemPressed,
                        ]}>
                        <MaterialCommunityIcons name="crown" size={18} color="#C9A227" />
                        <Text style={[localStyles.menuItemLabel, localStyles.menuItemLabelFavorite]}>
                          В избранные
                        </Text>
                      </Pressable>
                    ) : null}
                    {menuTarget?.isFavorite &&
                    !menuTarget.blockedByMe &&
                    !menuTarget.blockedMe ? (
                      <Pressable
                        accessibilityRole="button"
                        onPress={() => {
                          const target = menuTarget;
                          closeMenu();
                          if (target) {
                            void handleUnfavorite(target);
                          }
                        }}
                        style={({ pressed }) => [
                          localStyles.menuItem,
                          pressed && localStyles.menuItemPressed,
                        ]}>
                        <CrownOffIcon size={18} color="#9A6B2F" />
                        <Text style={[localStyles.menuItemLabel, localStyles.menuItemLabelFavorite]}>
                          Убрать из избранных
                        </Text>
                      </Pressable>
                    ) : null}
                    {menuTarget && !menuTarget.blockedByMe ? (
                      <Pressable
                        accessibilityRole="button"
                        onPress={() => {
                          const target = menuTarget;
                          closeMenu();
                          if (target) {
                            setPendingBlock(target);
                          }
                        }}
                        style={({ pressed }) => [
                          localStyles.menuItem,
                          pressed && localStyles.menuItemPressed,
                        ]}>
                        <Ionicons name="ban-outline" size={18} color={colors.destructive} />
                        <Text style={localStyles.menuItemLabel}>Заблокировать</Text>
                      </Pressable>
                    ) : menuTarget?.blockedByMe ? (
                      <Pressable
                        accessibilityRole="button"
                        onPress={() => {
                          const target = menuTarget;
                          closeMenu();
                          if (target) {
                            void handleUnblock(target);
                          }
                        }}
                        style={({ pressed }) => [
                          localStyles.menuItem,
                          pressed && localStyles.menuItemPressed,
                        ]}>
                        <Ionicons name="lock-open-outline" size={18} color={colors.primary} />
                        <Text style={[localStyles.menuItemLabel, { color: colors.primary }]}>
                          Разблокировать
                        </Text>
                      </Pressable>
                    ) : null}
                    <Pressable
                      accessibilityRole="button"
                      onPress={() => {
                        const target = menuTarget;
                        closeMenu();
                        if (target) {
                          setPendingDelete(target);
                        }
                      }}
                      style={({ pressed }) => [
                        localStyles.menuItem,
                        pressed && localStyles.menuItemPressed,
                      ]}>
                      <Ionicons name="trash-outline" size={18} color={colors.destructive} />
                      <Text style={localStyles.menuItemLabel}>Удалить чат</Text>
                    </Pressable>
                  </>
                )}
              </View>
            ) : null}
          </View>
        </Modal>

        <CreateGroupDialog
          visible={createGroupOpen}
          contacts={contactsFromConversations(items)}
          isBusy={creatingGroup}
          onCancel={() => {
            if (!creatingGroup) {
              setCreateGroupOpen(false);
            }
          }}
          onSubmit={(title, memberIds) => void handleCreateGroup(title, memberIds)}
        />

        <DeleteChatDialog
          visible={pendingDelete != null}
          nickname={
            pendingDelete
              ? conversationTitle(pendingDelete)
              : ''
          }
          isDeleting={isDeleting}
          onDeleteForMe={() => void handleDelete(false)}
          onDeleteForEveryone={
            pendingDelete && isGroupChat(pendingDelete)
              ? undefined
              : () => void handleDelete(true)
          }
          onCancel={() => {
            if (!isDeleting) {
              setPendingDelete(null);
            }
          }}
        />
        <BlockUserDialog
          visible={pendingBlock != null}
          nickname={pendingBlock?.peer?.nickname ?? ''}
          isBusy={isDeleting}
          onConfirm={(deleteChat) => void handleBlock(deleteChat)}
          onCancel={() => {
            if (!isDeleting) {
              setPendingBlock(null);
            }
          }}
        />
      </View>
  );

  if (isRail) {
    return content;
  }

  return <ScreenTransition animateOnFocus>{content}</ScreenTransition>;
}
