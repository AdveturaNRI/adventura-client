import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import * as DocumentPicker from 'expo-document-picker';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  type TextInputKeyPressEventData,
} from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { MobileBackButton } from '@/components/navigation/MobileBackButton';
import { useIsDesktopSidebarVisible, useIsDesktopWeb } from '@/components/navigation/DesktopThemeToggle';
import { ScreenTransition } from '@/components/navigation/ScreenTransition';
import { BlockUserDialog } from '@/components/chats/BlockUserDialog';
import { ChatImageLightbox } from '@/components/chats/ChatImageLightbox';
import { ChatMessageBody } from '@/components/chats/ChatMessageBody';
import { CrownOffIcon } from '@/components/chats/CrownOffIcon';
import { DeleteChatDialog } from '@/components/chats/DeleteChatDialog';
import { GroupMembersSheet } from '@/components/chats/GroupMembersSheet';
import { toast } from '@/components/ui';
import { FontSize, Radius, Spacing, type ThemeColors } from '@/constants/theme';
import { MAX_UPLOAD_SIZE_MB, MAX_UPLOAD_SIZE_MESSAGE } from '@/constants/upload.config';
import { useAuth } from '@/context/AuthContext';
import { useRealtime } from '@/context/RealtimeContext';
import { useTheme } from '@/hooks/use-theme';
import { useThemedStyles } from '@/hooks/use-themed-styles';
import {
  listConversations,
  listMessages,
  listChatMembers,
  leaveGroup,
  markConversationRead,
  sendChatMessage,
  blockPeer,
  unblockPeer,
  deleteConversation,
  type ChatAttachmentKind,
  type ChatMember,
  type ChatMessage,
  type ConversationListItem,
} from '@/services/chats/chatsApi';
import { ApiError } from '@/services/api/api-error';
import { upsertWandererReaction, clearWandererReaction } from '@/services/profile/wanderersApi';
import { localizeErrorMessage } from '@/utils/localizeError';
import {
  getCachedFileTooLargeMessage,
  getCachedUploadLimits,
} from '@/utils/upload-limits';

