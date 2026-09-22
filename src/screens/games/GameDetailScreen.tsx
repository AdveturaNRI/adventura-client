import { Ionicons } from '@expo/vector-icons';
import { useCallback, useEffect, useState } from 'react';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import {
  ActivityIndicator,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { GameFeedCard } from '@/components/games/GameFeedCard';
import { useIsDesktopSidebarVisible, useIsDesktopWeb } from '@/components/navigation/DesktopThemeToggle';
import { MobileBackButton } from '@/components/navigation/MobileBackButton';
import { ScreenTransition } from '@/components/navigation/ScreenTransition';
import { toast } from '@/components/ui';
import { FontSize, Spacing, type ThemeColors } from '@/constants/theme';
import { useRequireAuth } from '@/hooks/use-require-auth';
import { useTheme } from '@/hooks/use-theme';
import { useThemedStyles } from '@/hooks/use-themed-styles';
import { openGameChat } from '@/services/chats/chatsApi';
import {
  applyToGame,
  cancelGameApplication,
  getGame,
  type GameListItem,
} from '@/services/games/gamesApi';
import {
  gamesCatalogHrefFromFilterPatch,
  type GamesFeedFilters,
} from '@/utils/games-filters';
import { localizeErrorMessage } from '@/utils/localizeError';
import { trackEntityTransition } from '@/services/analytics/analytics';

function createStyles(
  colors: ThemeColors,
  topPadding: number,
  bottomPadding: number,
  isDesktopWeb: boolean,
) {
  return StyleSheet.create({
    root: {
      flex: 1,
      backgroundColor: colors.background,
      paddingTop: topPadding,
    },
    inner: {
      flex: 1,
      minHeight: 0,
      width: '100%',
      maxWidth: isDesktopWeb ? 720 : undefined,
      alignSelf: 'center',
      paddingHorizontal: isDesktopWeb ? Spacing.xl : Spacing.md,
    },
    headerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      minHeight: 40,
      flexShrink: 0,
    },
    headerSide: {
      width: 40,
      justifyContent: 'center',
    },
    headerTitle: {
      flex: 1,
      minWidth: 0,
      fontSize: isDesktopWeb ? 26 : 18,
      fontWeight: '700',
      color: colors.text,
      textAlign: isDesktopWeb ? 'left' : 'center',
      letterSpacing: -0.2,
    },
    scroll: {
      flex: 1,
      minHeight: 0,
      width: '100%',
    },
    scrollContent: {
      gap: Spacing.md,
      paddingTop: Spacing.sm,
      paddingBottom: bottomPadding + Spacing.xl,
    },
    cardWrap: {
      width: '100%',
      maxWidth: 560,
      alignSelf: 'center',
    },
    chatBtn: {
      marginTop: Spacing.sm,
      alignSelf: 'center',
      width: '100%',
      maxWidth: 560,
      minHeight: 48,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: 'rgba(21, 122, 254, 0.1)',
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: Spacing.sm,
      paddingHorizontal: Spacing.md,
    },
    chatBtnLabel: {
      fontSize: FontSize.label,
      fontWeight: '700',
      color: colors.primary,
    },
    stateWrap: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      gap: Spacing.md,
      paddingHorizontal: Spacing.lg,
    },
    stateText: {
      fontSize: FontSize.label,
      color: colors.textMuted,
      textAlign: 'center',
      lineHeight: FontSize.label * 1.5,
    },
    modalBackdrop: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.45)',
      justifyContent: isDesktopWeb ? 'center' : 'flex-end',
      alignItems: 'center',
      padding: isDesktopWeb ? Spacing.lg : 0,
    },
    modalSheet: {
      width: '100%',
      maxWidth: isDesktopWeb ? 440 : undefined,
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      borderBottomLeftRadius: isDesktopWeb ? 20 : 0,
      borderBottomRightRadius: isDesktopWeb ? 20 : 0,
      backgroundColor: colors.surface,
      paddingHorizontal: Spacing.lg,
      paddingTop: Spacing.lg,
      paddingBottom: Spacing.xl,
      gap: Spacing.md,
    },
    modalTitle: {
      fontSize: 18,
      fontWeight: '700',
      color: colors.text,
      letterSpacing: -0.2,
    },
    modalSubtitle: {
      fontSize: FontSize.caption,
      color: colors.textMuted,
      lineHeight: FontSize.caption * 1.4,
      marginTop: -4,
    },
    modalInput: {
      minHeight: 110,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.borderLight,
      backgroundColor: colors.surfaceMuted,
      paddingHorizontal: Spacing.md,
      paddingVertical: Spacing.sm,
      fontSize: FontSize.input,
      color: colors.text,
      textAlignVertical: 'top',
      ...Platform.select({
        web: { outlineStyle: 'none' } as object,
        default: {},
      }),
    },
    modalActions: {
      flexDirection: 'row',
      gap: Spacing.sm,
    },
    modalPrimary: {
      flex: 1,
      minHeight: 48,
      borderRadius: 999,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.primary,
    },
    modalPrimaryLabel: {
      fontSize: FontSize.button,
      fontWeight: '700',
      color: colors.onPrimary,
    },
    modalSecondary: {
      flex: 1,
      minHeight: 48,
      borderRadius: 999,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: colors.borderLight,
      backgroundColor: colors.surface,
    },
    modalSecondaryLabel: {
      fontSize: FontSize.button,
      fontWeight: '600',
      color: colors.text,
    },
  });
}

