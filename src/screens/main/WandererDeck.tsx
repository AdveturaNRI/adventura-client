import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useCallback, useEffect, useMemo, useRef, useState, type ComponentProps, type ReactNode } from 'react';
import {
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useIsDesktopWeb, useIsDesktopSidebarVisible } from '@/components/navigation/DesktopThemeToggle';
import { DESKTOP_SIDEBAR_WIDTH } from '@/components/navigation/MainDesktopSidebar';
import { MobileScreenHeader } from '@/components/navigation/MobileScreenHeader';
import { Button, UserCard, toast, type SwipeDismissRequest } from '@/components/ui';
import type { UserCardDeckSize } from '@/components/ui/cards/UserCard';
import { FontSize, Spacing, type ThemeColors } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useThemedStyles } from '@/hooks/use-themed-styles';
import { WANDERERS_SCREEN } from '@/screens/main/profile.config';
import { openConversationWith, unblockPeerByUserId } from '@/services/chats/chatsApi';
import {
  clearWandererReaction,
  upsertWandererReaction,
  type WandererBucket,
  type WandererCardItem,
  type WandererReactionType,
} from '@/services/profile/wanderersApi';
import { localizeErrorMessage } from '@/utils/localizeError';
import { wandererCardToUserCardProps } from '@/utils/wanderer-card';
import { useRouter } from 'expo-router';
const LIKE_COLOR = '#FFB800';
const DESKTOP_DECK_MAX_WIDTH = 980;
const DESKTOP_ACTION_RAIL_WIDTH = 68;
const DESKTOP_CARD_MIN_HEIGHT = 280;
const DESKTOP_CARD_MAX_HEIGHT = 520;
const DESKTOP_CARD_WIDTH_FROM_HEIGHT = (3 / 4) * (1 + 1.35);
const MOBILE_CARD_MIN_HEIGHT = 240;
const MOBILE_PHOTO_HEIGHT_RATIO = 0.64;
const MOBILE_PHOTO_MIN_HEIGHT = 180;
const MOBILE_PHOTO_ASPECT = 3 / 4;
const MOBILE_PHOTO_INSET = Spacing.md * 2;

const MOBILE_ACTION_FOOTER_HEIGHT = 72;
const MOBILE_HEADER_ESTIMATE = 84;

function getMobileDeckContentWidth(windowWidth: number): number {
  return Math.max(280, windowWidth - Spacing.md * 2);
}

function computeDesktopDeckSize(
  windowWidth: number,
  windowHeight: number,
  hasSidebar: boolean,
): UserCardDeckSize {
  // `inner` is maxWidth DESKTOP_DECK_MAX_WIDTH with horizontal xl padding —
  // card + action rail must fit in the content box inside that padding.
  const innerHorizontalPadding = Spacing.xl * 2;
  const innerContentMax = DESKTOP_DECK_MAX_WIDTH - innerHorizontalPadding;
  const rowGap = Spacing.lg;
  const railSlot = DESKTOP_ACTION_RAIL_WIDTH + rowGap;

  const horizontalChrome =
    (hasSidebar ? DESKTOP_SIDEBAR_WIDTH : 0) +
    innerHorizontalPadding +
    railSlot +
    Spacing.md;

  const maxCardWidth = Math.max(
    360,
    Math.min(innerContentMax - railSlot, windowWidth - horizontalChrome),
  );

  const availableHeight = Math.max(DESKTOP_CARD_MIN_HEIGHT, windowHeight - 168);
  let cardHeight = Math.min(
    DESKTOP_CARD_MAX_HEIGHT,
    Math.max(DESKTOP_CARD_MIN_HEIGHT, Math.round(availableHeight * 0.72)),
  );

  let idealWidth = Math.round(cardHeight * DESKTOP_CARD_WIDTH_FROM_HEIGHT);
  if (idealWidth > maxCardWidth) {
    cardHeight = Math.max(
      DESKTOP_CARD_MIN_HEIGHT,
      Math.round(maxCardWidth / DESKTOP_CARD_WIDTH_FROM_HEIGHT),
    );
  }

  if (cardHeight > availableHeight) {
    cardHeight = availableHeight;
  }

  let photoWidth = Math.round(cardHeight * (3 / 4));
  let bodyWidth = Math.round(photoWidth * 1.35);
  let cardWidth = photoWidth + bodyWidth;

  if (cardWidth > maxCardWidth) {
    const scale = maxCardWidth / cardWidth;
    cardHeight = Math.max(DESKTOP_CARD_MIN_HEIGHT, Math.round(cardHeight * scale));
    photoWidth = Math.round(cardHeight * (3 / 4));
    bodyWidth = Math.max(180, maxCardWidth - photoWidth);
    cardWidth = photoWidth + bodyWidth;
  }

  return {
    width: cardWidth,
    height: cardHeight,
    photoWidth,
  };
}

function computeMobileDeckSize(
  contentWidth: number,
  availableDeckHeight: number,
  photoHeightRatio = MOBILE_PHOTO_HEIGHT_RATIO,
): UserCardDeckSize {
  const cardWidth = contentWidth;
  const cardHeight = Math.max(MOBILE_CARD_MIN_HEIGHT, availableDeckHeight);
  const photoInnerWidth = cardWidth - MOBILE_PHOTO_INSET;
  let photoHeight = Math.round(photoInnerWidth / MOBILE_PHOTO_ASPECT);
  const maxPhotoHeight = Math.round(cardHeight * photoHeightRatio);
  photoHeight = Math.max(MOBILE_PHOTO_MIN_HEIGHT, Math.min(photoHeight, maxPhotoHeight));

  return {
    width: cardWidth,
    height: cardHeight,
    photoWidth: photoInnerWidth,
    photoHeight,
  };
}