function isGroupConversation(item: ConversationListItem | null | undefined) {
  return item?.type === 'group';
}
type PendingAttachment = {
  uri: string;
  name: string;
  mimeType: string;
  kind: ChatAttachmentKind;
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

function createStyles(colors: ThemeColors, bottomPad: number) {
  return StyleSheet.create({
    root: {
      flex: 1,
      backgroundColor: colors.background,
      position: 'relative',
    },
    dropZone: {
      flex: 1,
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
      borderColor: 'rgba(201, 162, 39, 0.28)',
      backgroundColor: 'rgba(255, 248, 225, 0.95)',
    },
    favoriteInviteIcon: {
      width: 36,
      height: 36,
      borderRadius: 18,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'rgba(201, 162, 39, 0.16)',
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
      color: '#8B6914',
    },
    favoriteInviteHint: {
      fontSize: FontSize.caption,
      color: '#A8842A',
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
      borderColor: 'rgba(201, 162, 39, 0.55)',
    },
    favoriteInviteButtonRemove: {
      borderColor: 'rgba(154, 107, 47, 0.5)',
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
      color: '#9A7518',
    },
    favoriteInviteButtonLabelRemove: {
      color: '#7A4E1D',
    },
    favoriteInviteRemoved: {
      borderColor: 'rgba(154, 107, 47, 0.35)',
      backgroundColor: 'rgba(255, 243, 224, 0.96)',
    },
    favoriteInviteIconRemoved: {
      backgroundColor: 'rgba(154, 107, 47, 0.14)',
    },
    favoriteInviteTitleRemoved: {
      color: '#7A4E1D',
    },
    systemNoticeRow: {
      width: '100%',
      alignItems: 'center',
      paddingVertical: 6,
      paddingHorizontal: 8,
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
      borderColor: 'rgba(201, 162, 39, 0.22)',
      backgroundColor: 'rgba(255, 248, 225, 0.92)',
    },
    favoriteNoticeRemoved: {
      borderColor: 'rgba(154, 107, 47, 0.28)',
      backgroundColor: 'rgba(255, 243, 224, 0.94)',
    },
    favoriteNoticeIconWrap: {
      width: 28,
      height: 28,
      borderRadius: 14,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'rgba(201, 162, 39, 0.16)',
      flexShrink: 0,
    },
    favoriteNoticeIconWrapRemoved: {
      backgroundColor: 'rgba(154, 107, 47, 0.14)',
    },
    favoriteNoticeBody: {
      flexShrink: 1,
      minWidth: 0,
      gap: 2,
    },
    favoriteNoticeText: {
      fontSize: FontSize.label,
      color: '#9A7518',
      lineHeight: FontSize.label * 1.4,
      flexShrink: 1,
    },
    favoriteNoticeName: {
      fontWeight: '700',
      color: colors.text,
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
      backgroundColor: 'rgba(154, 117, 24, 0.35)',
    },
    favoriteNoticeTime: {
      fontSize: 11,
      color: colors.textMuted,
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
      color: '#9A7518',
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
      backgroundColor: colors.surfaceMuted,
    },
    bubbleMine: {
      borderBottomLeftRadius: 14,
      borderBottomRightRadius: 4,
      backgroundColor: colors.primary,
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
      color: colors.text,
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
      fontSize: FontSize.label,
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
    pendingImageWrap: {
      paddingHorizontal: Spacing.md,
      paddingTop: Spacing.sm,
      backgroundColor: colors.surface,
    },
    pendingImage: {
      width: 96,
      height: 96,
      borderRadius: 12,
    },
    pendingFileChip: {
      alignSelf: 'flex-start',
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.sm,
      maxWidth: '100%',
      paddingVertical: Spacing.sm,
      paddingHorizontal: Spacing.md,
      borderRadius: 12,
      backgroundColor: colors.surfaceMuted,
      borderWidth: 1,
      borderColor: colors.borderLight,
    },
    pendingFileName: {
      flexShrink: 1,
      fontSize: FontSize.label,
      color: colors.text,
    },
    pendingClear: {
      position: 'absolute',
      top: 4,
      right: Spacing.md + 4,
      width: 28,
      height: 28,
      borderRadius: 14,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.overlay,
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
  const { id } = useLocalSearchParams<{ id: string }>();
  const conversationId = Array.isArray(id) ? id[0] : id;
  const router = useRouter();
  const colors = useTheme();
  const insets = useSafeAreaInsets();
  const isDesktopWeb = useIsDesktopWeb();
  const hasDesktopSidebar = useIsDesktopSidebarVisible();
  const { user } = useAuth();
  const { lastConversationUpdate, lastConversationRead, lastConversationDeleted, lastPresence, subscribeMessages, publishConversationUpdate } =
    useRealtime();
  const bottomPad = hasDesktopSidebar ? Spacing.md : Math.max(insets.bottom, Spacing.sm);
  const styles = useThemedStyles((themeColors) => createStyles(themeColors, bottomPad));

  const [conversation, setConversation] = useState<ConversationListItem | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [peerLastReadAt, setPeerLastReadAt] = useState<string | null>(null);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [draft, setDraft] = useState('');
  const [pendingAttachment, setPendingAttachment] = useState<PendingAttachment | null>(null);
  const [lightboxUri, setLightboxUri] = useState<string | null>(null);
  const [isDraggingFile, setIsDraggingFile] = useState(false);
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
  const listRef = useRef<FlatList<ChatMessage>>(null);
  const stickToBottomRef = useRef(true);
  const loadingOlderRef = useRef(false);
  const pinningScrollRef = useRef(false);
  const contentHeightRef = useRef(0);
  const layoutHeightRef = useRef(0);
  const dropZoneRef = useRef<View>(null);
  const draftRef = useRef('');
  const pendingAttachmentRef = useRef<PendingAttachment | null>(null);
  const pendingObjectUrlRef = useRef<string | null>(null);
  const sendingRef = useRef(false);
  const blockedMeRef = useRef(false);
  const composerFieldWrapRef = useRef<View>(null);
  const myId = user?.id;

  draftRef.current = draft;
  pendingAttachmentRef.current = pendingAttachment;
  sendingRef.current = sending;
  blockedMeRef.current = Boolean(conversation?.blockedMe);

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

  const clearPendingAttachment = useCallback(() => {
    if (pendingObjectUrlRef.current) {
      URL.revokeObjectURL(pendingObjectUrlRef.current);
      pendingObjectUrlRef.current = null;
    }
    pendingAttachmentRef.current = null;
    setPendingAttachment(null);
  }, []);

  const setPendingFromSource = useCallback(
    (next: PendingAttachment, objectUrl?: string | null) => {
      if (pendingObjectUrlRef.current) {
        URL.revokeObjectURL(pendingObjectUrlRef.current);
      }
      pendingObjectUrlRef.current = objectUrl ?? null;
      pendingAttachmentRef.current = next;
      setPendingAttachment(next);
    },
    [],
  );

  useEffect(() => {
    return () => {
      if (pendingObjectUrlRef.current) {
        URL.revokeObjectURL(pendingObjectUrlRef.current);
        pendingObjectUrlRef.current = null;
      }
    };
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
    };
  }, [conversationId, loadConversation, loadMessages, router]);

  useEffect(() => {
    return subscribeMessages((message) => {
      if (!conversationId || message.conversationId !== conversationId) {
        return;
      }
      setMessages((prev) => {
        if (prev.some((item) => item.id === message.id)) {
          return prev;
        }
        return [...prev, message];
      });
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
        scrollToBottom();
      }
      void markConversationRead(conversationId);
    });
  }, [conversationId, myId, scrollToBottom, subscribeMessages]);

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

  const canSend =
    Boolean(draft.trim() || pendingAttachment) && !sending && !conversation?.blockedMe;

  const acceptDroppedFile = useCallback(
    (file: File) => {
      const maxBytes =
        getCachedUploadLimits()?.maxUploadBytes ?? MAX_UPLOAD_SIZE_MB * 1024 * 1024;
      if (file.size > maxBytes) {
        toast.error(getCachedFileTooLargeMessage() ?? MAX_UPLOAD_SIZE_MESSAGE);
        return;
      }

      const mimeType = file.type || 'application/octet-stream';
      const objectUrl = URL.createObjectURL(file);
      setPendingFromSource(
        {
          uri: objectUrl,
          name: file.name || 'Файл',
          mimeType,
          kind: attachmentKindFromMime(mimeType),
        },
        objectUrl,
      );
    },
    [setPendingFromSource],
  );

  const pickAttachment = useCallback(async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        copyToCacheDirectory: true,
        multiple: false,
      });

      if (result.canceled || !result.assets?.[0]) {
        return;
      }

      const asset = result.assets[0];
      const mimeType = asset.mimeType ?? 'application/octet-stream';
      setPendingFromSource({
        uri: asset.uri,
        name: asset.name || 'Файл',
        mimeType,
        kind: attachmentKindFromMime(mimeType),
      });
    } catch {
      toast.error('Не удалось выбрать файл');
    }
  }, [setPendingFromSource]);

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
      const file = event.dataTransfer?.files?.[0];
      if (file) {
        acceptDroppedFile(file);
      }
    };

    document.addEventListener('dragenter', onDragOver);
    document.addEventListener('dragover', onDragOver);
    document.addEventListener('dragleave', onDragLeave);
    document.addEventListener('drop', onDrop);

    return () => {
      document.removeEventListener('dragenter', onDragOver);
      document.removeEventListener('dragover', onDragOver);
      document.removeEventListener('dragleave', onDragLeave);
      document.removeEventListener('drop', onDrop);
    };
  }, [acceptDroppedFile]);

  const handleSend = useCallback(async () => {
    if (!conversationId || sendingRef.current || blockedMeRef.current) {
      return;
    }

    const body = draftRef.current;
    const attachment = pendingAttachmentRef.current;
    if (!body.trim() && !attachment) {
      return;
    }

    setSending(true);
    sendingRef.current = true;
    try {
      const message = await sendChatMessage(conversationId, {
        body,
        fileUri: attachment?.uri,
        fileName: attachment?.name,
        mimeType: attachment?.mimeType,
      });
      setDraft('');
      draftRef.current = '';
      clearPendingAttachment();
      setMessages((prev) => {
        if (prev.some((item) => item.id === message.id)) {
          return prev;
        }
        return [...prev, message];
      });
      scrollToBottom();
    } catch (error) {
      toast.error(localizeErrorMessage(error, 'Не удалось отправить'));
    } finally {
      setSending(false);
      sendingRef.current = false;
    }
  }, [clearPendingAttachment, conversationId, scrollToBottom]);

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

  const headerPadTop = isDesktopWeb ? Spacing.md : insets.top + Spacing.sm;
  const peerReadMs =
    !isGroup && peerLastReadAt ? new Date(peerLastReadAt).getTime() : 0;
  const renderedMessages = useMemo(() => messages, [messages]);
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
          {!hasDesktopSidebar ? <MobileBackButton /> : null}
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
                <CrownOffIcon size={18} color="#9A6B2F" />
              ) : (
                <MaterialCommunityIcons name="crown" size={18} color="#C9A227" />
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
            renderItem={({ item }) => {
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
              const attachment = item.attachment;
              const previewUrl =
                attachment?.image?.medium ??
                attachment?.image?.large ??
                attachment?.image?.original ??
                attachment?.image?.thumb ??
                item.image?.medium ??
                item.image?.large ??
                item.image?.original ??
                item.image?.thumb;
              const fullUrl =
                attachment?.image?.original ??
                attachment?.image?.large ??
                attachment?.image?.medium ??
                attachment?.image?.thumb ??
                item.image?.original ??
                item.image?.large ??
                item.image?.medium ??
                item.image?.thumb;
              const isRead =
                mine && peerReadMs > 0 && new Date(item.createdAt).getTime() <= peerReadMs;
              const bubbleColor = mine ? colors.primary : colors.surfaceMuted;
              const kind = attachment?.kind ?? (previewUrl ? 'image' : null);

              if (isFavoriteNotice || isFavoriteRemovedNotice) {
                const peerName = conversation?.peer?.nickname ?? 'пользователя';
                const timeLabel = formatMessageTime(item.createdAt);

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
                          <CrownOffIcon size={15} color="#9A6B2F" />
                        ) : (
                          <MaterialCommunityIcons name="crown" size={15} color="#C9A227" />
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
                            <Text style={styles.favoriteNoticeTime}>{timeLabel}</Text>
                          </View>
                        ) : null}
                      </View>
                    </View>
                  </View>
                );
              }

              return (
                <View style={[styles.bubbleRow, mine && styles.bubbleRowMine]}>
                  <View style={[styles.bubbleShell, mine && styles.bubbleShellMine]}>
                    {isGroup && !mine ? (
                      <Text style={styles.senderName} numberOfLines={1}>
                        {item.sender?.nickname ?? 'Игрок'}
                      </Text>
                    ) : null}
                    <View style={[styles.bubble, mine && styles.bubbleMine]}>
                      {kind === 'image' && previewUrl ? (
                        <Pressable
                          accessibilityRole="imagebutton"
                          accessibilityLabel="Открыть фото"
                          onPress={() => setLightboxUri(fullUrl ?? previewUrl)}>
                          <Image
                            source={{ uri: previewUrl }}
                            style={styles.bubbleImage}
                            contentFit="cover"
                          />
                        </Pressable>
                      ) : null}
                      {kind === 'audio' || kind === 'file' ? (
                        <Pressable
                          accessibilityRole="button"
                          accessibilityLabel={
                            kind === 'audio' ? 'Скачать аудио' : 'Скачать файл'
                          }
                          onPress={() => {
                            const url = attachment?.url;
                            if (!url) {
                              return;
                            }
                            downloadChatAttachment(
                              url,
                              attachment?.name ?? (kind === 'audio' ? 'audio' : 'file'),
                            );
                          }}
                          style={[styles.bubbleAttachment, mine && styles.bubbleAttachmentMine]}>
                          <Ionicons
                            name={attachmentIcon(kind)}
                            size={20}
                            color={mine ? colors.onPrimary : colors.primary}
                          />
                          <Text
                            style={[
                              styles.bubbleAttachmentName,
                              mine && styles.bubbleAttachmentNameMine,
                            ]}
                            numberOfLines={2}>
                            {attachment?.name ?? (kind === 'audio' ? 'Аудио' : 'Файл')}
                          </Text>
                        </Pressable>
                      ) : null}
                      <View style={styles.bubbleContent}>
                        {bodyText ? (
                          <ChatMessageBody
                            text={bodyText}
                            textStyle={[styles.bubbleText, mine && styles.bubbleTextMine]}
                            linkStyle={mine ? styles.bubbleLinkMine : styles.bubbleLink}
                          />
                        ) : null}
                        <View style={styles.metaRow}>
                          <Text style={[styles.metaTime, mine && styles.metaTimeMine]}>
                            {formatMessageTime(item.createdAt)}
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
                </View>
              );
            }}
          />
        )}

        <ChatImageLightbox uri={lightboxUri} onClose={() => setLightboxUri(null)} />

        {pendingAttachment ? (
          <View style={styles.pendingImageWrap}>
            {pendingAttachment.kind === 'image' ? (
              <Image
                source={{ uri: pendingAttachment.uri }}
                style={styles.pendingImage}
                contentFit="cover"
              />
            ) : (
              <View style={styles.pendingFileChip}>
                <Ionicons
                  name={attachmentIcon(pendingAttachment.kind)}
                  size={20}
                  color={colors.primary}
                />
                <Text style={styles.pendingFileName} numberOfLines={1}>
                  {pendingAttachment.name}
                </Text>
              </View>
            )}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Убрать вложение"
              onPress={clearPendingAttachment}
              style={styles.pendingClear}>
              <Ionicons name="close" size={16} color={colors.text} />
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
        <View style={styles.composer}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Прикрепить файл"
            onPress={() => void pickAttachment()}
            style={styles.iconButton}>
            <Ionicons name="attach-outline" size={20} color={colors.textMuted} />
          </Pressable>
          <View ref={composerFieldWrapRef} collapsable={false} style={styles.composerField}>
          <TextInput
            style={styles.input}
            value={draft}
            onChangeText={(value) => {
              draftRef.current = value;
              setDraft(value);
            }}
            nativeID="chat-composer-input"
            placeholder="Сообщение"
            placeholderTextColor={colors.textMuted}
            multiline
            blurOnSubmit={false}
            submitBehavior="newline"
            onKeyPress={handleKeyPress}
            onSubmitEditing={() => {
              if (Platform.OS !== 'web') {
                void handleSend();
              }
            }}
          />
          </View>
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
                      <CrownOffIcon size={18} color="#9A6B2F" />
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
      </ScreenTransition>
  );
}
