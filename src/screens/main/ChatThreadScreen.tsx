import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import * as DocumentPicker from 'expo-document-picker';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Keyboard,
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import type {
  NativeScrollEvent,
  NativeSyntheticEvent,
  TextInputKeyPressEventData,
} from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { FlatList } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { MobileBackButton } from '@/components/navigation/MobileBackButton';
import { resolveChatReturnHref } from '@/components/navigation/navigate-back';
import { UserAvatar } from '@/components/navigation/UserAvatar';
import { useIsDesktopSidebarVisible, useIsDesktopWeb } from '@/components/navigation/DesktopThemeToggle';
import { ScreenTransition } from '@/components/navigation/ScreenTransition';
import { BlockUserDialog } from '@/components/chats/BlockUserDialog';
import { ChatAlbumGrid } from '@/components/chats/ChatAlbumGrid';
import { ChatDiceBubble } from '@/components/chats/ChatDiceBubble';
import {
  ChatDiceOverlay,
  type ChatDiceLocalRollRequest,
  type ChatDiceOverlayRequest,
} from '@/components/chats/ChatDiceOverlay';
import type { DiceRollOutcome } from '@/components/dice/dice-stage.types';
import { ChatDicePopover } from '@/components/chats/ChatDicePopover';
import { ChatEmojiPanel } from '@/components/chats/ChatEmojiPanel';
import { ChatForwardPicker } from '@/components/chats/ChatForwardPicker';
import { ChatImageLightbox } from '@/components/chats/ChatImageLightbox';
import { ChatMessageActionsSheet } from '@/components/chats/ChatMessageActionsSheet';
import { ChatMessageBody } from '@/components/chats/ChatMessageBody';
import { ChatMessagePressable } from '@/components/chats/ChatMessagePressable';
import { ChatReplyQuote, type ChatReplyPreviewData } from '@/components/chats/ChatReplyQuote';
import { ChatAudioPlayer } from '@/components/chats/ChatAudioPlayer';
import { ChatVoiceComposer } from '@/components/chats/ChatVoiceComposer';
import { CrownOffIcon } from '@/components/chats/CrownOffIcon';
import { DeleteChatDialog } from '@/components/chats/DeleteChatDialog';
import { GroupMembersSheet } from '@/components/chats/GroupMembersSheet';
import { toast } from '@/components/ui';
import { FontSize, Radius, Spacing } from '@/constants/theme';
import type { ThemeColors } from '@/constants/theme';
import { MAX_UPLOAD_SIZE_MB, MAX_UPLOAD_SIZE_MESSAGE } from '@/constants/upload.config';
import { useAuth } from '@/context/AuthContext';
import { usePushPrompt } from '@/context/PushPromptContext';
import { useRealtime } from '@/context/RealtimeContext';
import { useVoicePlayback, type ChatVoiceQueueItem } from '@/context/VoicePlaybackContext';
import { useTheme, useThemePreference } from '@/hooks/use-theme';
import { useThemedStyles } from '@/hooks/use-themed-styles';
import {
  listConversations,
  listMessages,
  listChatMembers,
  leaveGroup,
  markConversationRead,
  sendChatMessage,
  sendChatDiceRoll,
  forwardChatMessages,
  blockPeer,
  unblockPeer,
  deleteConversation,
  MAX_CHAT_ATTACHMENTS,
  normalizeMessageAttachments,
} from '@/services/chats/chatsApi';
import type {
  ChatAttachment,
  ChatAttachmentKind,
  ChatMember,
  ChatMessage,
  ConversationListItem,
} from '@/services/chats/chatsApi';
import { ApiError } from '@/services/api/api-error';
import { upsertWandererReaction, clearWandererReaction } from '@/services/profile/wanderersApi';
import {
  diceRollPreviewText,
  parseDiceRollPayload,
  type DiceRollMode,
} from '@/utils/chat-dice-roll';
import {
  getDiceAnimationSpeedSync,
  loadDiceAnimationSpeed,
  subscribeDiceAnimationSpeed,
} from '@/utils/dice-animations-storage';
import { localizeErrorMessage } from '@/utils/localizeError';
import {
  getCachedFileTooLargeMessage,
  getCachedUploadLimits,
} from '@/utils/upload-limits';

function isGroupConversation(item: ConversationListItem | null | undefined) {
  return item?.type === 'group';
}

type PendingAttachment = {
  id: string;
  uri: string;
  name: string;
  mimeType: string;
  kind: ChatAttachmentKind;
  isObjectUrl?: boolean;
};

function attachmentKindFromMime(mimeType: string): ChatAttachmentKind {
  if (mimeType.startsWith('image/')) {
    return 'image';
  }
  if (mimeType.startsWith('audio/')) {
    return 'audio';
  }
  return 'file';
}

function attachmentIcon(kind: ChatAttachmentKind): keyof typeof Ionicons.glyphMap {
  if (kind === 'audio') {
    return 'musical-notes-outline';
  }
  if (kind === 'image') {
    return 'image-outline';
  }
  return 'document-outline';
}

function downloadChatAttachment(url: string, fileName: string) {
  if (Platform.OS === 'web' && typeof document !== 'undefined') {
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = fileName || 'attachment';
    anchor.target = '_blank';
    anchor.rel = 'noopener noreferrer';
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    return;
  }

  void Linking.openURL(url);
}

function isFileDragEvent(event: DragEvent) {
  const types = Array.from(event.dataTransfer?.types ?? []);
  return types.includes('Files') || (event.dataTransfer?.files?.length ?? 0) > 0;
}

function extensionForImageMime(mimeType: string) {
  if (mimeType === 'image/jpeg' || mimeType === 'image/jpg') {
    return 'jpg';
  }
  if (mimeType === 'image/webp') {
    return 'webp';
  }
  if (mimeType === 'image/gif') {
    return 'gif';
  }
  return 'png';
}

function normalizeClipboardImageFile(file: File) {
  const mimeType = file.type || 'image/png';
  const hasRealName =
    Boolean(file.name?.trim()) &&
    file.name !== 'image.png' &&
    file.name !== 'blob' &&
    file.name !== 'untitled';

  if (hasRealName) {
    return file;
  }

  return new File([file], `screenshot-${Date.now()}.${extensionForImageMime(mimeType)}`, {
    type: mimeType,
    lastModified: Date.now(),
  });
}

function getClipboardImageFiles(clipboardData: DataTransfer | null): File[] {
  if (!clipboardData) {
    return [];
  }

  const collected: File[] = [];
  const seen = new Set<string>();

  const push = (file: File | null) => {
    if (!file || !file.type.startsWith('image/')) {
      return;
    }
    const normalized = normalizeClipboardImageFile(file);
    const key = `${normalized.name}:${normalized.size}:${normalized.lastModified}`;
    if (seen.has(key)) {
      return;
    }
    seen.add(key);
    collected.push(normalized);
  };

  const items = clipboardData.items;
  if (items) {
    for (let index = 0; index < items.length; index += 1) {
      const item = items[index];
      if (!item || item.kind !== 'file' || !item.type.startsWith('image/')) {
        continue;
      }
      push(item.getAsFile());
    }
  }

  const files = clipboardData.files;
  if (files) {
    for (let index = 0; index < files.length; index += 1) {
      push(files[index] ?? null);
    }
  }

  return collected;
}

function fullUrlForAttachment(attachment: ChatAttachment): string | null {
  return (
    attachment.image?.original ??
    attachment.image?.large ??
    attachment.image?.medium ??
    attachment.image?.thumb ??
    attachment.url
  );
}

function getWebHostNode(ref: View | null): HTMLElement | null {
  if (!ref || typeof document === 'undefined') {
    return null;
  }
  const host = ref as unknown as HTMLElement & {
    _nativeNode?: HTMLElement;
    getNode?: () => unknown;
  };
  if (host instanceof HTMLElement) {
    return host;
  }
  if (host._nativeNode instanceof HTMLElement) {
    return host._nativeNode;
  }
  const node = host.getNode?.();
  return node instanceof HTMLElement ? node : null;
}

function BubbleTail({ color, side }: { color: string; side: 'left' | 'right' }) {
  return (
    <Svg
      width={11}
      height={16}
      viewBox="0 0 11 16"
      style={[
        { position: 'absolute', bottom: 0 },
        side === 'left' ? { left: -5 } : { right: -5 },
      ]}>
      {side === 'left' ? (
        <Path d="M11 0C11 8.5 7.5 13.5 0 16H11V0Z" fill={color} />
      ) : (
        <Path d="M0 0C0 8.5 3.5 13.5 11 16H0V0Z" fill={color} />
      )}
    </Svg>
  );
}