type DeckActionIconSet = 'ionicons' | 'material-community';
type IoniconName = ComponentProps<typeof Ionicons>['name'];
type MaterialCommunityIconName = ComponentProps<typeof MaterialCommunityIcons>['name'];

function reactionToastMessage(
  nickname: string,
  type: WandererReactionType,
  mode: 'added' | 'moved' | 'removed',
): string {
  if (mode === 'removed') {
    return type === 'skipped'
      ? `${nickname} удалён из скрытых`
      : `${nickname} удалён из избранных`;
  }

  if (mode === 'moved') {
    return type === 'favorite'
      ? `${nickname} перенесён в избранные`
      : `${nickname} перенесён в скрытые`;
  }

  return type === 'favorite'
    ? `${nickname} добавлен в избранные`
    : `${nickname} добавлен в скрытые`;
}

type WandererDeckProps = {
  items: WandererCardItem[];
  bucket: WandererBucket;
  filtersSignature?: string;
  feedSourceEmpty?: boolean;
  filtersSlot?: ReactNode;
  onRestart?: () => void;
  onReactionSaved?: (targetUserId: string, type: WandererReactionType) => void;
  onReactionCleared?: (targetUserId: string, type: WandererReactionType) => void;
  onUnblocked?: (targetUserId: string) => void;
};

type DeckStyles = ReturnType<typeof createStyles>;

