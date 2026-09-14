import { Image } from 'expo-image';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { type ComponentProps, useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import { DeleteGameDialog } from '@/components/games/DeleteGameDialog';
import { useIsDesktopSidebarVisible, useIsDesktopWeb } from '@/components/navigation/DesktopThemeToggle';
import { MobileBackButton } from '@/components/navigation/MobileBackButton';
import { ScreenTransition } from '@/components/navigation/ScreenTransition';
import { UserAvatar } from '@/components/navigation/UserAvatar';
import { Button, toast } from '@/components/ui';
import { FontSize, Radius, Spacing, type ThemeColors } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useThemedStyles } from '@/hooks/use-themed-styles';
import { openConversationWith, openGameChat } from '@/services/chats/chatsApi';
import {
  acceptGameApplication,
  deleteGame,
  getGameManage,
  rejectGameApplication,
  removeGamePlayer,
  updateGameStatus,
  type GameManagePayload,
  type GamePersonItem,
  type GameStatus,
} from '@/services/games/gamesApi';
import { pickProfileCardUrl } from '@/services/profile/profileApi';
import { localizeErrorMessage } from '@/utils/localizeError';
import { DEFAULT_TIMEZONE, formatDateTimeInTimezone, formatTimezoneLabel } from '@/utils/timezones';

type IoniconName = ComponentProps<typeof Ionicons>['name'];

type ActionTone = 'primary' | 'ghost' | 'danger';