function formatMessageTime(iso: string) {
  try {
    return new Date(iso).toLocaleTimeString('ru-RU', {
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '';
  }
}

function startOfLocalDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

function formatChatDayLabel(iso: string, now = new Date()) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return '';
  }

  const todayStart = startOfLocalDay(now);
  const dayStart = startOfLocalDay(date);
  const dayDiff = Math.round((todayStart - dayStart) / 86_400_000);

  if (dayDiff === 0) {
    return 'Сегодня';
  }

  if (dayDiff === 1) {
    return 'Вчера';
  }

  if (date.getFullYear() === now.getFullYear()) {
    return date.toLocaleDateString('ru-RU', {
      day: 'numeric',
      month: 'long',
    });
  }

  return date.toLocaleDateString('ru-RU', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

function formatMessageFullDateTime(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return '';
  }

  const datePart = date.toLocaleDateString('ru-RU', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
  const timePart = date.toLocaleTimeString('ru-RU', {
    hour: '2-digit',
    minute: '2-digit',
  });

  return `${datePart}, ${timePart}`;
}

type ChatTimelineItem =
  | { type: 'date'; id: string; label: string }
  | { type: 'message'; id: string; message: ChatMessage; showAuthorMeta: boolean };

function isSystemChatMessage(message: ChatMessage) {
  const kind = message.kind;
  return (
    kind === 'favorite_received' ||
    kind === 'favorite_removed' ||
    kind === 'user_blocked' ||
    kind === 'user_unblocked' ||
    kind === 'game_deleted'
  );
}

function buildChatTimeline(
  messages: ChatMessage[],
  options: { isGroup: boolean; myId?: string },
): ChatTimelineItem[] {
  const items: ChatTimelineItem[] = [];
  let previousDayStart: number | null = null;

  for (let index = 0; index < messages.length; index += 1) {
    const message = messages[index];
    const date = new Date(message.createdAt);
    const dayStart = Number.isNaN(date.getTime()) ? null : startOfLocalDay(date);

    if (dayStart != null && previousDayStart !== dayStart) {
      const label = formatChatDayLabel(message.createdAt);
      if (label) {
        items.push({
          type: 'date',
          id: `date-${dayStart}`,
          label,
        });
      }
      previousDayStart = dayStart;
    }

    const mine = Boolean(options.myId && message.senderId === options.myId);
    const previous = index > 0 ? messages[index - 1] : null;
    let showAuthorMeta = false;

    if (options.isGroup && !mine && !isSystemChatMessage(message)) {
      const previousDay =
        previous && !Number.isNaN(new Date(previous.createdAt).getTime())
          ? startOfLocalDay(new Date(previous.createdAt))
          : null;
      const breaksSeries =
        !previous ||
        isSystemChatMessage(previous) ||
        previous.senderId !== message.senderId ||
        previousDay !== dayStart;
      showAuthorMeta = breaksSeries;
    }

    items.push({
      type: 'message',
      id: message.id,
      message,
      showAuthorMeta,
    });
  }

  return items;
}

function formatLastSeen(online: boolean, lastSeenAt: string | null) {
  if (online) {
    return 'в сети';
  }

  if (!lastSeenAt) {
    return 'давно';
  }

  const date = new Date(lastSeenAt);
  if (Number.isNaN(date.getTime())) {
    return 'давно';
  }

  const now = Date.now();
  const diffMs = Math.max(0, now - date.getTime());
  const diffMin = Math.floor(diffMs / 60_000);
  const diffHours = Math.floor(diffMs / 3_600_000);

  if (diffMin < 1) {
    return 'только что';
  }

  if (diffMin < 60) {
    return `${diffMin} мин. назад`;
  }

  const time = date.toLocaleTimeString('ru-RU', {
    hour: '2-digit',
    minute: '2-digit',
  });

  const nowDate = new Date(now);
  const startOfToday = new Date(nowDate.getFullYear(), nowDate.getMonth(), nowDate.getDate());
  const startOfThatDay = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const dayDiff = Math.round((startOfToday.getTime() - startOfThatDay.getTime()) / 86_400_000);

  if (dayDiff === 0) {
    if (diffHours < 4) {
      return `${diffHours} ч. назад`;
    }
    return `сегодня в ${time}`;
  }

  if (dayDiff === 1) {
    return `вчера в ${time}`;
  }

  if (dayDiff < 7) {
    const weekday = date.toLocaleDateString('ru-RU', { weekday: 'short' });
    return `${weekday} в ${time}`;
  }

  if (date.getFullYear() === nowDate.getFullYear()) {
    return date.toLocaleDateString('ru-RU', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  return date.toLocaleDateString('ru-RU', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function createStyles(colors: ThemeColors, bottomPad: number, isDark: boolean) {
  return StyleSheet.create({
    root: {
      flex: 1,
      minHeight: 0,
      backgroundColor: colors.background,
      position: 'relative',
    },
    dropZone: {
      flex: 1,
      minHeight: 0,
      position: 'relative',
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.sm,
      paddingHorizontal: Spacing.md,
      paddingBottom: Spacing.sm,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.borderLight,
      backgroundColor: colors.surface,
    },
    headerAvatarWrap: {
      width: 40,
      height: 40,
      flexShrink: 0,
    },
    headerAvatar: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: colors.avatar,
      overflow: 'hidden',
      alignItems: 'center',
      justifyContent: 'center',
    },
    headerAvatarImage: {
      width: '100%',
      height: '100%',
    },
    headerAvatarFill: {
      ...StyleSheet.absoluteFill,
      backgroundColor: colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    headerAvatarInitial: {
      fontSize: 16,
      fontWeight: '700',
      color: colors.onPrimary,
    },
    headerPeer: {
      flex: 1,
      minWidth: 0,
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.sm,
    },
    headerPeerPressed: {
      opacity: 0.75,
    },
    headerText: {
      flex: 1,
      minWidth: 0,
      gap: 2,
      justifyContent: 'center',
    },
    headerTitle: {
      fontSize: 18,
      fontWeight: '700',
      color: colors.text,
    },
    headerStatus: {
      fontSize: FontSize.caption,
      color: colors.textMuted,
    },
    headerStatusOnline: {
      color: colors.success,
      fontWeight: '600',
    },
    senderName: {
      fontSize: 12,
      fontWeight: '700',
      color: colors.primary,
      marginBottom: 2,
      alignSelf: 'flex-start',
      maxWidth: '100%',
    },
    authorAvatarCol: {
      width: 30,
      marginRight: 8,
      alignItems: 'center',
      justifyContent: 'flex-end',
      alignSelf: 'flex-end',
      paddingBottom: 2,
    },
    authorAvatarButton: {
      borderRadius: 15,
    },
    authorAvatarSpacer: {
      width: 30,
      height: 30,
    },
    headerMenuButton: {
      width: 36,
      height: 36,
      borderRadius: 18,
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
    },
    favoriteInvite: {
      marginHorizontal: Spacing.md,
      marginTop: Spacing.sm,
      marginBottom: 2,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingVertical: 10,
      paddingHorizontal: 12,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: isDark ? 'rgba(240, 215, 140, 0.45)' : 'rgba(201, 162, 39, 0.28)',
      backgroundColor: isDark ? '#3A3018' : 'rgba(255, 248, 225, 0.95)',
    },
    favoriteInviteIcon: {
      width: 36,
      height: 36,
      borderRadius: 18,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: isDark ? 'rgba(240, 215, 140, 0.16)' : 'rgba(201, 162, 39, 0.16)',
      flexShrink: 0,
    },
    favoriteInviteCopy: {
      flex: 1,
      minWidth: 0,
      gap: 2,
    },
    favoriteInviteTitle: {
      fontSize: FontSize.label,
      fontWeight: '700',
      color: isDark ? '#FFE9A8' : '#8B6914',
    },
    favoriteInviteHint: {
      fontSize: FontSize.caption,
      color: isDark ? '#E8D48B' : '#A8842A',
      lineHeight: FontSize.caption * 1.35,
    },
    favoriteInviteButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 4,
      minHeight: 34,
      paddingHorizontal: 12,
      borderRadius: Radius.pill,
      backgroundColor: '#C9A227',
      flexShrink: 0,
    },
    favoriteInviteButtonCancel: {
      backgroundColor: 'transparent',
      borderWidth: 1,
      borderColor: isDark ? 'rgba(240, 215, 140, 0.45)' : 'rgba(201, 162, 39, 0.55)',
    },
    favoriteInviteButtonRemove: {
      borderColor: isDark ? 'rgba(232, 184, 122, 0.5)' : 'rgba(154, 107, 47, 0.5)',
    },
    favoriteInviteButtonPressed: {
      opacity: 0.88,
    },
    favoriteInviteButtonLabel: {
      fontSize: 12,
      fontWeight: '700',
      color: '#FFFFFF',
    },
    favoriteInviteButtonLabelCancel: {
      color: isDark ? '#FFE9A8' : '#9A7518',
    },
    favoriteInviteButtonLabelRemove: {
      color: isDark ? '#FFD19A' : '#7A4E1D',
    },
    favoriteInviteRemoved: {
      borderColor: isDark ? 'rgba(232, 184, 122, 0.45)' : 'rgba(154, 107, 47, 0.35)',
      backgroundColor: isDark ? '#3A2818' : 'rgba(255, 243, 224, 0.96)',
    },
    favoriteInviteIconRemoved: {
      backgroundColor: isDark ? 'rgba(232, 184, 122, 0.16)' : 'rgba(154, 107, 47, 0.14)',
    },
    favoriteInviteTitleRemoved: {
      color: isDark ? '#FFD19A' : '#7A4E1D',
    },
    systemNoticeRow: {
      width: '100%',
      alignItems: 'center',
      paddingVertical: 6,
      paddingHorizontal: 8,
    },
    dateDividerRow: {
      width: '100%',
      alignItems: 'center',
      paddingVertical: Spacing.sm,
      paddingHorizontal: Spacing.md,
    },
    dateDividerChip: {
      paddingHorizontal: Spacing.md,
      paddingVertical: 4,
      borderRadius: Radius.pill,
      backgroundColor: colors.surfaceMuted,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.borderLight,
    },
    dateDividerText: {
      fontSize: FontSize.caption,
      fontWeight: '600',
      color: colors.textMuted,
    },
    favoriteNotice: {
      maxWidth: '100%',
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      paddingVertical: 10,
      paddingHorizontal: 12,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: isDark ? 'rgba(240, 215, 140, 0.45)' : 'rgba(201, 162, 39, 0.22)',
      backgroundColor: isDark ? '#3A3018' : 'rgba(255, 248, 225, 0.92)',
    },
    favoriteNoticeRemoved: {
      borderColor: isDark ? 'rgba(232, 184, 122, 0.45)' : 'rgba(154, 107, 47, 0.28)',
      backgroundColor: isDark ? '#3A2818' : 'rgba(255, 243, 224, 0.94)',
    },
    favoriteNoticeIconWrap: {
      width: 28,
      height: 28,
      borderRadius: 14,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: isDark ? 'rgba(240, 215, 140, 0.16)' : 'rgba(201, 162, 39, 0.16)',
      flexShrink: 0,
    },
    favoriteNoticeIconWrapRemoved: {
      backgroundColor: isDark ? 'rgba(232, 184, 122, 0.16)' : 'rgba(154, 107, 47, 0.14)',
    },
    favoriteNoticeBody: {
      flexShrink: 1,
      minWidth: 0,
      gap: 2,
    },
    favoriteNoticeText: {
      fontSize: FontSize.label,
      color: isDark ? '#E8D48B' : '#9A7518',
      lineHeight: FontSize.label * 1.4,
      flexShrink: 1,
    },
    favoriteNoticeName: {
      fontWeight: '700',
      // Не colors.text: на светлой плашке в dark theme белый текст пропадает.
      color: isDark ? '#FFF1C2' : '#5C4A10',
    },
    favoriteNoticeMeta: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    favoriteNoticeDot: {
      width: 3,
      height: 3,
      borderRadius: 1.5,
      backgroundColor: isDark ? 'rgba(232, 212, 139, 0.55)' : 'rgba(154, 117, 24, 0.35)',
    },
    favoriteNoticeTime: {
      fontSize: 11,
      color: isDark ? '#D4BC6E' : colors.textMuted,
    },
    menuRoot: {
      flex: 1,
    },
    menuBackdrop: {
      ...StyleSheet.absoluteFillObject,
    },
    menu: {
      position: 'absolute',
      right: Spacing.md,
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
      color: isDark ? '#FFE9A8' : '#9A7518',
    },
    blockedBanner: {
      paddingHorizontal: Spacing.md,
      paddingVertical: Spacing.md,
      backgroundColor: colors.surface,
      borderTopWidth: 1,
      borderTopColor: colors.borderLight,
    },
    blockedBannerText: {
      fontSize: FontSize.label,
      color: colors.textMuted,
      textAlign: 'center',
    },
    list: {
      flex: 1,
      minHeight: 0,
      ...(Platform.OS === 'web'
        ? ({
            overflow: 'auto',
            WebkitOverflowScrolling: 'touch',
            touchAction: 'pan-y',
          } as object)
        : null),
    },
    listContent: {
      paddingHorizontal: Spacing.md,
      paddingVertical: Spacing.md,
      gap: 6,
    },
    bubbleRow: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      paddingHorizontal: 4,
      ...(Platform.OS === 'web'
        ? ({ userSelect: 'none', WebkitUserSelect: 'none' } as object)
        : null),
    },
    bubbleRowMine: {
      justifyContent: 'flex-end',
    },
    bubbleShell: {
      maxWidth: '78%',
      position: 'relative',
      ...Platform.select({
        web: {
          width: 'fit-content',
          maxWidth: '78%',
        },
        default: {},
      }),
    },
    bubbleShellMine: {
      alignSelf: 'flex-end',
    },
    bubble: {
      borderRadius: 14,
      borderBottomLeftRadius: 4,
      paddingHorizontal: 10,
      paddingTop: 6,
      paddingBottom: 6,
      // На тёмной теме surfaceMuted почти сливается с фоном — чуть светлее.
      backgroundColor: isDark ? '#2C2C2E' : colors.surfaceMuted,
    },
    bubbleMine: {
      borderBottomLeftRadius: 14,
      borderBottomRightRadius: 4,
      backgroundColor: colors.primary,
    },
    bubbleHighlighted: {
      shadowColor: colors.primary,
      shadowOpacity: 0.55,
      shadowRadius: 10,
      shadowOffset: { width: 0, height: 0 },
      elevation: 6,
      borderWidth: 1.5,
      borderColor: colors.primaryLight,
    },
    forwardLabel: {
      fontSize: 11,
      fontWeight: '600',
      color: colors.primary,
      marginBottom: 4,
    },
    forwardLabelMine: {
      color: 'rgba(255,255,255,0.88)',
    },
    replyInBubble: {
      marginBottom: 6,
      minWidth: 120,
    },
    selectMark: {
      width: 24,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 4,
    },
    selectionBar: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.sm,
      paddingHorizontal: Spacing.md,
      paddingVertical: Spacing.sm,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.borderLight,
      backgroundColor: colors.surface,
    },
    selectionCancel: {
      fontSize: FontSize.caption,
      color: colors.textMuted,
      fontWeight: '600',
    },
    selectionCount: {
      flex: 1,
      fontSize: FontSize.caption,
      color: colors.text,
      fontWeight: '600',
    },
    selectionForward: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      backgroundColor: colors.primary,
      borderRadius: Radius.pill,
      paddingHorizontal: 12,
      paddingVertical: 8,
    },
    selectionForwardDisabled: {
      opacity: 0.45,
    },
    selectionForwardLabel: {
      color: colors.onPrimary,
      fontSize: FontSize.caption,
      fontWeight: '700',
    },
    replyBar: {
      marginBottom: Spacing.sm,
    },
    bubbleContent: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      alignItems: 'flex-end',
      columnGap: 6,
      rowGap: 2,
    },
    bubbleText: {
      fontSize: FontSize.label,
      color: isDark ? '#FFFFFF' : colors.text,
      lineHeight: FontSize.label * 1.35,
      flexShrink: 1,
    },
    bubbleTextMine: {
      color: colors.onPrimary,
    },
    favoriteReplyButton: {
      marginTop: 8,
      alignSelf: 'flex-start',
      minHeight: 32,
      paddingHorizontal: Spacing.md,
      borderRadius: Radius.pill,
      borderWidth: 1,
      borderColor: colors.primary,
      backgroundColor: colors.surface,
      alignItems: 'center',
      justifyContent: 'center',
    },
    favoriteReplyButtonPressed: {
      opacity: 0.85,
    },
    favoriteReplyLabel: {
      fontSize: FontSize.caption,
      fontWeight: '600',
      color: colors.primary,
    },
    bubbleLink: {
      color: colors.primary,
      fontWeight: '600',
    },
    bubbleLinkMine: {
      color: '#E8F1FF',
      fontWeight: '700',
    },
    bubbleImage: {
      width: 180,
      maxWidth: '100%',
      aspectRatio: 4 / 3,
      borderRadius: 8,
      backgroundColor: colors.placeholderAlt,
      marginBottom: 4,
    },
    metaRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 3,
      paddingBottom: 1,
    },
    metaTime: {
      fontSize: 10,
      lineHeight: 12,
      color: colors.textMuted,
    },
    metaTimeMine: {
      color: 'rgba(255,255,255,0.72)',
    },
    composerShell: {
      position: 'relative',
      overflow: 'visible',
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.borderLight,
      backgroundColor: colors.background,
      paddingHorizontal: Spacing.md,
      paddingTop: Spacing.sm,
      paddingBottom: bottomPad,
    },
    composer: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      minHeight: 52,
      overflow: 'visible',
      paddingHorizontal: 6,
      paddingVertical: 6,
      borderRadius: 26,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
    },
    iconButton: {
      width: 40,
      height: 40,
      borderRadius: 20,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.surfaceMuted,
      flexShrink: 0,
    },
    iconButtonActive: {
      backgroundColor: 'rgba(21, 122, 254, 0.12)',
    },
    composerField: {
      flex: 1,
      minWidth: 0,
      justifyContent: 'center',
    },
    input: {
      width: '100%',
      minHeight: 40,
      maxHeight: 120,
      paddingHorizontal: Spacing.sm,
      paddingVertical: Platform.OS === 'web' ? 10 : 8,
      fontSize: FontSize.input,
      color: colors.text,
      backgroundColor: 'transparent',
      borderWidth: 0,
      outlineStyle: 'none',
    },
    sendButton: {
      width: 40,
      height: 40,
      borderRadius: 20,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.surfaceMuted,
      flexShrink: 0,
    },
    sendButtonReady: {
      backgroundColor: colors.primary,
    },
    sendButtonDisabled: {
      opacity: 1,
    },
    pendingStrip: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: Spacing.sm,
      paddingHorizontal: Spacing.md,
      paddingTop: Spacing.sm,
      backgroundColor: colors.surface,
    },
    pendingThumbWrap: {
      position: 'relative',
      width: 84,
      height: 84,
    },
    pendingImage: {
      width: 84,
      height: 84,
      borderRadius: 12,
    },
    pendingFileChip: {
      width: 84,
      height: 84,
      borderRadius: 12,
      padding: Spacing.sm,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 4,
      backgroundColor: colors.surfaceMuted,
      borderWidth: 1,
      borderColor: colors.borderLight,
    },
    pendingFileName: {
      fontSize: 10,
      textAlign: 'center',
      color: colors.text,
    },
    pendingClear: {
      position: 'absolute',
      top: 4,
      right: 4,
      width: 24,
      height: 24,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.borderLight,
    },
    pendingBusy: {
      ...StyleSheet.absoluteFill,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'rgba(0,0,0,0.35)',
    },
    bubbleAttachment: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.sm,
      marginBottom: 2,
      maxWidth: 240,
    },
    bubbleAttachmentMine: {
      backgroundColor: 'transparent',
    },
    bubbleAttachmentName: {
      flexShrink: 1,
      fontSize: FontSize.label,
      color: colors.text,
    },
    bubbleAttachmentNameMine: {
      color: colors.onPrimary,
    },
    dropOverlay: {
      ...StyleSheet.absoluteFillObject,
      zIndex: 20,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'rgba(32, 138, 239, 0.12)',
      borderWidth: 2,
      borderStyle: 'dashed',
      borderColor: colors.primary,
      margin: Spacing.sm,
      borderRadius: 16,
    },
    dropOverlayCard: {
      alignItems: 'center',
      gap: Spacing.sm,
      paddingHorizontal: Spacing.lg,
      paddingVertical: Spacing.md,
      borderRadius: 14,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.borderLight,
    },
    dropOverlayTitle: {
      fontSize: FontSize.button,
      fontWeight: '700',
      color: colors.text,
    },
    dropOverlayHint: {
      fontSize: FontSize.caption,
      color: colors.textMuted,
    },
  });
}