function createStyles(
  colors: ThemeColors,
  topPadding: number,
  bottomPadding: number,
  isDesktopWeb: boolean,
  isMobileNative: boolean,
) {
  return StyleSheet.create({
    root: {
      flex: 1,
      backgroundColor: colors.background,
      paddingTop: topPadding,
      paddingBottom: bottomPadding,
    },
    inner: {
      flex: 1,
      width: '100%',
      maxWidth: isDesktopWeb ? DESKTOP_DECK_MAX_WIDTH : undefined,
      alignSelf: 'center',
      alignItems: 'stretch',
      paddingHorizontal: isDesktopWeb ? Spacing.xl : isMobileNative ? Spacing.md : Spacing.lg,
      minHeight: 0,
    },
    header: {
      flexShrink: 0,
      gap: isMobileNative ? Spacing.sm : Spacing.xs,
      marginBottom: isMobileNative ? Spacing.sm : Spacing.sm,
      paddingTop: isDesktopWeb ? Spacing.sm : 0,
      width: '100%',
    },
    title: {
      fontSize: isDesktopWeb ? 26 : 24,
      fontWeight: '700',
      color: colors.text,
      letterSpacing: -0.3,
    },
    subtitle: {
      fontSize: FontSize.caption,
      color: colors.textMuted,
      lineHeight: FontSize.caption * 1.45,
    },
    desktopStage: {
      flex: 1,
      minHeight: 0,
      width: '100%',
      justifyContent: 'center',
      alignItems: 'center',
      overflow: 'visible',
    },
    desktopMainRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: Spacing.lg,
      overflow: 'visible',
    },
    deckColumn: {
      overflow: 'visible',
    },
    deckArea: {
      flex: isDesktopWeb ? undefined : 1,
      minHeight: 0,
      width: '100%',
      overflow: 'visible',
    },
    stack: {
      width: '100%',
      flex: isDesktopWeb ? undefined : 1,
      minHeight: 0,
      overflow: 'visible',
      position: 'relative',
      paddingBottom: 14,
    },
    previewShell: {
      ...StyleSheet.absoluteFill,
      borderRadius: 20,
      overflow: 'hidden',
      transform: [{ translateY: 12 }, { scale: 0.94 }],
      opacity: 0.45,
      zIndex: 0,
    },
    stackPlate: {
      ...StyleSheet.absoluteFill,
      borderRadius: 20,
      backgroundColor: colors.surfaceMuted,
      borderWidth: 1,
      borderColor: colors.borderLight,
      transform: [{ translateY: 12 }, { scale: 0.94 }],
      zIndex: 0,
    },
    swipeHintRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: Spacing.lg,
      marginTop: isDesktopWeb ? Spacing.md : Spacing.sm,
    },
    swipeHintItem: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    swipeHintLabel: {
      fontSize: FontSize.caption,
      color: colors.textMuted,
      fontWeight: '600',
    },
    swipeHintCaption: {
      marginTop: 4,
      textAlign: 'center',
      fontSize: FontSize.caption,
      color: colors.textSubtle,
    },
    activeCard: {
      width: '100%',
      flex: isDesktopWeb ? undefined : 1,
      minHeight: 0,
      zIndex: 1,
    },
    actionBar: {
      flexShrink: 0,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: isMobileNative ? Spacing.sm : Spacing.md,
      marginTop: isDesktopWeb ? Spacing.md : 0,
      alignSelf: 'stretch',
      paddingVertical: isMobileNative ? Spacing.xs : Spacing.sm,
      paddingHorizontal: isMobileNative ? Spacing.sm : Spacing.md,
      borderRadius: 28,
      borderWidth: 1,
      borderColor: colors.borderLight,
      backgroundColor: colors.surface,
      ...Platform.select({
        ios: {
          shadowColor: colors.shadow,
          shadowOffset: { width: 0, height: 8 },
          shadowOpacity: 0.06,
          shadowRadius: 20,
        },
        android: {
          elevation: 6,
        },
        default: {
          boxShadow: '0 8px 28px rgba(0, 0, 0, 0.06)',
        },
      }),
    },
    mobileFooter: {
      flexShrink: 0,
      paddingTop: Spacing.lg,
      paddingBottom: Spacing.xs,
    },
    actionRail: {
      flexShrink: 0,
      flexGrow: 0,
      width: DESKTOP_ACTION_RAIL_WIDTH,
      alignSelf: 'center',
      alignItems: 'center',
      gap: Spacing.sm,
      paddingVertical: Spacing.sm,
      paddingHorizontal: Spacing.sm,
      borderRadius: 24,
      borderWidth: 1,
      borderColor: colors.borderLight,
      backgroundColor: colors.surface,
      ...Platform.select({
        default: {
          boxShadow: '0 8px 28px rgba(0, 0, 0, 0.06)',
        },
      }),
    },
    actionButton: {
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
    },
    actionButtonSmall: {
      width: 42,
      height: 42,
      borderRadius: 21,
    },
    actionButtonLarge: {
      width: 52,
      height: 52,
      borderRadius: 26,
    },
    actionButtonDisabled: {
      opacity: 0.38,
    },
    emptyWrap: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      gap: Spacing.md,
      paddingHorizontal: Spacing.lg,
    },
    emptyTitle: {
      fontSize: 22,
      fontWeight: '700',
      color: colors.text,
      textAlign: 'center',
    },
    emptyText: {
      fontSize: FontSize.label,
      color: colors.textMuted,
      textAlign: 'center',
      lineHeight: FontSize.label * 1.5,
    },
    listScroll: {
      flex: 1,
      minHeight: 0,
      width: '100%',
      overflow: 'visible',
    },
    listContent: {
      gap: Spacing.md,
      paddingBottom: Spacing.xl,
      overflow: 'visible',
      ...(isDesktopWeb ? { alignItems: 'stretch' as const } : null),
    },
    listRow: {
      flexDirection: isDesktopWeb ? 'row' : 'column',
      alignItems: isDesktopWeb ? 'center' : 'stretch',
      gap: isDesktopWeb ? Spacing.lg : Spacing.sm,
      width: '100%',
      maxWidth: '100%',
      overflow: 'visible',
    },
    listCard: {
      ...(isDesktopWeb
        ? { flexGrow: 0, flexShrink: 0 }
        : { width: '100%' as const }),
      minWidth: 0,
      maxWidth: '100%',
      position: 'relative',
      overflow: 'visible',
    },
    listCardPressable: {
      ...(isDesktopWeb ? { flex: 1, minHeight: 0 } : { width: '100%' as const }),
    },
    cardMenuButton: {
      position: 'absolute',
      top: 12,
      right: 12,
      zIndex: 3,
      width: 36,
      height: 36,
      borderRadius: 18,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.overlay,
      borderWidth: 1,
      borderColor: colors.borderLight,
      ...Platform.select({
        default: {
          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.08)',
        },
      }),
    },
    cardMenuButtonPressed: {
      opacity: 0.85,
    },
    cardMenuRoot: {
      flex: 1,
    },
    cardMenuBackdrop: {
      ...StyleSheet.absoluteFill,
    },
    cardMenu: {
      position: 'absolute',
      minWidth: 220,
      paddingVertical: Spacing.xs,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      shadowColor: colors.shadow,
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.12,
      shadowRadius: 24,
      elevation: 8,
    },
    cardMenuItem: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.sm,
      paddingHorizontal: Spacing.md,
      paddingVertical: Spacing.sm + 2,
    },
    cardMenuItemPressed: {
      backgroundColor: colors.surfaceMuted,
    },
    cardMenuItemLabel: {
      fontSize: FontSize.label,
      fontWeight: '500',
      color: colors.destructive,
    },
  });
}