function formatAppliedAt(iso: string): string {
  try {
    return new Date(iso).toLocaleString('ru-RU', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

type PersonAction = {
  label: string;
  icon: IoniconName;
  onPress: () => void;
  tone?: ActionTone;
};

function statusMeta(status: GameStatus): {
  label: string;
  icon: IoniconName;
  color: string;
} {
  if (status === 'CLOSED') {
    return { label: 'Набор закрыт', icon: 'lock-closed', color: '#FF9500' };
  }
  if (status === 'FINISHED') {
    return { label: 'Завершена', icon: 'flag', color: '#8E8E93' };
  }
  return { label: 'Набор открыт', icon: 'radio-button-on', color: '#34C759' };
}

function CoverBadge({
  icon,
  label,
  backgroundColor,
  styles,
}: {
  icon: IoniconName;
  label: string;
  backgroundColor: string;
  styles: ReturnType<typeof createStyles>;
}) {
  return (
    <View style={[styles.coverBadge, { backgroundColor }]}>
      <Ionicons name={icon} size={12} color="#FFFFFF" />
      <Text style={styles.coverBadgeText} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

function MetaBadge({
  icon,
  label,
  styles,
  colors,
  tone = 'primary',
}: {
  icon: IoniconName;
  label: string;
  styles: ReturnType<typeof createStyles>;
  colors: ThemeColors;
  tone?: 'primary' | 'success' | 'accent';
}) {
  const iconColor =
    tone === 'success' ? colors.success : tone === 'accent' ? '#FF9500' : colors.primary;

  return (
    <View
      style={[
        styles.metaBadge,
        tone === 'success' && styles.metaBadgeSuccess,
        tone === 'accent' && styles.metaBadgeAccent,
      ]}>
      <Ionicons name={icon} size={13} color={iconColor} />
      <Text
        style={[
          styles.metaBadgeText,
          tone === 'success' && styles.metaBadgeTextSuccess,
          tone === 'accent' && styles.metaBadgeTextAccent,
        ]}
        numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

function PersonCard({
  person,
  styles,
  colors,
  actions,
  onRemove,
  showAppliedAt,
  accent = 'primary',
}: {
  person: GamePersonItem;
  styles: ReturnType<typeof createStyles>;
  colors: ThemeColors;
  actions: PersonAction[];
  onRemove?: () => void;
  showAppliedAt?: boolean;
  accent?: 'primary' | 'success';
}) {
  const title =
    person.age != null ? `${person.nickname}, ${person.age}` : person.nickname;
  const accentColor = accent === 'success' ? colors.success : colors.primary;
  const isPlayers = accent === 'success';

  return (
    <View style={[styles.personCard, isPlayers && styles.personCardPlayers]}>
      {onRemove ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Убрать из игры"
          onPress={onRemove}
          hitSlop={8}
          style={({ pressed }) => [styles.removeBtn, pressed && { opacity: 0.75 }]}>
          <Ionicons name="trash-outline" size={15} color={colors.destructive} />
        </Pressable>
      ) : null}

      <View style={[styles.personTop, onRemove ? styles.personTopWithRemove : null]}>
        <UserAvatar nickname={person.nickname} avatarUrl={person.avatarUrl} size={44} />
        <View style={styles.personCopy}>
          <Text style={styles.personName} numberOfLines={1}>
            {title}
          </Text>
          {showAppliedAt ? (
            <Text style={styles.personMeta}>Подана {formatAppliedAt(person.createdAt)}</Text>
          ) : null}
          {person.about ? (
            <Text style={styles.personAbout} numberOfLines={2}>
              {person.about}
            </Text>
          ) : null}
        </View>
      </View>

      {person.message?.trim() ? (
        <View style={styles.applicationMessage}>
          <Text style={styles.applicationMessageLabel}>Сообщение к заявке</Text>
          <Text style={styles.applicationMessageText}>{person.message.trim()}</Text>
        </View>
      ) : null}

      <View style={styles.personActions}>
        {actions.map((action) => {
          const tone = action.tone ?? 'ghost';
          const iconColor =
            tone === 'primary'
              ? colors.onPrimary
              : tone === 'danger'
                ? colors.destructive
                : accentColor;

          return (
            <Pressable
              key={action.label}
              accessibilityRole="button"
              onPress={action.onPress}
              style={({ pressed }) => [
                styles.actionChip,
                tone === 'primary' && styles.actionChipPrimary,
                tone === 'danger' && styles.actionChipDanger,
                tone === 'ghost' &&
                  (isPlayers ? styles.actionChipGhostPlayers : styles.actionChipGhost),
                pressed && { opacity: 0.82 },
              ]}>
              <Ionicons name={action.icon} size={14} color={iconColor} />
              <Text
                style={[
                  styles.actionChipLabel,
                  tone === 'primary' && styles.actionChipLabelOnColor,
                  tone === 'danger' && styles.actionChipLabelDanger,
                  tone === 'ghost' &&
                    (isPlayers
                      ? styles.actionChipLabelGhostPlayers
                      : styles.actionChipLabelGhost),
                ]}>
                {action.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

function createStyles(colors: ThemeColors, isDesktopWeb: boolean, topPadding: number) {
  return StyleSheet.create({
    root: {
      flex: 1,
      backgroundColor: colors.background,
    },
    scroll: {
      flex: 1,
    },
    content: {
      width: '100%',
      maxWidth: isDesktopWeb ? 720 : undefined,
      alignSelf: 'center',
      paddingHorizontal: Spacing.lg,
      paddingTop: topPadding,
      paddingBottom: Spacing.xl * 2,
      gap: Spacing.lg,
    },
    headerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      minHeight: 40,
      gap: Spacing.sm,
    },
    headerTitle: {
      flex: 1,
      fontSize: isDesktopWeb ? 26 : 20,
      fontWeight: '700',
      color: colors.text,
      letterSpacing: -0.3,
      textAlign: isDesktopWeb ? 'left' : 'center',
    },
    headerActions: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.xs,
    },
    headerEdit: {
      minWidth: 40,
      height: 40,
      borderRadius: 20,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'rgba(21, 122, 254, 0.1)',
    },
    headerDelete: {
      minWidth: 40,
      height: 40,
      borderRadius: 20,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'rgba(255, 59, 48, 0.12)',
    },
    headerEditLabel: {
      fontSize: FontSize.label,
      fontWeight: '600',
      color: colors.primary,
      paddingHorizontal: Spacing.sm,
    },
    headerDeleteLabel: {
      fontSize: FontSize.label,
      fontWeight: '600',
      color: colors.destructive,
      paddingHorizontal: Spacing.sm,
    },
    coverFrame: {
      width: '100%',
      aspectRatio: 16 / 9,
      borderRadius: 20,
      overflow: 'hidden',
      backgroundColor: colors.surfaceMuted,
      borderWidth: 1,
      borderColor: colors.borderLight,
    },
    coverImage: {
      ...StyleSheet.absoluteFillObject,
      width: '100%',
      height: '100%',
    },
    coverPlaceholder: {
      ...StyleSheet.absoluteFillObject,
      alignItems: 'center',
      justifyContent: 'center',
      gap: Spacing.xs,
      backgroundColor: colors.surfaceMuted,
    },
    coverPlaceholderLabel: {
      fontSize: FontSize.caption,
      color: colors.textMuted,
    },
    coverGradient: {
      ...StyleSheet.absoluteFillObject,
      ...Platform.select({
        web: {
          backgroundImage:
            'linear-gradient(to top, rgba(0,0,0,0.72) 0%, rgba(0,0,0,0.22) 45%, rgba(0,0,0,0) 72%)',
        } as object,
        default: {
          backgroundColor: 'rgba(0,0,0,0.32)',
        },
      }),
    },
    coverBottom: {
      position: 'absolute',
      left: Spacing.md,
      right: Spacing.md,
      bottom: Spacing.md,
      flexDirection: 'row',
      alignItems: 'flex-end',
      justifyContent: 'space-between',
      gap: Spacing.sm,
    },
    coverMeta: {
      flex: 1,
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 6,
    },
    coverBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 12,
      maxWidth: '100%',
    },
    coverBadgeText: {
      flexShrink: 1,
      fontSize: 12,
      fontWeight: '700',
      color: '#FFFFFF',
    },
    coverPricePill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 12,
      backgroundColor: 'rgba(0,0,0,0.5)',
    },
    coverPricePillFree: {
      backgroundColor: 'rgba(52,199,89,0.92)',
    },
    coverPrice: {
      fontSize: 14,
      fontWeight: '800',
      color: '#FFFFFF',
    },
    metaRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
      marginTop: -4,
    },
    metaBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: Radius.pill,
      backgroundColor: 'rgba(21, 122, 254, 0.1)',
    },
    metaBadgeSuccess: {
      backgroundColor: 'rgba(52, 199, 89, 0.12)',
    },
    metaBadgeAccent: {
      backgroundColor: 'rgba(255, 149, 0, 0.12)',
    },
    metaBadgeText: {
      fontSize: FontSize.caption,
      fontWeight: '700',
      color: colors.primary,
    },
    metaBadgeTextSuccess: {
      color: colors.success,
    },
    metaBadgeTextAccent: {
      color: '#FF9500',
    },
    statusRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: Spacing.sm,
    },
    statusBtn: {
      flexGrow: 1,
      flexBasis: '46%',
      minHeight: 52,
      borderRadius: 14,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      paddingHorizontal: Spacing.md,
      paddingVertical: Spacing.sm,
    },
    statusBtnPrimary: {
      backgroundColor: colors.primary,
    },
    statusBtnSuccess: {
      backgroundColor: colors.success,
    },
    statusBtnLabel: {
      fontSize: FontSize.label,
      fontWeight: '700',
      textAlign: 'center',
      color: colors.onPrimary,
    },
    sectionPanel: {
      borderRadius: 16,
      borderWidth: 1,
      padding: Spacing.md,
      gap: Spacing.md,
    },
    sectionPanelApps: {
      borderColor: 'rgba(21, 122, 254, 0.16)',
      backgroundColor: 'rgba(21, 122, 254, 0.06)',
    },
    sectionPanelPlayers: {
      borderColor: 'rgba(52, 199, 89, 0.18)',
      backgroundColor: 'rgba(52, 199, 89, 0.06)',
    },
    sectionHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.sm,
    },
    sectionIconWrap: {
      width: 28,
      height: 28,
      borderRadius: 9,
      alignItems: 'center',
      justifyContent: 'center',
    },
    sectionIconApps: {
      backgroundColor: 'rgba(21, 122, 254, 0.12)',
    },
    sectionIconPlayers: {
      backgroundColor: 'rgba(52, 199, 89, 0.14)',
    },
    sectionTitle: {
      flexShrink: 1,
      fontSize: 16,
      fontWeight: '700',
      color: colors.text,
      letterSpacing: -0.2,
    },
    sectionTitleApps: {
      color: colors.primary,
    },
    sectionTitlePlayers: {
      color: colors.success,
    },
    countBadge: {
      minWidth: 24,
      height: 24,
      paddingHorizontal: 8,
      borderRadius: Radius.pill,
      alignItems: 'center',
      justifyContent: 'center',
    },
    countBadgeApps: {
      backgroundColor: 'rgba(21, 122, 254, 0.12)',
    },
    countBadgePlayers: {
      backgroundColor: 'rgba(52, 199, 89, 0.14)',
    },
    countBadgeTextApps: {
      fontSize: 12,
      fontWeight: '700',
      color: colors.primary,
    },
    countBadgeTextPlayers: {
      fontSize: 12,
      fontWeight: '700',
      color: colors.success,
    },
    emptyHint: {
      fontSize: FontSize.caption,
      color: colors.textMuted,
      lineHeight: FontSize.caption * 1.45,
      paddingVertical: Spacing.xs,
    },
    personList: {
      gap: Spacing.sm,
    },
    personCard: {
      borderRadius: 14,
      borderWidth: 1,
      borderColor: 'rgba(21, 122, 254, 0.12)',
      backgroundColor: colors.surface,
      padding: Spacing.md,
      gap: Spacing.sm,
      position: 'relative',
    },
    personCardPlayers: {
      borderColor: 'rgba(52, 199, 89, 0.14)',
    },
    removeBtn: {
      position: 'absolute',
      top: Spacing.sm,
      right: Spacing.sm,
      zIndex: 2,
      width: 32,
      height: 32,
      borderRadius: 16,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'rgba(255,59,48,0.08)',
      borderWidth: 1,
      borderColor: 'rgba(255,59,48,0.14)',
    },
    personTop: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.sm,
    },
    personTopWithRemove: {
      paddingRight: 36,
    },
    personCopy: {
      flex: 1,
      minWidth: 0,
      gap: 2,
    },
    personName: {
      fontSize: FontSize.label,
      fontWeight: '700',
      color: colors.text,
    },
    personMeta: {
      fontSize: 12,
      fontWeight: '600',
      color: colors.primary,
    },
    personAbout: {
      fontSize: FontSize.caption,
      color: colors.textMuted,
      lineHeight: FontSize.caption * 1.35,
    },
    applicationMessage: {
      gap: 4,
      paddingHorizontal: Spacing.sm,
      paddingVertical: 10,
      borderRadius: 12,
      backgroundColor: 'rgba(21, 122, 254, 0.08)',
    },
    applicationMessageLabel: {
      fontSize: 11,
      fontWeight: '700',
      color: colors.primary,
      letterSpacing: 0.2,
    },
    applicationMessageText: {
      fontSize: FontSize.caption,
      color: colors.text,
      lineHeight: FontSize.caption * 1.4,
    },
    personActions: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
    },
    actionChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: Radius.pill,
      borderWidth: 1,
    },
    actionChipPrimary: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    actionChipGhost: {
      backgroundColor: 'rgba(21, 122, 254, 0.08)',
      borderColor: 'rgba(21, 122, 254, 0.16)',
    },
    actionChipGhostPlayers: {
      backgroundColor: 'rgba(52, 199, 89, 0.1)',
      borderColor: 'rgba(52, 199, 89, 0.18)',
    },
    actionChipDanger: {
      backgroundColor: 'rgba(255,59,48,0.08)',
      borderColor: 'rgba(255,59,48,0.16)',
    },
    actionChipLabel: {
      fontSize: 13,
      fontWeight: '600',
    },
    actionChipLabelOnColor: {
      color: colors.onPrimary,
    },
    actionChipLabelGhost: {
      color: colors.primary,
    },
    actionChipLabelGhostPlayers: {
      color: colors.success,
    },
    actionChipLabelDanger: {
      color: colors.destructive,
    },
    stateWrap: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      gap: Spacing.md,
      padding: Spacing.xl,
    },
    finishedBanner: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.sm,
      paddingHorizontal: Spacing.md,
      paddingVertical: Spacing.sm,
      borderRadius: 14,
      backgroundColor: 'rgba(142,142,147,0.14)',
    },
    finishedNote: {
      flex: 1,
      fontSize: FontSize.caption,
      color: colors.textMuted,
      lineHeight: FontSize.caption * 1.4,
      fontWeight: '600',
    },
  });
}