export default function ChatThreadScreen() {
  const { id, returnTo, returnToId } = useLocalSearchParams<{
    id: string;
    returnTo?: string | string[];
    returnToId?: string | string[];
  }>();
  const conversationId = Array.isArray(id) ? id[0] : id;
  const backHref = resolveChatReturnHref(returnTo, returnToId);
  const router = useRouter();
  const colors = useTheme();
  const { colorScheme } = useThemePreference();
  const isDark = colorScheme === 'dark';
  const insets = useSafeAreaInsets();
  const isDesktopWeb = useIsDesktopWeb();
  const hasDesktopSidebar = useIsDesktopSidebarVisible();
  const { user } = useAuth();
  const { requestAfterFirstMessage } = usePushPrompt();
  const { lastConversationUpdate, lastConversationRead, lastConversationDeleted, lastPresence, subscribeMessages, publishConversationUpdate } =
    useRealtime();
  const bottomPad = hasDesktopSidebar ? Spacing.md : Math.max(insets.bottom, Spacing.sm);
  const styles = useThemedStyles((themeColors) => createStyles(themeColors, bottomPad, isDark));

  const [conversation, setConversation] = useState<ConversationListItem | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [peerLastReadAt, setPeerLastReadAt] = useState<string | null>(null);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const {
    activeKey: activeVoiceKey,
    playingKey: playingVoiceKey,
    play: playVoice,
    toggle: toggleVoice,
    syncQueue: syncVoiceQueue,
    visible: voicePlayerVisible,
  } = useVoicePlayback();
  const [draft, setDraft] = useState('');
  const [pendingAttachments, setPendingAttachments] = useState<PendingAttachment[]>([]);
  const [lightbox, setLightbox] = useState<{ uris: string[]; index: number } | null>(null);
  const [isDraggingFile, setIsDraggingFile] = useState(false);
  const [emojiPanelOpen, setEmojiPanelOpen] = useState(false);
  const emojiPanelOpenRef = useRef(false);
  const [addingBack, setAddingBack] = useState(false);
  const [suppressFavoriteBack, setSuppressFavoriteBack] = useState(false);
  const [unblocking, setUnblocking] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [pendingDelete, setPendingDelete] = useState(false);
  const [pendingBlock, setPendingBlock] = useState(false);
  const [isMenuBusy, setIsMenuBusy] = useState(false);
  const [membersOpen, setMembersOpen] = useState(false);
  const [members, setMembers] = useState<ChatMember[]>([]);
  const [membersLoading, setMembersLoading] = useState(false);
  const [replyTo, setReplyTo] = useState<ChatReplyPreviewData | null>(null);
  const [actionMessage, setActionMessage] = useState<ChatMessage | null>(null);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [forwardOpen, setForwardOpen] = useState(false);
  const [forwardBusy, setForwardBusy] = useState(false);
  const [highlightedMessageId, setHighlightedMessageId] = useState<string | null>(null);
  const [dicePopoverOpen, setDicePopoverOpen] = useState(false);
  const [diceRollBusy, setDiceRollBusy] = useState(false);
  const [diceOverlayRequest, setDiceOverlayRequest] = useState<ChatDiceOverlayRequest | null>(
    null,
  );
  const [localDiceRoll, setLocalDiceRoll] = useState<ChatDiceLocalRollRequest | null>(null);
  const localDiceRollTokenRef = useRef(0);
  const localDiceRollResolveRef = useRef<((outcome: DiceRollOutcome | null) => void) | null>(
    null,
  );
  const skipDiceAnimIdsRef = useRef(new Set<string>());
  /** Пока свой бросок в полёте — сокет часто приходит раньше HTTP и иначе крутит вторую анимацию. */
  const suppressOwnDiceAnimRef = useRef(false);
  const listRef = useRef<FlatList<ChatTimelineItem>>(null);
  const timelineRef = useRef<ChatTimelineItem[]>([]);
  const highlightTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stickToBottomRef = useRef(true);
  const loadingOlderRef = useRef(false);
  const pinningScrollRef = useRef(false);
  const contentHeightRef = useRef(0);
  const layoutHeightRef = useRef(0);
  const dropZoneRef = useRef<View>(null);
  const draftRef = useRef('');
  const pendingAttachmentsRef = useRef<PendingAttachment[]>([]);
  const sendingRef = useRef(false);
  const blockedMeRef = useRef(false);
  const composerFieldWrapRef = useRef<View>(null);
  const composerInputRef = useRef<TextInput>(null);
  const selectionRef = useRef({ start: 0, end: 0 });
  const heldDiceMessagesRef = useRef(new Map<string, ChatMessage>());
  const [heldDiceIds, setHeldDiceIds] = useState<string[]>([]);
  const diceAnimQueueRef = useRef<ChatDiceOverlayRequest[]>([]);
  const diceAnimationsEnabledRef = useRef(getDiceAnimationSpeedSync() !== 'off');
  const myId = user?.id;

  draftRef.current = draft;
  pendingAttachmentsRef.current = pendingAttachments;
  sendingRef.current = sending;
  blockedMeRef.current = Boolean(conversation?.blockedMe);

  useEffect(() => {
    void loadDiceAnimationSpeed().then((speed) => {
      diceAnimationsEnabledRef.current = speed !== 'off';
    });
    return subscribeDiceAnimationSpeed((speed) => {
      diceAnimationsEnabledRef.current = speed !== 'off';
    });
  }, []);

  const pinToBottom = useCallback(() => {
    const layoutHeight = layoutHeightRef.current;
    if (layoutHeight <= 0) {
      return;
    }
    const offset = Math.max(0, contentHeightRef.current - layoutHeight);
    pinningScrollRef.current = true;
    listRef.current?.scrollToOffset({ offset, animated: false });
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        pinningScrollRef.current = false;
      });
    });
  }, []);

  const scrollToBottom = useCallback(() => {
    stickToBottomRef.current = true;
    pinToBottom();
  }, [pinToBottom]);

  const appendMessage = useCallback((message: ChatMessage) => {
    setMessages((prev) => {
      if (prev.some((item) => item.id === message.id)) {
        return prev;
      }
      return [...prev, message];
    });
  }, []);

  const startNextDiceAnimation = useCallback(() => {
    const next = diceAnimQueueRef.current.shift() ?? null;
    setDiceOverlayRequest(next);
  }, []);

  const revealHeldDiceMessage = useCallback((messageId: string) => {
    const held = heldDiceMessagesRef.current.get(messageId);
    if (held) {
      heldDiceMessagesRef.current.delete(messageId);
      setHeldDiceIds((prev) => prev.filter((id) => id !== messageId));
      appendMessage(held);
      scrollToBottom();
      return;
    }
    setHeldDiceIds((prev) => prev.filter((id) => id !== messageId));
  }, [appendMessage, scrollToBottom]);

  const advanceDiceAnimationQueue = useCallback(() => {
    startNextDiceAnimation();
  }, [startNextDiceAnimation]);

  const ingestIncomingMessage = useCallback(
    (message: ChatMessage) => {
      if (message.kind !== 'dice_roll') {
        appendMessage(message);
        return;
      }

      const skipAnim =
        skipDiceAnimIdsRef.current.has(message.id) ||
        (Boolean(myId) &&
          message.senderId === myId &&
          suppressOwnDiceAnimRef.current);

      if (skipAnim) {
        skipDiceAnimIdsRef.current.delete(message.id);
        appendMessage(message);
        return;
      }

      const payload = parseDiceRollPayload(message.body);
      const canAnimate =
        diceAnimationsEnabledRef.current &&
        payload &&
        !payload.redacted &&
        payload.sum != null &&
        (Platform.OS !== 'web' ||
          (typeof document !== 'undefined' && document.visibilityState === 'visible'));

      if (!canAnimate || !payload) {
        appendMessage(message);
        return;
      }

      if (heldDiceMessagesRef.current.has(message.id)) {
        return;
      }

      heldDiceMessagesRef.current.set(message.id, message);
      setHeldDiceIds((prev) => (prev.includes(message.id) ? prev : [...prev, message.id]));
      const request: ChatDiceOverlayRequest = {
        messageId: message.id,
        payload,
        senderNickname: message.sender?.nickname ?? 'Игрок',
      };

      setDiceOverlayRequest((current) => {
        if (current) {
          if (
            current.messageId !== request.messageId &&
            !diceAnimQueueRef.current.some((item) => item.messageId === request.messageId)
          ) {
            diceAnimQueueRef.current.push(request);
          }
          return current;
        }
        return request;
      });
    },
    [appendMessage, myId],
  );

  const clearPendingAttachments = useCallback(() => {
    for (const item of pendingAttachmentsRef.current) {
      if (item.isObjectUrl) {
        URL.revokeObjectURL(item.uri);
      }
    }
    pendingAttachmentsRef.current = [];
    setPendingAttachments([]);
  }, []);

  const removePendingAttachment = useCallback((id: string) => {
    setPendingAttachments((prev) => {
      const target = prev.find((item) => item.id === id);
      if (target?.isObjectUrl) {
        URL.revokeObjectURL(target.uri);
      }
      const next = prev.filter((item) => item.id !== id);
      pendingAttachmentsRef.current = next;
      return next;
    });
  }, []);

  const appendPendingAttachments = useCallback((items: PendingAttachment[]) => {
    if (items.length === 0) {
      return;
    }
    const limitToast = (batch: PendingAttachment[]) => {
      const allImages = batch.every((item) => item.kind === 'image');
      toast.warning(
        allImages
          ? `Можно отправить не более ${MAX_CHAT_ATTACHMENTS} изображений за раз`
          : `Можно отправить не более ${MAX_CHAT_ATTACHMENTS} файлов за раз`,
      );
    };

    setPendingAttachments((prev) => {
      const room = MAX_CHAT_ATTACHMENTS - prev.length;
      if (room <= 0) {
        for (const item of items) {
          if (item.isObjectUrl) {
            URL.revokeObjectURL(item.uri);
          }
        }
        limitToast([...prev, ...items]);
        return prev;
      }
      if (items.length > room) {
        for (const item of items.slice(room)) {
          if (item.isObjectUrl) {
            URL.revokeObjectURL(item.uri);
          }
        }
        limitToast([...prev, ...items]);
      }
      const next = [...prev, ...items.slice(0, room)];
      pendingAttachmentsRef.current = next;
      return next;
    });
  }, []);

  useEffect(() => {
    return () => {
      for (const item of pendingAttachmentsRef.current) {
        if (item.isObjectUrl) {
          URL.revokeObjectURL(item.uri);
        }
      }
    };
  }, []);

  useEffect(() => {
    setEmojiPanelOpen(false);
  }, [conversationId]);

  useEffect(() => {
    emojiPanelOpenRef.current = emojiPanelOpen;
  }, [emojiPanelOpen]);

  useEffect(() => {
    if (Platform.OS === 'web') {
      return;
    }
    const closeEmojiOnKeyboard = Keyboard.addListener('keyboardDidShow', () => {
      if (emojiPanelOpenRef.current) {
        setEmojiPanelOpen(false);
      }
    });
    return () => closeEmojiOnKeyboard.remove();
  }, []);

  const openEmojiPanel = useCallback(() => {
    if (Platform.OS !== 'web') {
      Keyboard.dismiss();
      composerInputRef.current?.blur();
    }
    setEmojiPanelOpen(true);
  }, []);

  const closeEmojiPanel = useCallback((focusInput = false) => {
    setEmojiPanelOpen(false);
    if (focusInput) {
      requestAnimationFrame(() => {
        composerInputRef.current?.focus();
      });
    }
  }, []);

  const toggleEmojiPanel = useCallback(() => {
    if (emojiPanelOpenRef.current) {
      closeEmojiPanel(true);
      return;
    }
    openEmojiPanel();
  }, [closeEmojiPanel, openEmojiPanel]);

  const handleComposerFocus = useCallback(() => {
    if (!emojiPanelOpenRef.current) {
      return;
    }
    // На ПК/вебе поле и панель эмодзи живут вместе — фокус не должен её закрывать.
    if (Platform.OS === 'web') {
      return;
    }
    setEmojiPanelOpen(false);
    // Первый фокус мог пройти с showSoftInputOnFocus=false — дожимаем клавиатуру.
    requestAnimationFrame(() => {
      composerInputRef.current?.focus();
    });
  }, []);

  const loadConversation = useCallback(async () => {
    if (!conversationId) {
      return null;
    }
    const list = await listConversations();
    const found = list.find((item) => item.id === conversationId) ?? null;
    setConversation(found);
    if (found) {
      setPeerLastReadAt(found.peerLastReadAt);
    }
    return found;
  }, [conversationId]);

  const loadMessages = useCallback(async () => {
    if (!conversationId) {
      return;
    }
    const page = await listMessages(conversationId);
    setMessages((prev) => {
      const byId = new Map(page.items.map((item) => [item.id, item]));
      for (const item of prev) {
        if (!byId.has(item.id)) {
          byId.set(item.id, item);
        }
      }
      // Сообщения в hold для анимации кубов не показываем до onReveal.
      for (const heldId of heldDiceMessagesRef.current.keys()) {
        byId.delete(heldId);
      }
      return [...byId.values()].sort((left, right) =>
        left.createdAt.localeCompare(right.createdAt),
      );
    });
    setNextCursor(page.nextCursor);
    setPeerLastReadAt(page.peerLastReadAt);
    setConversation((prev) =>
      prev
        ? {
            ...prev,
            blockedByMe: page.blockedByMe ?? prev.blockedByMe,
            blockedMe: page.blockedMe ?? prev.blockedMe,
          }
        : prev,
    );
  }, [conversationId]);

  useEffect(() => {
    let cancelled = false;

    function leaveToChats(message?: string) {
      if (cancelled) {
        return;
      }
      if (message) {
        toast.error(message);
      }
      router.replace('/chats');
    }

    async function bootstrap() {
      if (!conversationId) {
        leaveToChats();
        return;
      }
      setSuppressFavoriteBack(false);
      setLoading(true);
      try {
        const [found] = await Promise.all([loadConversation(), loadMessages()]);
        if (!found) {
          leaveToChats('Чат не найден');
          return;
        }
        await markConversationRead(conversationId);
      } catch (error) {
        const missing =
          error instanceof ApiError && (error.status === 404 || error.status === 403);
        leaveToChats(
          missing
            ? 'Чат не найден'
            : localizeErrorMessage(error, 'Не удалось открыть чат'),
        );
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void bootstrap();
    return () => {
      cancelled = true;
      heldDiceMessagesRef.current.clear();
      diceAnimQueueRef.current = [];
      setHeldDiceIds([]);
      setDiceOverlayRequest(null);
      setLocalDiceRoll(null);
      suppressOwnDiceAnimRef.current = false;
      const resolveLocal = localDiceRollResolveRef.current;
      localDiceRollResolveRef.current = null;
      resolveLocal?.(null);
    };
  }, [conversationId, loadConversation, loadMessages, router]);

  useEffect(() => {
    return subscribeMessages((message) => {
      if (!conversationId || message.conversationId !== conversationId) {
        return;
      }
      ingestIncomingMessage(message);
      if (message.kind === 'favorite_received') {
        if (message.senderId !== myId) {
          setSuppressFavoriteBack(false);
        }
        setConversation((prev) => {
          if (!prev || prev.id !== message.conversationId) {
            return prev;
          }
          if (message.senderId === myId) {
            return { ...prev, isFavorite: true };
          }
          return { ...prev, peerFavoritedMe: true };
        });
      }
      if (message.kind === 'favorite_removed') {
        if (message.senderId === myId) {
          setSuppressFavoriteBack(true);
        }
        setConversation((prev) => {
          if (!prev || prev.id !== message.conversationId) {
            return prev;
          }
          if (message.senderId === myId) {
            return { ...prev, isFavorite: false };
          }
          return { ...prev, peerFavoritedMe: false };
        });
      }
      if (message.senderId === myId || stickToBottomRef.current) {
        if (message.kind !== 'dice_roll' || !heldDiceMessagesRef.current.has(message.id)) {
          scrollToBottom();
        }
      }
      void markConversationRead(conversationId);
    });
  }, [conversationId, ingestIncomingMessage, myId, scrollToBottom, subscribeMessages]);

  useEffect(() => {
    if (!lastConversationUpdate || lastConversationUpdate.id !== conversationId) {
      return;
    }
    setConversation(lastConversationUpdate);
    setPeerLastReadAt(lastConversationUpdate.peerLastReadAt);
  }, [conversationId, lastConversationUpdate]);

  useEffect(() => {
    if (!lastConversationDeleted || lastConversationDeleted.conversationId !== conversationId) {
      return;
    }
    router.replace('/chats');
  }, [conversationId, lastConversationDeleted, router]);

  useEffect(() => {
    if (!lastConversationRead || lastConversationRead.conversationId !== conversationId) {
      return;
    }
    if (lastConversationRead.readerId === myId) {
      return;
    }
    setPeerLastReadAt(lastConversationRead.lastReadAt);
  }, [conversationId, lastConversationRead, myId]);

  useEffect(() => {
    if (!lastPresence) {
      return;
    }
    setConversation((prev) => {
      if (!prev?.peer || prev.peer.id !== lastPresence.userId) {
        return prev;
      }
      return {
        ...prev,
        peer: {
          ...prev.peer,
          online: lastPresence.online,
          lastSeenAt: lastPresence.lastSeenAt,
        },
      };
    });
  }, [lastPresence]);

  useEffect(() => {
    return () => {
      if (highlightTimerRef.current) {
        clearTimeout(highlightTimerRef.current);
      }
    };
  }, []);

  const isGroup = isGroupConversation(conversation);
  const title = isGroup
    ? conversation?.title?.trim() || 'Группа'
    : conversation?.peer?.nickname ?? 'Чат';
  const peerInitial = [...title.trim()][0]?.toUpperCase() ?? '?';
  const statusLabel = isGroup
    ? `${conversation?.memberCount ?? members.length} участников`
    : conversation?.peer
      ? formatLastSeen(conversation.peer.online, conversation.peer.lastSeenAt)
      : '';

  const hasMessageText = Boolean(draft.trim());
  const canSend =
    Boolean(hasMessageText || pendingAttachments.length > 0) &&
    !sending &&
    !conversation?.blockedMe;

  const acceptDroppedFiles = useCallback(
    (inputFiles: File[]) => {
      if (inputFiles.length === 0) {
        return;
      }

      const maxBytes =
        getCachedUploadLimits()?.maxUploadBytes ?? MAX_UPLOAD_SIZE_MB * 1024 * 1024;
      const next: PendingAttachment[] = [];

      for (const file of inputFiles) {
        if (file.size > maxBytes) {
          toast.error(getCachedFileTooLargeMessage() ?? MAX_UPLOAD_SIZE_MESSAGE);
          continue;
        }
        const mimeType = file.type || 'application/octet-stream';
        const objectUrl = URL.createObjectURL(file);
        next.push({
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
          uri: objectUrl,
          name: file.name || 'Файл',
          mimeType,
          kind: attachmentKindFromMime(mimeType),
          isObjectUrl: true,
        });
      }

      appendPendingAttachments(next);
    },
    [appendPendingAttachments],
  );

  const pickAttachment = useCallback(async () => {
    setEmojiPanelOpen(false);
    try {
      const result = await DocumentPicker.getDocumentAsync({
        copyToCacheDirectory: true,
        multiple: true,
      });

      if (result.canceled || !result.assets?.length) {
        return;
      }

      const next: PendingAttachment[] = result.assets.map((asset) => {
        const mimeType = asset.mimeType ?? 'application/octet-stream';
        return {
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
          uri: asset.uri,
          name: asset.name || 'Файл',
          mimeType,
          kind: attachmentKindFromMime(mimeType),
        };
      });
      appendPendingAttachments(next);
    } catch {
      toast.error('Не удалось выбрать файл');
    }
  }, [appendPendingAttachments]);

  const insertEmoji = useCallback((emoji: string) => {
    const current = draftRef.current;
    const selection = selectionRef.current;
    const start = Math.min(selection.start, current.length);
    const end = Math.min(selection.end, current.length);
    const next = `${current.slice(0, start)}${emoji}${current.slice(end)}`;
    const nextCursor = start + emoji.length;
    draftRef.current = next;
    selectionRef.current = { start: nextCursor, end: nextCursor };
    setDraft(next);
    if (Platform.OS !== 'web' && emojiPanelOpenRef.current) {
      composerInputRef.current?.setNativeProps?.({
        selection: { start: nextCursor, end: nextCursor },
      });
      return;
    }
    requestAnimationFrame(() => {
      composerInputRef.current?.focus();
      composerInputRef.current?.setNativeProps?.({
        selection: { start: nextCursor, end: nextCursor },
      });
    });
  }, []);

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') {
      return;
    }

    const isInsideDropZone = (target: EventTarget | null) => {
      const node = getWebHostNode(dropZoneRef.current);
      if (!node) {
        return true;
      }
      return target instanceof Node && node.contains(target);
    };

    const onDragOver = (event: DragEvent) => {
      if (!isFileDragEvent(event)) {
        return;
      }
      event.preventDefault();
      if (isInsideDropZone(event.target)) {
        if (event.dataTransfer) {
          event.dataTransfer.dropEffect = 'copy';
        }
        setIsDraggingFile(true);
      } else {
        setIsDraggingFile(false);
      }
    };

    const onDragLeave = (event: DragEvent) => {
      if (event.relatedTarget == null) {
        setIsDraggingFile(false);
      }
    };

    const onDrop = (event: DragEvent) => {
      if (!isFileDragEvent(event)) {
        return;
      }
      event.preventDefault();
      setIsDraggingFile(false);
      if (!isInsideDropZone(event.target)) {
        return;
      }
      const files = Array.from(event.dataTransfer?.files ?? []);
      if (files.length > 0) {
        acceptDroppedFiles(files);
      }
    };

    const onPaste = (event: ClipboardEvent) => {
      if (blockedMeRef.current) {
        return;
      }

      const zone = getWebHostNode(dropZoneRef.current);
      const target = event.target;
      if (!zone || !(target instanceof Node) || !zone.contains(target)) {
        return;
      }

      const imageFiles = getClipboardImageFiles(event.clipboardData);
      if (imageFiles.length === 0) {
        return;
      }

      event.preventDefault();
      acceptDroppedFiles(imageFiles);
    };

    document.addEventListener('dragenter', onDragOver);
    document.addEventListener('dragover', onDragOver);
    document.addEventListener('dragleave', onDragLeave);
    document.addEventListener('drop', onDrop);
    document.addEventListener('paste', onPaste);

    return () => {
      document.removeEventListener('dragenter', onDragOver);
      document.removeEventListener('dragover', onDragOver);
      document.removeEventListener('dragleave', onDragLeave);
      document.removeEventListener('drop', onDrop);
      document.removeEventListener('paste', onPaste);
    };
  }, [acceptDroppedFiles]);

  const handleSend = useCallback(async () => {
    if (!conversationId || sendingRef.current || blockedMeRef.current) {
      return;
    }

    const body = draftRef.current;
    const attachments = pendingAttachmentsRef.current;
    if (!body.trim() && attachments.length === 0) {
      return;
    }

    const replyToId = replyTo?.id;
    setSending(true);
    sendingRef.current = true;
    try {
      const message = await sendChatMessage(conversationId, {
        body,
        replyToId,
        files: attachments.map((item) => ({
          uri: item.uri,
          name: item.name,
          mimeType: item.mimeType,
        })),
      });
      setDraft('');
      draftRef.current = '';
      selectionRef.current = { start: 0, end: 0 };
      setEmojiPanelOpen(false);
      setReplyTo(null);
      clearPendingAttachments();
      setMessages((prev) => {
        if (prev.some((item) => item.id === message.id)) {
          return prev;
        }
        return [...prev, message];
      });
      scrollToBottom();
      requestAfterFirstMessage();
    } catch (error) {
      toast.error(localizeErrorMessage(error, 'Не удалось отправить'));
    } finally {
      setSending(false);
      sendingRef.current = false;
    }
  }, [clearPendingAttachments, conversationId, replyTo?.id, requestAfterFirstMessage, scrollToBottom]);

  const handleLocalDiceRollComplete = useCallback((outcome: DiceRollOutcome | null) => {
    const resolve = localDiceRollResolveRef.current;
    localDiceRollResolveRef.current = null;
    setLocalDiceRoll(null);
    resolve?.(outcome);
  }, []);

  const handleDiceRoll = useCallback(
    async (input: {
      dice: { sides: number; qty: number }[];
      modifier: number;
      hidden: boolean;
      color: string;
      mode: DiceRollMode;
    }) => {
      if (!conversationId || diceRollBusy || conversation?.blockedMe || localDiceRoll) {
        return;
      }
      setDiceRollBusy(true);
      suppressOwnDiceAnimRef.current = true;
      // На всякий случай не крутить чужую очередь поверх своего броска.
      diceAnimQueueRef.current = [];
      setDiceOverlayRequest(null);
      setDicePopoverOpen(false);
      setEmojiPanelOpen(false);
      emojiPanelOpenRef.current = false;

      const token = ++localDiceRollTokenRef.current;
      const outcome = await new Promise<DiceRollOutcome | null>((resolve) => {
        localDiceRollResolveRef.current = resolve;
        setLocalDiceRoll({
          token,
          dice: input.dice,
          modifier: input.modifier,
          color: input.color,
          senderNickname: user?.nickname ?? 'Вы',
          mode: input.mode,
        });
      });

      try {
        if (!outcome || outcome.groups.length === 0) {
          toast.error('Не удалось бросить кости');
          return;
        }

        let message = await sendChatDiceRoll(conversationId, {
          ...input,
          groups: outcome.groups.map((group) => ({
            sides: group.sides,
            values: group.values,
          })),
          ...(input.mode !== 'normal' ? { mode: input.mode } : {}),
        });
        const rolled = parseDiceRollPayload(message.body);
        if (rolled && !rolled.color && input.color) {
          message = {
            ...message,
            body: JSON.stringify({ ...rolled, color: input.color }),
          };
        }
        // Уже показали анимацию со своими цифрами — в ленту без повтора.
        skipDiceAnimIdsRef.current.add(message.id);
        appendMessage(message);
        scrollToBottom();
      } catch (error) {
        toast.error(localizeErrorMessage(error, 'Не удалось бросить кости'));
      } finally {
        suppressOwnDiceAnimRef.current = false;
        setDiceRollBusy(false);
      }
    },
    [
      appendMessage,
      conversation?.blockedMe,
      conversationId,
      diceRollBusy,
      localDiceRoll,
      scrollToBottom,
      user?.nickname,
    ],
  );

  const toReplyPreview = useCallback((message: ChatMessage): ChatReplyPreviewData => {
    const attachments = normalizeMessageAttachments(message);
    const dicePayload =
      message.kind === 'dice_roll' ? parseDiceRollPayload(message.body) : null;
    return {
      id: message.id,
      senderNickname: message.sender?.nickname ?? 'Игрок',
      body: dicePayload ? diceRollPreviewText(dicePayload) : message.body,
      hasMedia: attachments.length > 0,
    };
  }, []);

  const clearSelection = useCallback(() => {
    setSelectionMode(false);
    setSelectedIds([]);
  }, []);

  const openMessageActions = useCallback((message: ChatMessage) => {
    if (isSystemChatMessage(message)) {
      return;
    }
    if (selectionMode) {
      setSelectedIds((prev) =>
        prev.includes(message.id)
          ? prev.filter((id) => id !== message.id)
          : [...prev, message.id],
      );
      return;
    }
    setActionMessage(message);
  }, [selectionMode]);

  const handleStartReply = useCallback(
    (message: ChatMessage) => {
      setActionMessage(null);
      clearSelection();
      setReplyTo(toReplyPreview(message));
      requestAnimationFrame(() => composerInputRef.current?.focus());
    },
    [clearSelection, toReplyPreview],
  );

  const handleStartForward = useCallback((messageIds: string[]) => {
    if (messageIds.length === 0) {
      return;
    }
    setActionMessage(null);
    setSelectedIds(messageIds);
    setForwardOpen(true);
  }, []);

  const handleEnterSelection = useCallback((message: ChatMessage) => {
    setActionMessage(null);
    setSelectionMode(true);
    setSelectedIds([message.id]);
  }, []);

  const scrollToMessage = useCallback((messageId: string) => {
    const index = timelineRef.current.findIndex(
      (item) => item.type === 'message' && item.id === messageId,
    );
    if (index < 0) {
      toast.error('Исходное сообщение недоступно');
      return;
    }
    stickToBottomRef.current = false;
    listRef.current?.scrollToIndex({
      index,
      animated: true,
      viewPosition: 0.35,
    });
    if (highlightTimerRef.current) {
      clearTimeout(highlightTimerRef.current);
    }
    setHighlightedMessageId(messageId);
    highlightTimerRef.current = setTimeout(() => {
      setHighlightedMessageId(null);
      highlightTimerRef.current = null;
    }, 1600);
  }, []);

  const handleForwardToChat = useCallback(
    async (targetConversationId: string) => {
      if (selectedIds.length === 0 || forwardBusy) {
        return;
      }
      setForwardBusy(true);
      try {
        const created = await forwardChatMessages(targetConversationId, selectedIds);
        setForwardOpen(false);
        clearSelection();
        if (targetConversationId === conversationId) {
          setMessages((prev) => {
            const known = new Set(prev.map((item) => item.id));
            return [...prev, ...created.filter((item) => !known.has(item.id))];
          });
          scrollToBottom();
        }
        toast.success(
          created.length === 1 ? 'Сообщение переслано' : `Переслано: ${created.length}`,
        );
      } catch (error) {
        toast.error(localizeErrorMessage(error, 'Не удалось переслать'));
      } finally {
        setForwardBusy(false);
      }
    },
    [clearSelection, conversationId, forwardBusy, scrollToBottom, selectedIds],
  );

  const handleAddBack = useCallback(async () => {
    const peerId = conversation?.peer?.id;
    if (!peerId || !conversation || addingBack || conversation.isFavorite) {
      return;
    }
    setAddingBack(true);
    try {
      await upsertWandererReaction(peerId, 'favorite');
      const next = { ...conversation, isFavorite: true };
      setConversation(next);
      publishConversationUpdate(next);
      toast.success('Добавлен в избранные');
    } catch (error) {
      toast.error(localizeErrorMessage(error, 'Не удалось добавить в избранные'));
    } finally {
      setAddingBack(false);
    }
  }, [addingBack, conversation, publishConversationUpdate]);

  const handleCancelFavorite = useCallback(async () => {
    const peerId = conversation?.peer?.id;
    if (!peerId || !conversation || addingBack || !conversation.isFavorite) {
      return;
    }
    setAddingBack(true);
    setSuppressFavoriteBack(true);
    try {
      await clearWandererReaction(peerId);
      const next = { ...conversation, isFavorite: false };
      setConversation(next);
      publishConversationUpdate(next);
      toast.success('Удалён из избранных');
    } catch (error) {
      setSuppressFavoriteBack(false);
      toast.error(localizeErrorMessage(error, 'Не удалось удалить из избранных'));
    } finally {
      setAddingBack(false);
    }
  }, [addingBack, conversation, publishConversationUpdate]);

  const handleOpenMenu = useCallback(() => {
    setMenuOpen(true);
  }, []);

  const handleCloseMenu = useCallback(() => {
    setMenuOpen(false);
  }, []);

  const handleDeleteChat = useCallback(
    async (forEveryone: boolean) => {
      if (!conversationId) {
        return;
      }
      setIsMenuBusy(true);
      setPendingDelete(false);
      router.replace('/chats');
      try {
        await deleteConversation(conversationId, forEveryone);
      } catch (error) {
        if (!(error instanceof ApiError && error.status === 404)) {
          toast.error(localizeErrorMessage(error, 'Не удалось удалить чат'));
        }
      } finally {
        setIsMenuBusy(false);
      }
    },
    [conversationId, router],
  );

  const handleBlock = useCallback(
    async (deleteChat: boolean) => {
      if (!conversationId || !conversation?.peer) {
        return;
      }
      const nickname = conversation.peer.nickname;
      setIsMenuBusy(true);
      try {
        const next = await blockPeer(conversationId);
        setConversation(next);
        setPendingBlock(false);
        toast.success(`${nickname} заблокирован`);
        if (deleteChat) {
          await deleteConversation(conversationId, false);
          router.replace('/chats');
        }
      } catch (error) {
        toast.error(localizeErrorMessage(error, 'Не удалось заблокировать'));
      } finally {
        setIsMenuBusy(false);
      }
    },
    [conversation, conversationId, router],
  );

  const handleLeaveGroup = useCallback(async () => {
    if (!conversationId || !conversation || !isGroupConversation(conversation)) {
      return;
    }
    setIsMenuBusy(true);
    setMenuOpen(false);
    router.replace('/chats');
    try {
      await leaveGroup(conversationId);
      toast.success(conversation.gameId ? 'Чат скрыт' : 'Вы вышли из группы');
    } catch (error) {
      toast.error(localizeErrorMessage(error, 'Не удалось выйти из группы'));
    } finally {
      setIsMenuBusy(false);
    }
  }, [conversation, conversationId, router]);

  const handleOpenMembers = useCallback(async () => {
    if (!conversationId || !isGroupConversation(conversation)) {
      return;
    }
    setMembersOpen(true);
    setMembersLoading(true);
    try {
      const next = await listChatMembers(conversationId);
      setMembers(next);
    } catch (error) {
      toast.error(localizeErrorMessage(error, 'Не удалось загрузить участников'));
      setMembersOpen(false);
    } finally {
      setMembersLoading(false);
    }
  }, [conversation, conversationId]);

  const handleUnblock = useCallback(async () => {
    if (!conversationId || !conversation || unblocking) {
      return;
    }
    setMenuOpen(false);
    setUnblocking(true);
    try {
      const next = await unblockPeer(conversationId);
      setConversation(next);
      await loadMessages();
      toast.success(`${conversation.peer?.nickname ?? 'Пользователь'} разблокирован`);
    } catch (error) {
      toast.error(localizeErrorMessage(error, 'Не удалось разблокировать'));
    } finally {
      setUnblocking(false);
    }
  }, [conversation, conversationId, loadMessages, unblocking]);

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') {
      return;
    }

    let field: Element | null = null;
    let frame = 0;

    const onKeyDown = (event: Event) => {
      const keyboardEvent = event as KeyboardEvent;
      if (keyboardEvent.key !== 'Enter' || keyboardEvent.shiftKey) {
        return;
      }
      keyboardEvent.preventDefault();
      keyboardEvent.stopPropagation();
      void handleSend();
    };

    const attach = () => {
      const wrap = getWebHostNode(composerFieldWrapRef.current);
      field =
        wrap?.querySelector('textarea, input, [contenteditable="true"]') ??
        document.getElementById('chat-composer-input');
      if (!field) {
        frame = requestAnimationFrame(attach);
        return;
      }
      field.addEventListener('keydown', onKeyDown);
    };

    attach();

    return () => {
      cancelAnimationFrame(frame);
      field?.removeEventListener('keydown', onKeyDown);
    };
  }, [handleSend, loading]);

  const handleKeyPress = useCallback(
    (event: NativeSyntheticEvent<TextInputKeyPressEventData>) => {
      // На телефоне Enter — новая строка; отправка только кнопкой.
      if (Platform.OS !== 'web') {
        return;
      }
      const key = event.nativeEvent.key;
      const shiftKey = Boolean(
        (event.nativeEvent as TextInputKeyPressEventData & { shiftKey?: boolean }).shiftKey,
      );
      if (key === 'Enter' && !shiftKey) {
        event.preventDefault?.();
        void handleSend();
      }
    },
    [handleSend],
  );

  const loadOlder = useCallback(async () => {
    if (!conversationId || !nextCursor) {
      return;
    }
    loadingOlderRef.current = true;
    stickToBottomRef.current = false;
    try {
      const page = await listMessages(conversationId, nextCursor);
      setMessages((prev) => {
        const ids = new Set(prev.map((item) => item.id));
        const older = page.items.filter((item) => !ids.has(item.id));
        return [...older, ...prev];
      });
      setNextCursor(page.nextCursor);
      if (page.peerLastReadAt) {
        setPeerLastReadAt(page.peerLastReadAt);
      }
    } catch {
      // ignore pagination errors
    } finally {
      requestAnimationFrame(() => {
        loadingOlderRef.current = false;
      });
    }
  }, [conversationId, nextCursor]);

  const headerPadTop = isDesktopWeb
    ? Spacing.md
    : voicePlayerVisible
      ? Spacing.sm
      : insets.top + Spacing.sm;
  const peerReadMs =
    !isGroup && peerLastReadAt ? new Date(peerLastReadAt).getTime() : 0;
  const renderedMessages = useMemo(() => {
    const visible =
      heldDiceIds.length === 0
        ? messages
        : messages.filter((message) => !heldDiceIds.includes(message.id));
    return buildChatTimeline(visible, { isGroup, myId: myId ?? undefined });
  }, [heldDiceIds, isGroup, messages, myId]);
  timelineRef.current = renderedMessages;
  // Keep exactly the visual order of messages in the chat. Starting any voice
  // therefore continues with the following voice below it and stops at the
  // final one, instead of jumping between timestamps.
  const voiceQueue = useMemo<ChatVoiceQueueItem[]>(() =>
    messages.flatMap((message) =>
        normalizeMessageAttachments(message)
          .filter((attachment) => attachment.kind === 'audio')
          .map((attachment, index) => ({
            key: `${message.id}-audio-${index}`,
            attachment: { ...attachment, url: fullUrlForAttachment(attachment) },
          })),
      ),
    [messages],
  );
  useEffect(() => {
    syncVoiceQueue(voiceQueue);
  }, [syncVoiceQueue, voiceQueue]);
  const peerId = conversation?.peer?.id;
  const myIdForBanner = myId;
  const peerRemovedMe = useMemo(() => {
    if (!peerId) {
      return false;
    }
    for (let i = messages.length - 1; i >= 0; i -= 1) {
      const item = messages[i];
      if (item.senderId !== peerId) {
        continue;
      }
      if (item.kind === 'favorite_removed') {
        return true;
      }
      if (item.kind === 'favorite_received') {
        return false;
      }
    }
    return false;
  }, [messages, peerId]);
  // After I unfavorite, don't immediately show «В ответ» just because they still have me.
  // Show again only if they re-favorite after my removal.
  const iRemovedAfterTheirFavorite = useMemo(() => {
    if (!peerId || !myIdForBanner) {
      return false;
    }
    let peerFavoriteAt = -1;
    let myRemovedAt = -1;
    for (let i = 0; i < messages.length; i += 1) {
      const item = messages[i];
      if (item.kind === 'favorite_received' && item.senderId === peerId) {
        peerFavoriteAt = i;
      }
      if (item.kind === 'favorite_removed' && item.senderId === myIdForBanner) {
        myRemovedAt = i;
      }
      if (item.kind === 'favorite_received' && item.senderId === myIdForBanner) {
        myRemovedAt = -1;
      }
    }
    return myRemovedAt > peerFavoriteAt;
  }, [messages, myIdForBanner, peerId]);
  const showFavoriteBack = Boolean(
    conversation &&
      !isGroup &&
      conversation.peerFavoritedMe &&
      !conversation.isFavorite &&
      !suppressFavoriteBack &&
      !iRemovedAfterTheirFavorite &&
      !conversation.blockedByMe &&
      !conversation.blockedMe,
  );
  const showRemoveBack = Boolean(
    conversation &&
      !isGroup &&
      conversation.isFavorite &&
      !conversation.peerFavoritedMe &&
      peerRemovedMe &&
      !conversation.blockedByMe &&
      !conversation.blockedMe,
  );
  // One-sided favorite you started — cancel until peer returns or removes.
  const showFavoriteMine = Boolean(
    conversation &&
      !isGroup &&
      conversation.isFavorite &&
      !conversation.peerFavoritedMe &&
      !peerRemovedMe &&
      !conversation.blockedByMe &&
      !conversation.blockedMe,
  );

  return (
    <ScreenTransition animateOnFocus>
      <KeyboardAvoidingView
        style={styles.root}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={0}>
        <View ref={dropZoneRef} style={styles.dropZone} collapsable={false}>
        {Platform.OS === 'web' && isDraggingFile ? (
          <View style={styles.dropOverlay} pointerEvents="none">
            <View style={styles.dropOverlayCard}>
              <Ionicons name="cloud-upload-outline" size={28} color={colors.primary} />
              <Text style={styles.dropOverlayTitle}>Отпустите файл</Text>
              <Text style={styles.dropOverlayHint}>Фото, аудио или документ</Text>
            </View>
          </View>
        ) : null}
        <View style={[styles.header, { paddingTop: headerPadTop }]}>
          {!hasDesktopSidebar || backHref ? (
            <MobileBackButton backHref={backHref} />
          ) : null}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={isGroup ? `Участники ${title}` : `Анкета ${title}`}
            disabled={!isGroup && !peerId}
            onPress={() => {
              if (isGroup) {
                void handleOpenMembers();
                return;
              }
              if (peerId) {
                router.push(`/users/${peerId}`);
              }
            }}
            style={({ pressed }) => [
              styles.headerPeer,
              pressed && styles.headerPeerPressed,
            ]}>
            <View style={styles.headerAvatarWrap}>
              <View style={styles.headerAvatar}>
                {!isGroup && conversation?.peer?.avatarUrl ? (
                  <Image
                    source={{ uri: conversation.peer.avatarUrl }}
                    style={styles.headerAvatarImage}
                  />
                ) : (
                  <View style={styles.headerAvatarFill}>
                    {isGroup ? (
                      <Ionicons name="people" size={18} color={colors.onPrimary} />
                    ) : (
                      <Text style={styles.headerAvatarInitial}>{peerInitial}</Text>
                    )}
                  </View>
                )}
              </View>
            </View>
            <View style={styles.headerText}>
              <Text style={styles.headerTitle} numberOfLines={1}>
                {title}
              </Text>
              {statusLabel ? (
                <Text
                  style={[
                    styles.headerStatus,
                    !isGroup &&
                      conversation?.peer?.online &&
                      styles.headerStatusOnline,
                  ]}
                  numberOfLines={1}>
                  {statusLabel}
                </Text>
              ) : null}
            </View>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Ещё"
            hitSlop={8}
            onPress={handleOpenMenu}
            style={styles.headerMenuButton}>
            <Ionicons name="ellipsis-vertical" size={18} color={colors.textSubtle} />
          </Pressable>
        </View>

        {showFavoriteBack || showFavoriteMine || showRemoveBack ? (
          <View
            style={[
              styles.favoriteInvite,
              showRemoveBack && styles.favoriteInviteRemoved,
            ]}>
            <View
              style={[
                styles.favoriteInviteIcon,
                showRemoveBack && styles.favoriteInviteIconRemoved,
              ]}>
              {showRemoveBack ? (
                <CrownOffIcon
                  size={18}
                  color={isDark ? '#E8B87A' : '#9A6B2F'}
                  haloColor={isDark ? '#3A2818' : undefined}
                />
              ) : (
                <MaterialCommunityIcons
                  name="crown"
                  size={18}
                  color={isDark ? '#FFE9A8' : '#C9A227'}
                />
              )}
            </View>
            <View style={styles.favoriteInviteCopy}>
              <Text
                style={[
                  styles.favoriteInviteTitle,
                  showRemoveBack && styles.favoriteInviteTitleRemoved,
                ]}
                numberOfLines={1}>
                {showRemoveBack
                  ? 'Убрал вас из избранных'
                  : showFavoriteMine
                    ? 'Вы добавили в избранные'
                    : 'Добавил вас в избранные'}
              </Text>
              <Text style={styles.favoriteInviteHint} numberOfLines={2}>
                {showRemoveBack
                  ? 'Можете убрать в ответ, если хотите'
                  : showFavoriteMine
                    ? 'Можно отменить, если передумали'
                    : 'Ответьте взаимностью, чтобы объединиться'}
              </Text>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={
                showRemoveBack
                  ? 'Удалить из избранных в ответ'
                  : showFavoriteMine
                    ? 'Отменить избранное'
                    : 'Добавить в избранные в ответ'
              }
              disabled={addingBack}
              onPress={() =>
                void (showFavoriteBack ? handleAddBack() : handleCancelFavorite())
              }
              style={({ pressed }) => [
                styles.favoriteInviteButton,
                (showFavoriteMine || showRemoveBack) && styles.favoriteInviteButtonCancel,
                showRemoveBack && styles.favoriteInviteButtonRemove,
                pressed && styles.favoriteInviteButtonPressed,
              ]}>
              {showFavoriteBack ? (
                <MaterialCommunityIcons name="crown" size={13} color="#FFFFFF" />
              ) : null}
              <Text
                style={[
                  styles.favoriteInviteButtonLabel,
                  (showFavoriteMine || showRemoveBack) && styles.favoriteInviteButtonLabelCancel,
                  showRemoveBack && styles.favoriteInviteButtonLabelRemove,
                ]}>
                {addingBack
                  ? '…'
                  : showRemoveBack
                    ? 'Удалить в ответ'
                    : showFavoriteMine
                      ? 'Отмена'
                      : 'В ответ'}
              </Text>
            </Pressable>
          </View>
        ) : null}

        {loading ? (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
            <ActivityIndicator color={colors.primary} />
          </View>
        ) : (
          <FlatList
            ref={listRef}
            style={styles.list}
            contentContainerStyle={styles.listContent}
            data={renderedMessages}
            keyExtractor={(item) => item.id}
            onScrollToIndexFailed={({ index }) => {
              listRef.current?.scrollToOffset({
                offset: Math.max(0, index * 72),
                animated: true,
              });
            }}
            onLayout={(event) => {
              layoutHeightRef.current = event.nativeEvent.layout.height;
              if (!loadingOlderRef.current && stickToBottomRef.current) {
                pinToBottom();
              }
            }}
            onContentSizeChange={(_width, height) => {
              contentHeightRef.current = height;
              if (!loadingOlderRef.current && stickToBottomRef.current) {
                pinToBottom();
              }
            }}
            onScroll={({ nativeEvent }: NativeSyntheticEvent<NativeScrollEvent>) => {
              if (pinningScrollRef.current) {
                return;
              }
              const distanceFromBottom =
                nativeEvent.contentSize.height -
                nativeEvent.contentOffset.y -
                nativeEvent.layoutMeasurement.height;
              stickToBottomRef.current = distanceFromBottom < 96;
            }}
            scrollEventThrottle={16}
            bounces={false}
            overScrollMode="never"
            onEndReachedThreshold={0.2}
            ListHeaderComponent={
              nextCursor ? (
                <Pressable onPress={() => void loadOlder()} style={{ paddingVertical: Spacing.sm }}>
                  <Text style={{ color: colors.primary, textAlign: 'center' }}>Загрузить ещё</Text>
                </Pressable>
              ) : null
            }
            renderItem={({ item: timelineItem }) => {
              if (timelineItem.type === 'date') {
                return (
                  <View style={styles.dateDividerRow}>
                    <View style={styles.dateDividerChip}>
                      <Text style={styles.dateDividerText}>{timelineItem.label}</Text>
                    </View>
                  </View>
                );
              }

              const item = timelineItem.message;
              const mine = item.senderId === myId;
              const isFavoriteNotice = item.kind === 'favorite_received';
              const isFavoriteRemovedNotice = item.kind === 'favorite_removed';
              const isBlockNotice = item.kind === 'user_blocked';
              const isUnblockNotice = item.kind === 'user_unblocked';
              const noticeText = isFavoriteNotice
                ? mine
                  ? 'Вы добавили этого пользователя в избранные'
                  : 'добавил вас в избранные.'
                : isFavoriteRemovedNotice
                  ? mine
                    ? 'Вы убрали этого пользователя из избранных'
                    : 'убрал вас из избранных.'
                  : isBlockNotice
                    ? mine
                      ? 'Вы заблокировали этого пользователя'
                      : 'Вас заблокировали'
                    : isUnblockNotice
                      ? mine
                        ? 'Вы разблокировали этого пользователя'
                        : 'разблокировал вас.'
                      : null;
              const bodyText = noticeText ?? item.body;
              const attachments = normalizeMessageAttachments(item);
              const imageAttachments = attachments.filter((entry) => entry.kind === 'image');
              const audioAttachments = attachments.filter((entry) => entry.kind === 'audio');
              const fileAttachments = attachments.filter(
                (entry) => entry.kind !== 'image' && entry.kind !== 'audio',
              );
              const lightboxUris = imageAttachments
                .map((entry) => fullUrlForAttachment(entry))
                .filter((value): value is string => Boolean(value));
              const isRead =
                mine && peerReadMs > 0 && new Date(item.createdAt).getTime() <= peerReadMs;
              const bubbleColor = mine ? colors.primary : isDark ? '#2C2C2E' : colors.surfaceMuted;
              const timeLabel = formatMessageTime(item.createdAt);
              const fullDateTimeLabel = formatMessageFullDateTime(item.createdAt);
              const timeAccessibilityProps = fullDateTimeLabel
                ? ({
                    accessibilityLabel: fullDateTimeLabel,
                    ...(Platform.OS === 'web' ? ({ title: fullDateTimeLabel } as object) : null),
                  } as object)
                : null;

              if (isFavoriteNotice || isFavoriteRemovedNotice) {
                const peerName = conversation?.peer?.nickname ?? 'пользователя';

                return (
                  <View style={styles.systemNoticeRow}>
                    <View
                      style={[
                        styles.favoriteNotice,
                        isFavoriteRemovedNotice && styles.favoriteNoticeRemoved,
                      ]}>
                      <View
                        style={[
                          styles.favoriteNoticeIconWrap,
                          isFavoriteRemovedNotice && styles.favoriteNoticeIconWrapRemoved,
                        ]}>
                        {isFavoriteRemovedNotice ? (
                          <CrownOffIcon
                            size={15}
                            color={isDark ? '#E8B87A' : '#9A6B2F'}
                            haloColor={isDark ? '#3A2818' : undefined}
                          />
                        ) : (
                          <MaterialCommunityIcons
                            name="crown"
                            size={15}
                            color={isDark ? '#FFE9A8' : '#C9A227'}
                          />
                        )}
                      </View>
                      <View style={styles.favoriteNoticeBody}>
                        <Text style={styles.favoriteNoticeText}>
                          {isFavoriteRemovedNotice ? (
                            mine ? (
                              <>
                                Вы убрали{' '}
                                <Text style={styles.favoriteNoticeName}>{peerName}</Text> из
                                избранных
                              </>
                            ) : (
                              <>
                                <Text style={styles.favoriteNoticeName}>{peerName}</Text> убрал
                                вас из избранных
                              </>
                            )
                          ) : mine ? (
                            <>
                              Вы добавили{' '}
                              <Text style={styles.favoriteNoticeName}>{peerName}</Text> в
                              избранные
                            </>
                          ) : (
                            <>
                              <Text style={styles.favoriteNoticeName}>{peerName}</Text> добавил
                              вас в избранные
                            </>
                          )}
                        </Text>
                        {timeLabel ? (
                          <View style={styles.favoriteNoticeMeta}>
                            <View style={styles.favoriteNoticeDot} />
                            <Text style={styles.favoriteNoticeTime} {...timeAccessibilityProps}>
                              {timeLabel}
                            </Text>
                          </View>
                        ) : null}
                      </View>
                    </View>
                  </View>
                );
              }

              return (
                <ChatMessagePressable
                  selectionMode={selectionMode}
                  onOpenActions={() => openMessageActions(item)}
                  style={[styles.bubbleRow, mine && styles.bubbleRowMine]}>
                  {selectionMode ? (
                    <View style={styles.selectMark}>
                      <Ionicons
                        name={selectedIds.includes(item.id) ? 'checkbox' : 'square-outline'}
                        size={20}
                        color={
                          selectedIds.includes(item.id) ? colors.primary : colors.textMuted
                        }
                      />
                    </View>
                  ) : null}
                  {isGroup && !mine ? (
                    <View style={styles.authorAvatarCol}>
                      {timelineItem.showAuthorMeta ? (
                        <Pressable
                          accessibilityRole="button"
                          accessibilityLabel={`Профиль ${item.sender?.nickname ?? 'участника'}`}
                          onPress={() => {
                            if (item.senderId) {
                              router.push(`/users/${item.senderId}`);
                            }
                          }}
                          style={styles.authorAvatarButton}>
                          <UserAvatar
                            nickname={item.sender?.nickname ?? 'Игрок'}
                            avatarUrl={
                              item.sender?.avatarUrl ??
                              members.find((member) => member.id === item.senderId)?.avatarUrl ??
                              null
                            }
                            size={30}
                          />
                        </Pressable>
                      ) : (
                        <View style={styles.authorAvatarSpacer} />
                      )}
                    </View>
                  ) : null}
                  <View style={[styles.bubbleShell, mine && styles.bubbleShellMine]}>
                    {isGroup && !mine && timelineItem.showAuthorMeta ? (
                      <Text selectable={false} style={styles.senderName} numberOfLines={1}>
                        {item.sender?.nickname ?? 'Игрок'}
                      </Text>
                    ) : null}
                    <View
                      style={[
                        styles.bubble,
                        mine && styles.bubbleMine,
                        highlightedMessageId === item.id && styles.bubbleHighlighted,
                      ]}>
                      {item.forwardedFrom ? (
                        <Text
                          selectable={false}
                          style={[styles.forwardLabel, mine && styles.forwardLabelMine]}
                          numberOfLines={1}>
                          Переслано от: {item.forwardedFrom.nickname}
                        </Text>
                      ) : null}
                      {item.replyTo ? (
                        <View style={styles.replyInBubble}>
                          <ChatReplyQuote
                            preview={{
                              id: item.replyTo.id,
                              senderNickname: item.replyTo.senderNickname,
                              body: item.replyTo.body,
                              hasMedia: item.replyTo.hasMedia,
                            }}
                            mine={mine}
                            compact
                            onPress={() => scrollToMessage(item.replyTo!.id)}
                          />
                        </View>
                      ) : null}
                      {imageAttachments.length > 0 ? (
                        <ChatAlbumGrid
                          images={imageAttachments}
                          onOpen={(index) =>
                            setLightbox({
                              uris: lightboxUris,
                              index,
                            })
                          }
                        />
                      ) : null}
                      {audioAttachments.map((audioAttachment, audioIndex) => {
                        const voiceKey = `${item.id}-audio-${audioIndex}`;
                        return (
                          <ChatAudioPlayer
                            key={voiceKey}
                            playbackKey={voiceKey}
                            attachment={{
                              ...audioAttachment,
                              url: fullUrlForAttachment(audioAttachment),
                            }}
                            mine={mine}
                            active={activeVoiceKey === voiceKey}
                            playing={playingVoiceKey === voiceKey}
                            onPress={() => {
                              if (activeVoiceKey === voiceKey) {
                                toggleVoice(voiceKey);
                              } else {
                                playVoice(voiceKey, voiceQueue);
                              }
                            }}
                            accentColor={mine ? '#FFFFFF' : colors.primary}
                            textColor={mine ? colors.onPrimary : colors.textSecondary}
                          />
                        );
                      })}
                      {fileAttachments.map((fileAttachment, fileIndex) => (
                        <Pressable
                          key={`${item.id}-file-${fileIndex}`}
                          accessibilityRole="button"
                          accessibilityLabel={
                            fileAttachment.kind === 'audio' ? 'Скачать аудио' : 'Скачать файл'
                          }
                          onPress={() => {
                            const url = fileAttachment.url;
                            if (!url) {
                              return;
                            }
                            downloadChatAttachment(
                              url,
                              fileAttachment.name ??
                                (fileAttachment.kind === 'audio' ? 'audio' : 'file'),
                            );
                          }}
                          style={[styles.bubbleAttachment, mine && styles.bubbleAttachmentMine]}>
                          <Ionicons
                            name={attachmentIcon(fileAttachment.kind)}
                            size={20}
                            color={mine ? colors.onPrimary : colors.primary}
                          />
                          <Text
                            selectable={false}
                            style={[
                              styles.bubbleAttachmentName,
                              mine && styles.bubbleAttachmentNameMine,
                            ]}
                            numberOfLines={2}>
                            {fileAttachment.name ??
                              (fileAttachment.kind === 'audio' ? 'Аудио' : 'Файл')}
                          </Text>
                        </Pressable>
                      ))}
                      <View style={styles.bubbleContent}>
                        {item.kind === 'dice_roll' ? (
                          (() => {
                            const dicePayload = parseDiceRollPayload(item.body);
                            return dicePayload ? (
                              <ChatDiceBubble
                                payload={dicePayload}
                                mine={mine}
                              />
                            ) : bodyText ? (
                              <ChatMessageBody
                                text={bodyText}
                                textStyle={[styles.bubbleText, mine && styles.bubbleTextMine]}
                                linkStyle={mine ? styles.bubbleLinkMine : styles.bubbleLink}
                              />
                            ) : null;
                          })()
                        ) : bodyText ? (
                          <ChatMessageBody
                            text={bodyText}
                            textStyle={[styles.bubbleText, mine && styles.bubbleTextMine]}
                            linkStyle={mine ? styles.bubbleLinkMine : styles.bubbleLink}
                          />
                        ) : null}
                        <View style={styles.metaRow}>
                          <Text
                            selectable={false}
                            style={[styles.metaTime, mine && styles.metaTimeMine]}
                            {...timeAccessibilityProps}>
                            {timeLabel}
                          </Text>
                          {mine ? (
                            <Ionicons
                              name={isRead ? 'checkmark-done' : 'checkmark'}
                              size={12}
                              color={isRead ? '#B8F2C8' : 'rgba(255,255,255,0.82)'}
                            />
                          ) : null}
                        </View>
                      </View>
                      {isUnblockNotice && !mine && conversation?.blockedByMe ? (
                        <Pressable
                          accessibilityRole="button"
                          disabled={unblocking}
                          onPress={() => void handleUnblock()}
                          style={({ pressed }) => [
                            styles.favoriteReplyButton,
                            pressed && styles.favoriteReplyButtonPressed,
                          ]}>
                          <Text style={styles.favoriteReplyLabel}>
                            {unblocking ? 'Разблокируем…' : 'Разблокировать в ответ'}
                          </Text>
                        </Pressable>
                      ) : null}
                    </View>
                    <BubbleTail color={bubbleColor} side={mine ? 'right' : 'left'} />
                  </View>
                </ChatMessagePressable>
              );
            }}
          />
        )}

        <ChatImageLightbox
          uris={lightbox?.uris ?? null}
          index={lightbox?.index ?? 0}
          onClose={() => setLightbox(null)}
        />

        {pendingAttachments.length > 0 ? (
          <View style={styles.pendingStrip}>
            {pendingAttachments.map((item) => (
              <View key={item.id} style={styles.pendingThumbWrap}>
                {item.kind === 'image' ? (
                  <Image
                    source={{ uri: item.uri }}
                    style={styles.pendingImage}
                    contentFit="cover"
                  />
                ) : (
                  <View style={styles.pendingFileChip}>
                    <Ionicons
                      name={attachmentIcon(item.kind)}
                      size={18}
                      color={colors.primary}
                    />
                    <Text style={styles.pendingFileName} numberOfLines={2}>
                      {item.name}
                    </Text>
                  </View>
                )}
                {sending ? (
                  <View style={styles.pendingBusy}>
                    <ActivityIndicator color="#fff" size="small" />
                  </View>
                ) : (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Убрать вложение"
                    onPress={() => removePendingAttachment(item.id)}
                    style={styles.pendingClear}>
                    <Ionicons name="close" size={14} color={colors.text} />
                  </Pressable>
                )}
              </View>
            ))}
          </View>
        ) : null}

        {selectionMode ? (
          <View style={styles.selectionBar}>
            <Pressable accessibilityRole="button" onPress={clearSelection} hitSlop={8}>
              <Text style={styles.selectionCancel}>Отмена</Text>
            </Pressable>
            <Text style={styles.selectionCount}>Выбрано: {selectedIds.length}</Text>
            <Pressable
              accessibilityRole="button"
              disabled={selectedIds.length === 0}
              onPress={() => handleStartForward(selectedIds)}
              style={[
                styles.selectionForward,
                selectedIds.length === 0 && styles.selectionForwardDisabled,
              ]}>
              <Ionicons name="arrow-redo-outline" size={16} color={colors.onPrimary} />
              <Text style={styles.selectionForwardLabel}>Переслать</Text>
            </Pressable>
          </View>
        ) : null}

        {conversation?.blockedMe ? (
          <View style={styles.blockedBanner}>
            <Text style={styles.blockedBannerText}>
              Вас заблокировали. Отправлять сообщения нельзя.
            </Text>
          </View>
        ) : (
        <View style={styles.composerShell}>
        {replyTo ? (
          <View style={styles.replyBar}>
            <ChatReplyQuote preview={replyTo} onClear={() => setReplyTo(null)} />
          </View>
        ) : null}
        {emojiPanelOpen ? <ChatEmojiPanel onSelect={insertEmoji} /> : null}
        <View style={[styles.composer, { overflow: 'visible' }]}>
          {conversationId ? (
            <ChatVoiceComposer
              conversationId={conversationId}
              disabled={sending}
              replyToId={replyTo?.id}
              showMic={!hasMessageText && pendingAttachments.length === 0}
              trailing={
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Отправить"
                  disabled={!canSend}
                  onPress={() => void handleSend()}
                  style={[styles.sendButton, canSend && styles.sendButtonReady]}>
                  <Ionicons
                    name="send"
                    size={18}
                    color={canSend ? colors.onPrimary : colors.textMuted}
                  />
                </Pressable>
              }
              onSent={(message) => {
                setReplyTo(null);
                setMessages((prev) =>
                  prev.some((item) => item.id === message.id) ? prev : [...prev, message],
                );
                scrollToBottom();
              }}
              idleChildren={
                <>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Прикрепить файл"
                    onPress={() => void pickAttachment()}
                    style={styles.iconButton}>
                    <Ionicons name="attach-outline" size={20} color={colors.textMuted} />
                  </Pressable>
                  <View ref={composerFieldWrapRef} collapsable={false} style={styles.composerField}>
                    <TextInput
                      ref={composerInputRef}
                      style={styles.input}
                      value={draft}
                      onChangeText={(value) => {
                        draftRef.current = value;
                        setDraft(value);
                      }}
                      onSelectionChange={(event) => {
                        selectionRef.current = event.nativeEvent.selection;
                      }}
                      onFocus={handleComposerFocus}
                      showSoftInputOnFocus={!emojiPanelOpen}
                      nativeID="chat-composer-input"
                      placeholder="Сообщение"
                      placeholderTextColor={colors.textMuted}
                      multiline
                      blurOnSubmit={false}
                      submitBehavior="newline"
                      returnKeyType={Platform.OS === 'web' ? undefined : 'default'}
                      onKeyPress={Platform.OS === 'web' ? handleKeyPress : undefined}
                    />
                  </View>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={emojiPanelOpen ? 'Скрыть эмодзи' : 'Эмодзи'}
                    accessibilityState={{ selected: emojiPanelOpen }}
                    onPress={toggleEmojiPanel}
                    style={[styles.iconButton, emojiPanelOpen ? styles.iconButtonActive : null]}>
                    <Ionicons
                      name={emojiPanelOpen ? 'happy' : 'happy-outline'}
                      size={20}
                      color={emojiPanelOpen ? colors.primary : colors.textMuted}
                    />
                  </Pressable>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Бросить кости"
                    accessibilityState={{ selected: dicePopoverOpen }}
                    onPress={() => {
                      setEmojiPanelOpen(false);
                      emojiPanelOpenRef.current = false;
                      setDicePopoverOpen(true);
                    }}
                    style={[styles.iconButton, dicePopoverOpen ? styles.iconButtonActive : null]}>
                    <Ionicons
                      name="dice-outline"
                      size={20}
                      color={dicePopoverOpen ? colors.primary : colors.textMuted}
                    />
                  </Pressable>
                </>
              }
            />
          ) : null}
        </View>
        </View>
        )}
        </View>
      </KeyboardAvoidingView>

        <Modal visible={menuOpen} transparent animationType="fade" onRequestClose={handleCloseMenu}>
          <View style={styles.menuRoot}>
            <Pressable style={styles.menuBackdrop} onPress={handleCloseMenu} />
            <View style={[styles.menu, { top: headerPadTop + 44 }]}>
              {isGroup ? (
                <>
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => {
                      handleCloseMenu();
                      void handleOpenMembers();
                    }}
                    style={({ pressed }) => [styles.menuItem, pressed && styles.menuItemPressed]}>
                    <Ionicons name="people-outline" size={18} color={colors.primary} />
                    <Text style={[styles.menuItemLabel, { color: colors.primary }]}>
                      Участники
                    </Text>
                  </Pressable>
                  <Pressable
                    accessibilityRole="button"
                    disabled={isMenuBusy}
                    onPress={() => void handleLeaveGroup()}
                    style={({ pressed }) => [styles.menuItem, pressed && styles.menuItemPressed]}>
                    <Ionicons name="exit-outline" size={18} color={colors.destructive} />
                    <Text style={styles.menuItemLabel}>
                      {conversation?.gameId ? 'Скрыть чат' : 'Выйти из группы'}
                    </Text>
                  </Pressable>
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => {
                      handleCloseMenu();
                      setPendingDelete(true);
                    }}
                    style={({ pressed }) => [styles.menuItem, pressed && styles.menuItemPressed]}>
                    <Ionicons name="trash-outline" size={18} color={colors.destructive} />
                    <Text style={styles.menuItemLabel}>Скрыть у себя</Text>
                  </Pressable>
                </>
              ) : (
                <>
                  {conversation &&
                  !conversation.isFavorite &&
                  !conversation.blockedByMe &&
                  !conversation.blockedMe ? (
                    <Pressable
                      accessibilityRole="button"
                      disabled={addingBack}
                      onPress={() => {
                        handleCloseMenu();
                        void handleAddBack();
                      }}
                      style={({ pressed }) => [styles.menuItem, pressed && styles.menuItemPressed]}>
                      <MaterialCommunityIcons name="crown" size={18} color="#C9A227" />
                      <Text style={[styles.menuItemLabel, styles.menuItemLabelFavorite]}>
                        {addingBack ? 'Добавляем…' : 'В избранные'}
                      </Text>
                    </Pressable>
                  ) : null}
                  {conversation?.isFavorite &&
                  !conversation.blockedByMe &&
                  !conversation.blockedMe ? (
                    <Pressable
                      accessibilityRole="button"
                      disabled={addingBack}
                      onPress={() => {
                        handleCloseMenu();
                        void handleCancelFavorite();
                      }}
                      style={({ pressed }) => [styles.menuItem, pressed && styles.menuItemPressed]}>
                      <CrownOffIcon
                        size={18}
                        color={isDark ? '#E8B87A' : '#9A6B2F'}
                        haloColor={isDark ? colors.background : undefined}
                      />
                      <Text style={[styles.menuItemLabel, styles.menuItemLabelFavorite]}>
                        {addingBack ? 'Убираем…' : 'Убрать из избранных'}
                      </Text>
                    </Pressable>
                  ) : null}
                  {conversation?.blockedByMe ? (
                    <Pressable
                      accessibilityRole="button"
                      disabled={unblocking}
                      onPress={() => void handleUnblock()}
                      style={({ pressed }) => [styles.menuItem, pressed && styles.menuItemPressed]}>
                      <Ionicons name="lock-open-outline" size={18} color={colors.primary} />
                      <Text style={[styles.menuItemLabel, { color: colors.primary }]}>
                        {unblocking ? 'Разблокируем…' : 'Разблокировать'}
                      </Text>
                    </Pressable>
                  ) : (
                    <Pressable
                      accessibilityRole="button"
                      onPress={() => {
                        handleCloseMenu();
                        setPendingBlock(true);
                      }}
                      style={({ pressed }) => [styles.menuItem, pressed && styles.menuItemPressed]}>
                      <Ionicons name="ban-outline" size={18} color={colors.destructive} />
                      <Text style={styles.menuItemLabel}>Заблокировать</Text>
                    </Pressable>
                  )}
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => {
                      handleCloseMenu();
                      setPendingDelete(true);
                    }}
                    style={({ pressed }) => [styles.menuItem, pressed && styles.menuItemPressed]}>
                    <Ionicons name="trash-outline" size={18} color={colors.destructive} />
                    <Text style={styles.menuItemLabel}>Удалить</Text>
                  </Pressable>
                </>
              )}
            </View>
          </View>
        </Modal>

        <GroupMembersSheet
          visible={membersOpen}
          title={title}
          members={members}
          loading={membersLoading}
          onClose={() => setMembersOpen(false)}
          onOpenProfile={(userId) => {
            setMembersOpen(false);
            router.push(`/users/${userId}`);
          }}
        />

        <DeleteChatDialog
          visible={pendingDelete}
          nickname={title}
          isDeleting={isMenuBusy}
          onDeleteForMe={() => void handleDeleteChat(false)}
          onDeleteForEveryone={isGroup ? undefined : () => void handleDeleteChat(true)}
          onCancel={() => {
            if (!isMenuBusy) {
              setPendingDelete(false);
            }
          }}
        />

        <BlockUserDialog
          visible={pendingBlock}
          nickname={conversation?.peer?.nickname ?? ''}
          isBusy={isMenuBusy}
          onConfirm={(deleteChat) => void handleBlock(deleteChat)}
          onCancel={() => {
            if (!isMenuBusy) {
              setPendingBlock(false);
            }
          }}
        />

        <ChatMessageActionsSheet
          visible={Boolean(actionMessage)}
          onClose={() => setActionMessage(null)}
          onReply={() => {
            if (actionMessage) {
              handleStartReply(actionMessage);
            }
          }}
          onForward={() => {
            if (actionMessage) {
              handleStartForward([actionMessage.id]);
            }
          }}
          onSelectMore={() => {
            if (actionMessage) {
              handleEnterSelection(actionMessage);
            }
          }}
        />

        <ChatForwardPicker
          visible={forwardOpen}
          excludeConversationId={null}
          busy={forwardBusy}
          onClose={() => {
            if (!forwardBusy) {
              setForwardOpen(false);
              if (!selectionMode) {
                setSelectedIds([]);
              }
            }
          }}
          onPick={(targetId) => void handleForwardToChat(targetId)}
        />

        <ChatDicePopover
          visible={dicePopoverOpen}
          busy={diceRollBusy}
          onClose={() => {
            setDicePopoverOpen(false);
          }}
          onRoll={(input) => void handleDiceRoll(input)}
        />

        <ChatDiceOverlay
          request={localDiceRoll ? null : diceOverlayRequest}
          localRoll={localDiceRoll}
          onLocalRollComplete={handleLocalDiceRollComplete}
          warm={dicePopoverOpen || diceRollBusy || Boolean(localDiceRoll)}
          onReveal={revealHeldDiceMessage}
          onAdvance={advanceDiceAnimationQueue}
        />
      </ScreenTransition>
  );
}