export default function GameDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const gameId = Array.isArray(id) ? id[0] : id;
  const router = useRouter();
  const colors = useTheme();
  const insets = useSafeAreaInsets();
  const isDesktopWeb = useIsDesktopWeb();
  const isDesktopWebSidebar = useIsDesktopSidebarVisible();
  const topPadding = isDesktopWebSidebar ? Spacing.lg : insets.top + Spacing.md;
  const styles = useThemedStyles((theme) =>
    createStyles(theme, topPadding, insets.bottom, isDesktopWeb),
  );
  const requireAuth = useRequireAuth();

  const [item, setItem] = useState<GameListItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [busy, setBusy] = useState(false);
  const [applyOpen, setApplyOpen] = useState(false);
  const [applyMessage, setApplyMessage] = useState('');

  const load = useCallback(async () => {
    if (!gameId) {
      setNotFound(true);
      setLoading(false);
      return;
    }

    setLoading(true);
    setNotFound(false);
    try {
      const next = await getGame(gameId);
      setItem(next);
    } catch {
      setItem(null);
      setNotFound(true);
    } finally {
      setLoading(false);
    }
  }, [gameId]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  useEffect(() => {
    if (item?.id) {
      trackEntityTransition('game', item.id);
    }
  }, [item?.id]);

  const openMaster = useCallback(
    (userId: string) => {
      router.push(`/users/${userId}`);
    },
    [router],
  );

  const openManage = useCallback(
    (id: string) => {
      router.push({ pathname: '/games-manage', params: { id } });
    },
    [router],
  );

  const openCatalogWithFilter = useCallback(
    (patch: Partial<GamesFeedFilters>) => {
      router.push(gamesCatalogHrefFromFilterPatch(patch));
    },
    [router],
  );

  const openChat = useCallback(async () => {
    if (!item || busy) {
      return;
    }
    if (!requireAuth(`/games/${item.id}`)) {
      return;
    }
    setBusy(true);
    try {
      const conversation = await openGameChat(item.id);
      router.push({
        pathname: '/chats/[id]',
        params: {
          id: conversation.id,
          returnTo: `/games/${item.id}`,
        },
      });
    } catch (error) {
      toast.error(localizeErrorMessage(error, 'Не удалось открыть чат игры'));
    } finally {
      setBusy(false);
    }
  }, [busy, item, requireAuth, router]);

  const openApply = useCallback(() => {
    if (!item) {
      return;
    }
    if (!requireAuth(`/games/${item.id}`)) {
      return;
    }
    setApplyMessage('');
    setApplyOpen(true);
  }, [item, requireAuth]);

  const closeApply = useCallback(() => {
    if (busy) {
      return;
    }
    setApplyOpen(false);
    setApplyMessage('');
  }, [busy]);

  const submitApply = useCallback(async () => {
    if (!item || busy) {
      return;
    }

    setBusy(true);
    try {
      const next = await applyToGame(item.id, applyMessage);
      setItem(next);
      setApplyOpen(false);
      setApplyMessage('');
      toast.success('Заявка отправлена');
    } catch (error) {
      toast.error(localizeErrorMessage(error, 'Не удалось отправить заявку'));
    } finally {
      setBusy(false);
    }
  }, [applyMessage, busy, item]);

  const handleCancel = useCallback(async () => {
    if (!item || busy) {
      return;
    }

    setBusy(true);
    try {
      const next = await cancelGameApplication(item.id);
      setItem(next);
      toast.success('Заявка отменена');
    } catch (error) {
      toast.error(localizeErrorMessage(error, 'Не удалось отменить заявку'));
    } finally {
      setBusy(false);
    }
  }, [busy, item]);

  const title = item?.title ?? 'Игра';

  return (
    <ScreenTransition animateOnFocus>
      <View style={styles.root}>
        <View style={styles.inner}>
          <View style={styles.headerRow}>
            <View style={styles.headerSide}>
              <MobileBackButton />
            </View>
            <Text style={styles.headerTitle} numberOfLines={1}>
              {title}
            </Text>
            {isDesktopWebSidebar ? null : <View style={styles.headerSide} />}
          </View>

          {loading ? (
            <View style={styles.stateWrap}>
              <ActivityIndicator color={colors.primary} />
            </View>
          ) : notFound || !item ? (
            <View style={styles.stateWrap}>
              <Text style={styles.stateText}>Игра недоступна</Text>
            </View>
          ) : (
            <ScrollView
              style={styles.scroll}
              contentContainerStyle={styles.scrollContent}
              showsVerticalScrollIndicator={false}>
              <View style={styles.cardWrap}>
                <GameFeedCard
                  item={item}
                  variant="detail"
                  busy={busy}
                  onFilterBadgePress={openCatalogWithFilter}
                  onOpenMaster={openMaster}
                  onApply={() => openApply()}
                  onCancel={() => void handleCancel()}
                  onManage={openManage}
                />
                {item.viewerRelation === 'player' || item.viewerRelation === 'owner' ? (
                  <Pressable
                    accessibilityRole="button"
                    disabled={busy}
                    onPress={() => void openChat()}
                    style={({ pressed }) => [
                      styles.chatBtn,
                      pressed && { opacity: 0.88 },
                      busy && { opacity: 0.55 },
                    ]}>
                    <Ionicons name="chatbubbles-outline" size={18} color={colors.primary} />
                    <Text style={styles.chatBtnLabel}>Чат игры</Text>
                  </Pressable>
                ) : null}
              </View>
            </ScrollView>
          )}
        </View>
      </View>

      <Modal
        visible={applyOpen}
        transparent
        animationType={isDesktopWeb ? 'fade' : 'slide'}
        onRequestClose={closeApply}>
        <Pressable style={styles.modalBackdrop} onPress={closeApply}>
          <Pressable style={styles.modalSheet} onPress={(event) => event.stopPropagation()}>
            <Text style={styles.modalTitle}>Заявка на стол</Text>
            <Text style={styles.modalSubtitle}>
              Расскажи мастеру немного о себе — это необязательно.
            </Text>
            <TextInput
              value={applyMessage}
              onChangeText={setApplyMessage}
              placeholder="Сообщение мастеру"
              placeholderTextColor={colors.textMuted}
              multiline
              style={styles.modalInput}
            />
            <View style={styles.modalActions}>
              <Pressable
                accessibilityRole="button"
                disabled={busy}
                onPress={() => void submitApply()}
                style={({ pressed }) => [
                  styles.modalPrimary,
                  pressed && { opacity: 0.9 },
                  busy && { opacity: 0.55 },
                ]}>
                <Text style={styles.modalPrimaryLabel}>
                  {busy ? 'Отправка…' : 'Отправить'}
                </Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                disabled={busy}
                onPress={closeApply}
                style={({ pressed }) => [styles.modalSecondary, pressed && { opacity: 0.75 }]}>
                <Text style={styles.modalSecondaryLabel}>Отмена</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </ScreenTransition>
  );
}