export function WandererDeck({
  items,
  bucket,
  filtersSignature = '',
  feedSourceEmpty = false,
  filtersSlot,
  onRestart,
  onReactionSaved,
  onReactionCleared,
  onUnblocked,
}: WandererDeckProps) {
  const colors = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const isDesktopWeb = useIsDesktopWeb();
  const isMobileNative = !isDesktopWeb;
  const hasDesktopSidebar = useIsDesktopSidebarVisible();
  const showCompactNav = !hasDesktopSidebar;
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const topPadding = hasDesktopSidebar ? Spacing.xl : insets.top + Spacing.md;
  const bottomPadding = hasDesktopSidebar ? Spacing.lg : insets.bottom;
  const desktopDeckSize = useMemo(
    () =>
      isDesktopWeb
        ? computeDesktopDeckSize(windowWidth, windowHeight, hasDesktopSidebar)
        : null,
    [hasDesktopSidebar, isDesktopWeb, windowHeight, windowWidth],
  );
  const [headerHeight, setHeaderHeight] = useState(MOBILE_HEADER_ESTIMATE);
  const mobileDeckSize = useMemo(() => {
    if (isDesktopWeb) {
      return null;
    }

    const contentWidth = getMobileDeckContentWidth(windowWidth);
    const availableDeckHeight =
      windowHeight -
      topPadding -
      headerHeight -
      MOBILE_ACTION_FOOTER_HEIGHT -
      Spacing.lg;

    return computeMobileDeckSize(contentWidth, availableDeckHeight);
  }, [headerHeight, isDesktopWeb, topPadding, windowHeight, windowWidth]);
  const mobileListDeckSize = useMemo(() => {
    if (isDesktopWeb || !mobileDeckSize) {
      return null;
    }

    return computeMobileDeckSize(
      mobileDeckSize.width,
      Math.min(420, mobileDeckSize.height),
    );
  }, [isDesktopWeb, mobileDeckSize]);
  const deckSize = desktopDeckSize ?? mobileDeckSize;
  const styles = useThemedStyles((themeColors) =>
    createStyles(themeColors, topPadding, bottomPadding, isDesktopWeb, isMobileNative),
  );

  const [index, setIndex] = useState(0);
  const [history, setHistory] = useState<number[]>([]);
  const [reactionHistory, setReactionHistory] = useState<WandererReactionType[]>([]);
  const [feedUndoIds, setFeedUndoIds] = useState<string[]>([]);
  const [dismissRequest, setDismissRequest] = useState<SwipeDismissRequest | null>(null);
  const [isReacting, setIsReacting] = useState(false);
  const [cardMenuTarget, setCardMenuTarget] = useState<WandererCardItem | null>(null);
  const [cardMenuAnchor, setCardMenuAnchor] = useState<{
    x: number;
    y: number;
    width: number;
    height: number;
  } | null>(null);
  const cardMenuTriggerRefs = useRef<Record<string, View | null>>({});

  useEffect(() => {
    setIndex(0);
    setHistory([]);
    setReactionHistory([]);
    setFeedUndoIds([]);
    setDismissRequest(null);
    setIsReacting(false);
    setCardMenuTarget(null);
    setCardMenuAnchor(null);
  }, [bucket, filtersSignature]);

  useEffect(() => {
    setIndex((prev) => {
      if (items.length === 0) {
        return 0;
      }

      return Math.min(prev, items.length - 1);
    });
  }, [items.length]);

  const total = items.length;
  const isEmptyFiltered = total === 0;
  const currentItem = items[index] ?? null;
  const nextItem = items[index + 1] ?? null;
  const isFinished = !isEmptyFiltered && index >= total;
  const canUndo =
    !isReacting &&
    (bucket === 'feed' ? feedUndoIds.length > 0 : history.length > 0);

  const currentCardProps = useMemo(
    () => (currentItem ? wandererCardToUserCardProps(currentItem) : null),
    [currentItem],
  );

  const nextCardProps = useMemo(
    () => (nextItem ? wandererCardToUserCardProps(nextItem) : null),
    [nextItem],
  );

  const subtitle = useMemo(() => {
    if (bucket === 'favorites') {
      return WANDERERS_SCREEN.subtitleFavorites;
    }

    if (bucket === 'skipped') {
      return WANDERERS_SCREEN.subtitleSkipped;
    }

    return isDesktopWeb ? WANDERERS_SCREEN.subtitleDesktop : WANDERERS_SCREEN.subtitle;
  }, [bucket, isDesktopWeb]);

  const advance = useCallback(() => {
    setHistory((prev) => [...prev, index]);
    setIndex((prev) => prev + 1);
    setDismissRequest(null);
  }, [index]);

  const persistReaction = useCallback(
    async (
      type: WandererReactionType,
      options?: {
        item?: WandererCardItem;
        advanceCard?: boolean;
        toastMode?: 'added' | 'moved' | 'none';
      },
    ): Promise<boolean> => {
      const target = options?.item ?? currentItem;

      if (!target || isReacting) {
        return false;
      }

      if (target.blockedByMe && type === 'favorite') {
        toast.error('Сначала разблокируйте пользователя');
        return false;
      }

      const toastMode =
        options?.toastMode ??
        (bucket === 'feed' ? 'added' : bucket === 'favorites' || bucket === 'skipped' ? 'moved' : 'none');
      const advanceCard = options?.advanceCard ?? false;

      setIsReacting(true);

      // В ленте сразу убираем карточку — иначе анимация входа дважды
      // крутит одного и того же человека, пока ждём ответ API.
      if (bucket === 'feed') {
        setReactionHistory((prev) => [...prev, type]);
        setFeedUndoIds((prev) => [...prev, target.id]);
        onReactionSaved?.(target.id, type);
      }

      try {
        await upsertWandererReaction(target.id, type);

        if (bucket !== 'feed') {
          onReactionSaved?.(target.id, type);
          if (advanceCard) {
            advance();
          }
        }

        if (toastMode !== 'none') {
          toast.success(reactionToastMessage(target.nickname, type, toastMode));
        }

        setDismissRequest(null);
        return true;
      } catch (error) {
        if (bucket === 'feed') {
          setFeedUndoIds((prev) => prev.slice(0, -1));
          setReactionHistory((prev) => prev.slice(0, -1));
          onReactionCleared?.(target.id, type);
        }
        toast.error(localizeErrorMessage(error, 'Не удалось сохранить реакцию'));
        setDismissRequest(null);
        return false;
      } finally {
        setIsReacting(false);
      }
    },
    [advance, bucket, currentItem, isReacting, onReactionCleared, onReactionSaved],
  );

  const handleDismiss = useCallback(
    async (direction: 'left' | 'right') => {
      const type = direction === 'right' ? 'favorite' : 'skipped';
      await persistReaction(type);
    },
    [persistReaction],
  );

  const requestDismiss = useCallback(
    (direction: 'left' | 'right') => {
      if (isReacting) {
        return;
      }

      setDismissRequest({ direction, token: Date.now() });
    },
    [isReacting],
  );

  const handleUndo = useCallback(async () => {
    if (isReacting) {
      return;
    }

    if (bucket === 'feed') {
      if (feedUndoIds.length === 0) {
        return;
      }

      const itemId = feedUndoIds[feedUndoIds.length - 1];
      const clearedType = reactionHistory[reactionHistory.length - 1];

      setIsReacting(true);

      try {
        await clearWandererReaction(itemId);
        if (clearedType) {
          onReactionCleared?.(itemId, clearedType);
        }

        setFeedUndoIds((prev) => prev.slice(0, -1));
        setReactionHistory((prev) => prev.slice(0, -1));
        setDismissRequest(null);
      } catch (error) {
        toast.error(localizeErrorMessage(error, 'Не удалось отменить'));
      } finally {
        setIsReacting(false);
      }

      return;
    }

    if (history.length === 0) {
      return;
    }

    const previousIndex = history[history.length - 1];
    const previousItem = items[previousIndex];
    const clearedType =
      bucket === 'favorites'
        ? 'favorite'
        : bucket === 'skipped'
          ? 'skipped'
          : reactionHistory[reactionHistory.length - 1];

    setIsReacting(true);

    try {
      if (previousItem) {
        await clearWandererReaction(previousItem.id);
        if (clearedType) {
          onReactionCleared?.(previousItem.id, clearedType);
        }
      }

      setHistory((prev) => prev.slice(0, -1));
      setReactionHistory((prev) => prev.slice(0, -1));
      setIndex(previousIndex);
      setDismissRequest(null);
    } catch (error) {
      toast.error(localizeErrorMessage(error, 'Не удалось отменить'));
    } finally {
      setIsReacting(false);
    }
  }, [bucket, feedUndoIds, history, isReacting, items, onReactionCleared, reactionHistory]);

  const handleRestart = useCallback(() => {
    setIndex(0);
    setHistory([]);
    setReactionHistory([]);
    setFeedUndoIds([]);
    setDismissRequest(null);
    onRestart?.();
  }, [onRestart]);

  const handleRemoveFromList = useCallback(async (item?: WandererCardItem) => {
    const target = item ?? currentItem;

    if (!target || isReacting || (bucket !== 'favorites' && bucket !== 'skipped')) {
      return;
    }

    if (target.blockedByMe) {
      toast.error('Сначала разблокируйте пользователя');
      return;
    }

    const clearedType: WandererReactionType = bucket === 'favorites' ? 'favorite' : 'skipped';

    setIsReacting(true);

    try {
      await clearWandererReaction(target.id);
      onReactionCleared?.(target.id, clearedType);
      toast.success(reactionToastMessage(target.nickname, clearedType, 'removed'));
      setDismissRequest(null);
    } catch (error) {
      toast.error(
        localizeErrorMessage(
          error,
          bucket === 'favorites'
            ? 'Не удалось удалить из избранных'
            : 'Не удалось удалить из скрытых',
        ),
      );
    } finally {
      setIsReacting(false);
    }
  }, [bucket, currentItem, isReacting, onReactionCleared]);

  const handleChat = useCallback(
    async (item?: WandererCardItem) => {
      const target = item ?? currentItem;
      if (!target) {
        return;
      }

      try {
        const conversation = await openConversationWith(target.id);
        router.push(`/chats/${conversation.id}`);
      } catch (error) {
        toast.error(localizeErrorMessage(error, 'Не удалось открыть чат'));
      }
    },
    [currentItem, router],
  );

  const handleUnblock = useCallback(
    async (item?: WandererCardItem) => {
      const target = item ?? currentItem;
      if (!target?.blockedByMe || isReacting) {
        return;
      }

      setIsReacting(true);
      try {
        await unblockPeerByUserId(target.id);
        onUnblocked?.(target.id);
        toast.success(`${target.nickname} разблокирован`);
      } catch (error) {
        toast.error(localizeErrorMessage(error, 'Не удалось разблокировать'));
      } finally {
        setIsReacting(false);
      }
    },
    [currentItem, isReacting, onUnblocked],
  );

  const feedLikeButton = (
    <DeckActionButton
      styles={styles}
      size="large"
      disabled={isReacting || !currentItem}
      icon="crown"
      iconSet="material-community"
      backgroundColor={LIKE_COLOR}
      borderColor={LIKE_COLOR}
      iconColor={colors.onPrimary}
      onPress={() => requestDismiss('right')}
      accessibilityLabel={WANDERERS_SCREEN.likeAction}
    />
  );

  const feedActionButtons = (
    <>
      <DeckActionButton
        styles={styles}
        size="large"
        disabled={!canUndo}
        icon="arrow-undo-outline"
        backgroundColor={colors.surfaceMuted}
        borderColor={colors.border}
        iconColor={colors.primary}
        onPress={() => {
          void handleUndo();
        }}
        accessibilityLabel={WANDERERS_SCREEN.undoAction}
      />

      <DeckActionButton
        styles={styles}
        size="large"
        disabled={isReacting || !currentItem}
        icon="eye-off-outline"
        backgroundColor={colors.surface}
        borderColor={colors.destructive}
        iconColor={colors.destructive}
        onPress={() => requestDismiss('left')}
        accessibilityLabel={WANDERERS_SCREEN.passAction}
      />

      <DeckActionButton
        styles={styles}
        size="large"
        disabled={isReacting || !currentItem}
        icon="chatbubble-ellipses-outline"
        backgroundColor={colors.primary}
        borderColor={colors.primary}
        iconColor={colors.onPrimary}
        onPress={() => {
          void handleChat();
        }}
        accessibilityLabel={WANDERERS_SCREEN.chatAction}
      />

      {feedLikeButton}
    </>
  );

  const renderListActions = (item: WandererCardItem) => (
    <>
      <DeckActionButton
        styles={styles}
        size="large"
        disabled={isReacting}
        icon="chatbubble-ellipses-outline"
        backgroundColor={colors.primary}
        borderColor={colors.primary}
        iconColor={colors.onPrimary}
        onPress={() => {
          void handleChat(item);
        }}
        accessibilityLabel={WANDERERS_SCREEN.chatAction}
      />

      {bucket === 'skipped' ? (
        item.blockedByMe ? (
          <DeckActionButton
            styles={styles}
            size="large"
            disabled={isReacting}
            icon="lock-open-outline"
            backgroundColor={colors.surface}
            borderColor={colors.primary}
            iconColor={colors.primary}
            onPress={() => {
              void handleUnblock(item);
            }}
            accessibilityLabel={WANDERERS_SCREEN.unblockAction}
          />
        ) : (
          <DeckActionButton
            styles={styles}
            size="large"
            disabled={isReacting}
            icon="crown"
            iconSet="material-community"
            backgroundColor={LIKE_COLOR}
            borderColor={LIKE_COLOR}
            iconColor={colors.onPrimary}
            onPress={() => {
              void persistReaction('favorite', { item });
            }}
            accessibilityLabel={WANDERERS_SCREEN.moveToFavoritesAction}
          />
        )
      ) : (
        <DeckActionButton
          styles={styles}
          size="large"
          disabled={isReacting}
          icon="eye-off-outline"
          backgroundColor={colors.surface}
          borderColor={colors.destructive}
          iconColor={colors.destructive}
          onPress={() => {
            void persistReaction('skipped', { item });
          }}
          accessibilityLabel={WANDERERS_SCREEN.moveToSkippedAction}
        />
      )}
    </>
  );

  const emptyCopy = useMemo(() => {
    if (!feedSourceEmpty) {
      return {
        title: WANDERERS_SCREEN.emptyFiltered,
        hint: WANDERERS_SCREEN.emptyFilteredHint,
      };
    }

    if (bucket === 'favorites') {
      return {
        title: WANDERERS_SCREEN.emptyFavorites,
        hint: WANDERERS_SCREEN.emptyFavoritesHint,
      };
    }

    if (bucket === 'skipped') {
      return {
        title: WANDERERS_SCREEN.emptySkipped,
        hint: WANDERERS_SCREEN.emptySkippedHint,
      };
    }

    return {
      title: WANDERERS_SCREEN.empty,
      hint: WANDERERS_SCREEN.emptyHint,
    };
  }, [bucket, feedSourceEmpty]);

  const finishedCopy = useMemo(() => {
    if (bucket === 'favorites') {
      return {
        title: WANDERERS_SCREEN.finishedFavoritesTitle,
        hint: WANDERERS_SCREEN.finishedFavoritesHint,
      };
    }

    if (bucket === 'skipped') {
      return {
        title: WANDERERS_SCREEN.finishedSkippedTitle,
        hint: WANDERERS_SCREEN.finishedSkippedHint,
      };
    }

    return {
      title: WANDERERS_SCREEN.finishedTitle,
      hint: WANDERERS_SCREEN.finishedHint,
    };
  }, [bucket]);

  const closeCardMenu = useCallback(() => {
    setCardMenuTarget(null);
    setCardMenuAnchor(null);
  }, []);

  const openCardMenu = useCallback((item: WandererCardItem) => {
    const trigger = cardMenuTriggerRefs.current[item.id];

    if (!trigger) {
      setCardMenuAnchor(null);
      setCardMenuTarget(item);
      return;
    }

    trigger.measureInWindow((x, y, width, height) => {
      setCardMenuAnchor({ x, y, width, height });
      setCardMenuTarget(item);
    });
  }, []);

  const renderHeader = (headerSubtitle: string) => {
    const onHeaderLayout = (event: { nativeEvent: { layout: { height: number } } }) => {
      if (isDesktopWeb) {
        return;
      }
      const nextHeight = Math.ceil(event.nativeEvent.layout.height);
      setHeaderHeight((prev) => (prev === nextHeight ? prev : nextHeight));
    };

    if (showCompactNav) {
      return (
        <View style={styles.header} onLayout={onHeaderLayout}>
          <MobileScreenHeader title={WANDERERS_SCREEN.title} />
          {filtersSlot}
        </View>
      );
    }

    return (
      <View style={styles.header} onLayout={onHeaderLayout}>
        <Text style={styles.title}>{WANDERERS_SCREEN.title}</Text>
        <Text style={styles.subtitle}>{headerSubtitle}</Text>
        {filtersSlot}
      </View>
    );
  };

  if (isEmptyFiltered) {
    return (
      <View style={styles.root}>
        <View style={styles.inner}>
          {renderHeader(subtitle)}
          <View style={styles.emptyWrap}>
            <Text style={styles.emptyTitle}>{emptyCopy.title}</Text>
            <Text style={styles.emptyText}>{emptyCopy.hint}</Text>
          </View>
        </View>
      </View>
    );
  }

  const isListBucket = bucket === 'favorites' || bucket === 'skipped';

  if (isListBucket) {
    const listLayout = isDesktopWeb ? 'deckWide' : 'deck';
    const removeLabel =
      bucket === 'favorites'
        ? WANDERERS_SCREEN.removeFavoriteAction
        : WANDERERS_SCREEN.removeHiddenAction;
    const cardMenuStyle = cardMenuAnchor
      ? {
          top: cardMenuAnchor.y + cardMenuAnchor.height + 6,
          left: Math.max(Spacing.md, cardMenuAnchor.x + cardMenuAnchor.width - 220),
          maxWidth: windowWidth - Spacing.md * 2,
        }
      : cardMenuTarget
        ? {
            top: Spacing.xl * 2,
            right: Spacing.lg,
            maxWidth: windowWidth - Spacing.md * 2,
          }
        : null;

    return (
      <View style={styles.root}>
        <View style={styles.inner}>
          {renderHeader(subtitle)}
          <ScrollView
            style={styles.listScroll}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}>
            {items.map((item) => {
              const cardProps = wandererCardToUserCardProps(item);
              const listDeckSize = isDesktopWeb ? deckSize : mobileListDeckSize;

              return (
                <View key={item.id} style={styles.listRow}>
                  <View
                    style={[
                      styles.listCard,
                      listDeckSize &&
                        (isDesktopWeb
                          ? { width: listDeckSize.width, height: listDeckSize.height }
                          : { width: '100%' }),
                    ]}>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`Анкета ${item.nickname}`}
                      onPress={() => router.push(`/users/${item.id}`)}
                      style={styles.listCardPressable}>
                      <UserCard
                        {...cardProps}
                        layout={listLayout}
                        deckSize={listDeckSize ?? undefined}
                        deckFill={isDesktopWeb}
                        size="compact"
                        showVisibility={false}
                      />
                    </Pressable>
                    <View
                      ref={(node) => {
                        cardMenuTriggerRefs.current[item.id] = node;
                      }}
                      collapsable={false}
                      style={styles.cardMenuButton}>
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={WANDERERS_SCREEN.moreActionsLabel}
                        disabled={isReacting}
                        onPress={() => openCardMenu(item)}
                        style={({ pressed }) => [
                          {
                            flex: 1,
                            alignItems: 'center',
                            justifyContent: 'center',
                          },
                          pressed && styles.cardMenuButtonPressed,
                        ]}>
                        <Ionicons name="ellipsis-vertical" size={18} color={colors.text} />
                      </Pressable>
                    </View>
                  </View>
                  {isDesktopWeb ? (
                    <View style={styles.actionRail}>{renderListActions(item)}</View>
                  ) : (
                    <View style={styles.actionBar}>{renderListActions(item)}</View>
                  )}
                </View>
              );
            })}
          </ScrollView>
        </View>

        <Modal
          visible={cardMenuTarget != null}
          transparent
          animationType="fade"
          onRequestClose={closeCardMenu}>
          <View style={styles.cardMenuRoot}>
            <Pressable style={styles.cardMenuBackdrop} onPress={closeCardMenu} />
            {cardMenuStyle ? (
              <View style={[styles.cardMenu, cardMenuStyle]}>
                {cardMenuTarget?.blockedByMe ? (
                  <Pressable
                    accessibilityRole="button"
                    disabled={isReacting}
                    onPress={() => {
                      const target = cardMenuTarget;
                      closeCardMenu();
                      if (target) {
                        void handleUnblock(target);
                      }
                    }}
                    style={({ pressed }) => [
                      styles.cardMenuItem,
                      pressed && styles.cardMenuItemPressed,
                    ]}>
                    <Ionicons name="lock-open-outline" size={18} color={colors.primary} />
                    <Text style={[styles.cardMenuItemLabel, { color: colors.primary }]}>
                      {WANDERERS_SCREEN.unblockAction}
                    </Text>
                  </Pressable>
                ) : (
                  <Pressable
                    accessibilityRole="button"
                    disabled={isReacting}
                    onPress={() => {
                      const target = cardMenuTarget;
                      closeCardMenu();
                      if (target) {
                        void handleRemoveFromList(target);
                      }
                    }}
                    style={({ pressed }) => [
                      styles.cardMenuItem,
                      pressed && styles.cardMenuItemPressed,
                    ]}>
                    <Ionicons name="trash-outline" size={18} color={colors.destructive} />
                    <Text style={styles.cardMenuItemLabel}>{removeLabel}</Text>
                  </Pressable>
                )}
              </View>
            ) : null}
          </View>
        </Modal>
      </View>
    );
  }

  if (isFinished) {
    return (
      <View style={styles.root}>
        <View style={styles.inner}>
          {renderHeader(WANDERERS_SCREEN.finishedSubtitle)}
          <View style={styles.emptyWrap}>
            <Text style={styles.emptyTitle}>{finishedCopy.title}</Text>
            <Text style={styles.emptyText}>{finishedCopy.hint}</Text>
            {canUndo && bucket === 'feed' ? (
              <Button
                label={WANDERERS_SCREEN.undoAction}
                variant="outline"
                onPress={() => {
                  void handleUndo();
                }}
              />
            ) : null}
            <Button label={WANDERERS_SCREEN.restartLabel} onPress={handleRestart} />
          </View>
        </View>
      </View>
    );
  }

  if (!currentCardProps || !currentItem) {
    return null;
  }

  const cardLayout = isDesktopWeb ? 'deckWide' : 'deck';

  const deckContent = (
    <View
      style={[
        styles.deckArea,
        deckSize &&
          (isDesktopWeb
            ? { width: deckSize.width, height: deckSize.height }
            : { height: deckSize.height }),
      ]}>
      <View
        style={[
          styles.stack,
          deckSize &&
            (isDesktopWeb
              ? { width: deckSize.width, height: deckSize.height }
              : { height: deckSize.height }),
        ]}>
        {nextCardProps ? (
          <View pointerEvents="none" style={styles.previewShell}>
            <UserCard
              {...nextCardProps}
              layout={cardLayout}
              deckSize={deckSize ?? undefined}
              size="compact"
              showVisibility={false}
            />
          </View>
        ) : (
          <View pointerEvents="none" style={styles.stackPlate} />
        )}

        <View
          style={[
            styles.activeCard,
            deckSize &&
              (isDesktopWeb
                ? { width: deckSize.width, height: deckSize.height }
                : { height: deckSize.height }),
          ]}>
          <UserCard
            {...currentCardProps}
            layout={cardLayout}
            deckSize={deckSize ?? undefined}
            size="compact"
            showVisibility={false}
            swipe={{
                    dismissible: true,
                    resetKey: `${currentItem.id}-${index}`,
                    dismissRequest,
                    leftAction: {
                      label: WANDERERS_SCREEN.likeAction,
                      backgroundColor: LIKE_COLOR,
                      textColor: colors.onPrimary,
                    },
                    rightAction: {
                      label: WANDERERS_SCREEN.passAction,
                      backgroundColor: colors.destructive,
                      textColor: colors.onPrimary,
                    },
                    onDismiss: handleDismiss,
                  }}
          />
        </View>
      </View>
    </View>
  );

  const swipeHint = (
    <View>
      <View style={styles.swipeHintRow}>
        <View style={styles.swipeHintItem}>
          <Ionicons name="arrow-back" size={14} color={colors.destructive} />
          <Text style={styles.swipeHintLabel}>{WANDERERS_SCREEN.swipeHintPass}</Text>
        </View>
        <View style={styles.swipeHintItem}>
          <Text style={styles.swipeHintLabel}>{WANDERERS_SCREEN.swipeHintLike}</Text>
          <Ionicons name="arrow-forward" size={14} color={LIKE_COLOR} />
        </View>
      </View>
      <Text style={styles.swipeHintCaption}>{WANDERERS_SCREEN.swipeHint}</Text>
    </View>
  );

  return (
    <View style={styles.root}>
      <View style={styles.inner}>
        {renderHeader(subtitle)}

        {isDesktopWeb ? (
          <View style={styles.desktopStage}>
            <View style={styles.desktopMainRow}>
              <View style={styles.deckColumn}>
                {deckContent}
                {swipeHint}
              </View>
              <View style={styles.actionRail}>{feedActionButtons}</View>
            </View>
          </View>
        ) : (
          <>
            {deckContent}
            <View style={styles.mobileFooter}>
              <View style={styles.actionBar}>{feedActionButtons}</View>
            </View>
          </>
        )}
      </View>
    </View>
  );
}

function DeckActionButton({
  styles,
  size,
  icon,
  iconSet = 'ionicons',
  backgroundColor,
  borderColor,
  iconColor,
  disabled = false,
  onPress,
  accessibilityLabel,
}: {
  styles: DeckStyles;
  size: 'small' | 'large';
  icon: IoniconName | MaterialCommunityIconName;
  iconSet?: DeckActionIconSet;
  backgroundColor: string;
  borderColor: string;
  iconColor: string;
  disabled?: boolean;
  onPress: () => void;
  accessibilityLabel: string;
}) {
  const iconSize = size === 'large' ? 26 : 22;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.actionButton,
        size === 'large' ? styles.actionButtonLarge : styles.actionButtonSmall,
        {
          backgroundColor,
          borderColor,
          transform: [{ scale: pressed ? 0.94 : 1 }],
        },
        disabled && styles.actionButtonDisabled,
      ]}>
      {iconSet === 'material-community' ? (
        <MaterialCommunityIcons
          name={icon as MaterialCommunityIconName}
          size={iconSize}
          color={iconColor}
        />
      ) : (
        <Ionicons name={icon as IoniconName} size={iconSize} color={iconColor} />
      )}
    </Pressable>
  );
}