export default function ManageGameScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string | string[] }>();
  const gameIdParam = params.id;
  const gameId =
    typeof gameIdParam === 'string'
      ? gameIdParam
      : Array.isArray(gameIdParam)
        ? gameIdParam[0]
        : undefined;

  const insets = useSafeAreaInsets();
  const isDesktopWeb = useIsDesktopWeb();
  const hasDesktopSidebar = useIsDesktopSidebarVisible();
  const colors = useTheme();
  const topPadding = isDesktopWeb ? Spacing.lg : insets.top + Spacing.md;
  const styles = useThemedStyles((theme) => createStyles(theme, isDesktopWeb, topPadding));

  const [payload, setPayload] = useState<GameManagePayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const applyPayload = useCallback((next: GameManagePayload) => {
    setPayload(next);
  }, []);

  const load = useCallback(async () => {
    if (!gameId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const next = await getGameManage(gameId);
      setPayload(next);
    } catch (error) {
      toast.error(localizeErrorMessage(error, 'Не удалось открыть кабинет'));
      router.replace('/master-room');
    } finally {
      setLoading(false);
    }
  }, [gameId, router]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const openEdit = useCallback(() => {
    if (!gameId) {
      return;
    }
    router.push({ pathname: '/games-edit', params: { id: gameId } });
  }, [gameId, router]);

  const openDeleteDialog = useCallback(() => {
    if (busy || isDeleting) {
      return;
    }
    setDeleteDialogOpen(true);
  }, [busy, isDeleting]);

  const handleDeleteGame = useCallback(
    async (deleteChat: boolean) => {
      if (!gameId || isDeleting) {
        return;
      }
      setIsDeleting(true);
      try {
        await deleteGame(gameId, { deleteChat });
        setDeleteDialogOpen(false);
        toast.success(deleteChat ? 'Игра и чат удалены' : 'Игра удалена');
        router.replace('/master-room');
      } catch (error) {
        toast.error(localizeErrorMessage(error, 'Не удалось удалить игру'));
      } finally {
        setIsDeleting(false);
      }
    },
    [gameId, isDeleting, router],
  );

  const openAnketa = useCallback(
    (userId: string) => {
      router.push(`/users/${userId}`);
    },
    [router],
  );

  const openChat = useCallback(
    async (userId: string) => {
      if (busy) {
        return;
      }
      setBusy(true);
      try {
        const conversation = await openConversationWith(userId);
        router.push(`/chats/${conversation.id}`);
      } catch (error) {
        toast.error(localizeErrorMessage(error, 'Не удалось открыть чат'));
      } finally {
        setBusy(false);
      }
    },
    [busy, router],
  );

  const openGroupChat = useCallback(async () => {
    if (!gameId || busy) {
      return;
    }
    setBusy(true);
    try {
      const conversation = await openGameChat(gameId);
      router.push(`/chats/${conversation.id}`);
    } catch (error) {
      toast.error(localizeErrorMessage(error, 'Не удалось открыть чат игры'));
    } finally {
      setBusy(false);
    }
  }, [busy, gameId, router]);

  const runStatus = useCallback(
    async (status: GameStatus, successMessage: string) => {
      if (!gameId || busy) {
        return;
      }
      setBusy(true);
      try {
        const next = await updateGameStatus(gameId, status);
        applyPayload(next);
        toast.success(successMessage);
      } catch (error) {
        toast.error(localizeErrorMessage(error, 'Не удалось обновить статус'));
      } finally {
        setBusy(false);
      }
    },
    [applyPayload, busy, gameId],
  );

  const confirmFinish = useCallback(() => {
    const finish = () => void runStatus('FINISHED', 'Игра завершена');

    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      if (window.confirm('Завершить игру? Набор закроется, вернуть её нельзя.')) {
        finish();
      }
      return;
    }

    Alert.alert('Завершить игру?', 'Набор закроется, вернуть её нельзя.', [
      { text: 'Отмена', style: 'cancel' },
      { text: 'Завершить', style: 'destructive', onPress: finish },
    ]);
  }, [runStatus]);

  const confirmRemovePlayer = useCallback(
    (person: GamePersonItem) => {
      if (!gameId || busy) {
        return;
      }

      const remove = async () => {
        setBusy(true);
        try {
          const next = await removeGamePlayer(gameId, person.userId);
          applyPayload(next);
          toast.success(`${person.nickname} убран из игры`);
        } catch (error) {
          toast.error(localizeErrorMessage(error, 'Не удалось убрать игрока'));
        } finally {
          setBusy(false);
        }
      };

      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        if (window.confirm(`Убрать ${person.nickname} из игры?`)) {
          void remove();
        }
        return;
      }

      Alert.alert(`Убрать ${person.nickname}?`, 'Игрок больше не будет в составе стола.', [
        { text: 'Отмена', style: 'cancel' },
        { text: 'Убрать', style: 'destructive', onPress: () => void remove() },
      ]);
    },
    [applyPayload, busy, gameId],
  );

  const acceptApplication = useCallback(
    async (person: GamePersonItem) => {
      if (!gameId || busy) {
        return;
      }
      setBusy(true);
      try {
        const next = await acceptGameApplication(gameId, person.id);
        applyPayload(next);
        toast.success(`${person.nickname} в составе`);
      } catch (error) {
        toast.error(localizeErrorMessage(error, 'Не удалось принять заявку'));
      } finally {
        setBusy(false);
      }
    },
    [applyPayload, busy, gameId],
  );

  const rejectApplication = useCallback(
    async (person: GamePersonItem) => {
      if (!gameId || busy) {
        return;
      }
      setBusy(true);
      try {
        const next = await rejectGameApplication(gameId, person.id);
        applyPayload(next);
        toast.success('Заявка отклонена');
      } catch (error) {
        toast.error(localizeErrorMessage(error, 'Не удалось отклонить заявку'));
      } finally {
        setBusy(false);
      }
    },
    [applyPayload, busy, gameId],
  );

  if (loading || !payload) {
    return (
      <ScreenTransition>
        <View style={styles.stateWrap}>
          <ActivityIndicator color={colors.primary} />
        </View>
      </ScreenTransition>
    );
  }

  const game = payload.game;
  const coverUrl = pickProfileCardUrl(game.cover, game.updatedAt);
  const priceLabel = game.isFree
    ? 'Бесплатно'
    : game.priceRub != null
      ? `${game.priceRub.toLocaleString('ru-RU')} ₽`
      : '—';
  const experienceLabel = game.beginnersWelcome
    ? 'Опыт не важен'
    : game.experienceLabel?.trim()
      ? `Опыт: ${game.experienceLabel.trim()}`
      : null;
  const isFinished = game.status === 'FINISHED';
  const isRecruiting = game.status === 'RECRUITING';
  const isCampaign = game.kind === 'CAMPAIGN';
  const status = statusMeta(game.status);
  const ageLabel =
    game.anyAge || game.minAge == null || game.minAge <= 0 ? 'Любой возраст' : `${game.minAge}+`;

  const durationLabel = (() => {
    const hours = game.durationHours;
    if (hours == null || hours < 1) {
      return null;
    }
    const mod10 = hours % 10;
    const mod100 = hours % 100;
    let unit = 'часов';
    if (mod100 < 11 || mod100 > 14) {
      if (mod10 === 1) {
        unit = 'час';
      } else if (mod10 >= 2 && mod10 <= 4) {
        unit = 'часа';
      }
    }
    return `~${hours} ${unit}`;
  })();

  return (
    <ScreenTransition>
      <View style={styles.root}>
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}>
          <View style={styles.headerRow}>
            {!hasDesktopSidebar ? <MobileBackButton /> : null}
            <Text style={styles.headerTitle} numberOfLines={1}>
              {game.title}
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Редактировать"
              onPress={openEdit}
              style={styles.headerEdit}>
              {hasDesktopSidebar || isDesktopWeb ? (
                <Text style={styles.headerEditLabel}>Изменить</Text>
              ) : (
                <Ionicons name="create-outline" size={20} color={colors.primary} />
              )}
            </Pressable>
          </View>

          <View style={styles.coverFrame}>
            {coverUrl ? (
              <Image
                key={coverUrl}
                source={{ uri: coverUrl }}
                style={styles.coverImage}
                contentFit="cover"
              />
            ) : (
              <View style={styles.coverPlaceholder}>
                <Ionicons name="image-outline" size={28} color={colors.textMuted} />
                <Text style={styles.coverPlaceholderLabel}>Без обложки</Text>
              </View>
            )}
            <View pointerEvents="none" style={styles.coverGradient} />
            <View style={styles.coverBottom} pointerEvents="box-none">
              <View style={styles.coverMeta}>
                <CoverBadge
                  icon={game.isOnline ? 'wifi-outline' : 'map-outline'}
                  label={game.isOnline ? 'Онлайн' : game.city?.name ?? 'Офлайн'}
                  backgroundColor={colors.primary}
                  styles={styles}
                />
                <CoverBadge
                  icon="layers-outline"
                  label={game.systemName}
                  backgroundColor="#5856D6"
                  styles={styles}
                />
                {experienceLabel ? (
                  <CoverBadge
                    icon={game.beginnersWelcome ? 'leaf-outline' : 'ribbon-outline'}
                    label={experienceLabel}
                    backgroundColor={colors.success}
                    styles={styles}
                  />
                ) : null}
                <CoverBadge
                  icon={isCampaign ? 'library-outline' : 'flash-outline'}
                  label={isCampaign ? 'Кампания' : 'Ваншот'}
                  backgroundColor={isCampaign ? '#FF9500' : colors.primary}
                  styles={styles}
                />
              </View>
              <View style={[styles.coverPricePill, game.isFree && styles.coverPricePillFree]}>
                <Ionicons
                  name={game.isFree ? 'pricetag-outline' : 'card-outline'}
                  size={14}
                  color="#FFFFFF"
                />
                <Text style={styles.coverPrice}>{priceLabel}</Text>
              </View>
            </View>
          </View>

          <View style={styles.metaRow}>
            <MetaBadge
              icon={status.icon}
              label={status.label}
              styles={styles}
              colors={colors}
              tone={
                game.status === 'RECRUITING'
                  ? 'success'
                  : game.status === 'CLOSED'
                    ? 'accent'
                    : 'primary'
              }
            />
            <MetaBadge
              icon="people-outline"
              label={`${game.playersCount}/${game.maxPlayers}`}
              styles={styles}
              colors={colors}
            />
            {durationLabel ? (
              <MetaBadge
                icon="timer-outline"
                label={durationLabel}
                styles={styles}
                colors={colors}
                tone="accent"
              />
            ) : null}
            <MetaBadge icon="id-card-outline" label={ageLabel} styles={styles} colors={colors} />
            {game.scheduledAt ? (
              <MetaBadge
                icon="today-outline"
                label={
                  formatDateTimeInTimezone(game.scheduledAt, game.timezone) ??
                  'Дата по договорённости'
                }
                styles={styles}
                colors={colors}
              />
            ) : (
              <MetaBadge
                icon="today-outline"
                label="Дата по договорённости"
                styles={styles}
                colors={colors}
              />
            )}
            <MetaBadge
              icon="time-outline"
              label={formatTimezoneLabel(game.timezone || DEFAULT_TIMEZONE)}
              styles={styles}
              colors={colors}
            />
          </View>

          {!isFinished ? (
            <View style={styles.statusRow}>
              <Pressable
                accessibilityRole="button"
                disabled={busy}
                onPress={() =>
                  void runStatus(
                    isRecruiting ? 'CLOSED' : 'RECRUITING',
                    isRecruiting ? 'Набор закрыт' : 'Набор снова открыт',
                  )
                }
                style={({ pressed }) => [
                  styles.statusBtn,
                  styles.statusBtnPrimary,
                  pressed && { opacity: 0.88 },
                  busy && { opacity: 0.55 },
                ]}>
                <Ionicons
                  name={isRecruiting ? 'lock-closed-outline' : 'lock-open-outline'}
                  size={18}
                  color={colors.onPrimary}
                />
                <Text style={styles.statusBtnLabel}>
                  {isRecruiting ? 'Закрыть набор' : 'Открыть набор'}
                </Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                disabled={busy}
                onPress={confirmFinish}
                style={({ pressed }) => [
                  styles.statusBtn,
                  styles.statusBtnSuccess,
                  pressed && { opacity: 0.88 },
                  busy && { opacity: 0.55 },
                ]}>
                <Ionicons name="flag-outline" size={18} color={colors.onPrimary} />
                <Text style={styles.statusBtnLabel}>Завершить игру</Text>
              </Pressable>
            </View>
          ) : (
            <View style={styles.finishedBanner}>
              <Ionicons name="flag" size={16} color={colors.textMuted} />
              <Text style={styles.finishedNote}>
                Игра завершена. Можно только смотреть состав.
              </Text>
            </View>
          )}

          <Button
            label="Редактировать игру"
            variant="outline"
            onPress={openEdit}
            icon={<Ionicons name="create-outline" size={18} color={colors.text} />}
          />
          <Button
            label="Чат игры"
            variant="outline"
            disabled={busy}
            onPress={() => void openGroupChat()}
            icon={<Ionicons name="chatbubbles-outline" size={18} color={colors.text} />}
          />

          <View style={[styles.sectionPanel, styles.sectionPanelApps]}>
            <View style={styles.sectionHeader}>
              <View style={[styles.sectionIconWrap, styles.sectionIconApps]}>
                <Ionicons name="mail-unread-outline" size={15} color={colors.primary} />
              </View>
              <Text style={[styles.sectionTitle, styles.sectionTitleApps]}>Заявки</Text>
              {payload.applications.length > 0 ? (
                <View style={[styles.countBadge, styles.countBadgeApps]}>
                  <Text style={styles.countBadgeTextApps}>{payload.applications.length}</Text>
                </View>
              ) : null}
            </View>
            {payload.applications.length === 0 ? (
              <Text style={styles.emptyHint}>Пока никто не подал заявку.</Text>
            ) : (
              <View style={styles.personList}>
                {payload.applications.map((person) => (
                  <PersonCard
                    key={person.id}
                    person={person}
                    styles={styles}
                    colors={colors}
                    showAppliedAt
                    accent="primary"
                    actions={[
                      {
                        label: 'Анкета',
                        icon: 'person-outline',
                        tone: 'ghost',
                        onPress: () => openAnketa(person.userId),
                      },
                      {
                        label: 'Написать',
                        icon: 'chatbubble-outline',
                        tone: 'ghost',
                        onPress: () => void openChat(person.userId),
                      },
                      ...(isFinished
                        ? []
                        : [
                            {
                              label: 'Принять',
                              icon: 'checkmark-circle-outline' as const,
                              tone: 'primary' as const,
                              onPress: () => void acceptApplication(person),
                            },
                            {
                              label: 'Отклонить',
                              icon: 'close-circle-outline' as const,
                              tone: 'danger' as const,
                              onPress: () => void rejectApplication(person),
                            },
                          ]),
                    ]}
                  />
                ))}
              </View>
            )}
          </View>

          <View style={[styles.sectionPanel, styles.sectionPanelPlayers]}>
            <View style={styles.sectionHeader}>
              <View style={[styles.sectionIconWrap, styles.sectionIconPlayers]}>
                <Ionicons name="people-outline" size={15} color={colors.success} />
              </View>
              <Text style={[styles.sectionTitle, styles.sectionTitlePlayers]}>
                Игроки {game.playersCount}/{game.maxPlayers}
              </Text>
              <View style={[styles.countBadge, styles.countBadgePlayers]}>
                <Text style={styles.countBadgeTextPlayers}>
                  {game.playersCount}/{game.maxPlayers}
                </Text>
              </View>
            </View>
            {payload.players.length === 0 ? (
              <Text style={styles.emptyHint}>Состав пока пустой — примите заявки.</Text>
            ) : (
              <View style={styles.personList}>
                {payload.players.map((person) => (
                  <PersonCard
                    key={person.id}
                    person={person}
                    styles={styles}
                    colors={colors}
                    accent="success"
                    onRemove={isFinished ? undefined : () => confirmRemovePlayer(person)}
                    actions={[
                      {
                        label: 'Анкета',
                        icon: 'person-outline',
                        tone: 'ghost',
                        onPress: () => openAnketa(person.userId),
                      },
                      {
                        label: 'Написать',
                        icon: 'chatbubble-outline',
                        tone: 'ghost',
                        onPress: () => void openChat(person.userId),
                      },
                    ]}
                  />
                ))}
              </View>
            )}
          </View>
        </ScrollView>
      </View>
    </ScreenTransition>
  );
}
