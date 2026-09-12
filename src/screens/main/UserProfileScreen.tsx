import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useIsDesktopSidebarVisible } from '@/components/navigation/DesktopThemeToggle';
import { MobileBackButton } from '@/components/navigation/MobileBackButton';
import { ScreenTransition } from '@/components/navigation/ScreenTransition';
import { Button, UserCard, toast } from '@/components/ui';
import { FontSize, Spacing, type ThemeColors } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/hooks/use-theme';
import { useThemedStyles } from '@/hooks/use-themed-styles';
import { openConversationWith, unblockPeerByUserId } from '@/services/chats/chatsApi';
import {
  clearWandererReaction,
  fetchUserCard,
  upsertWandererReaction,
  type WandererCardItem,
} from '@/services/profile/wanderersApi';
import { localizeErrorMessage } from '@/utils/localizeError';
import { wandererCardToUserCardProps } from '@/utils/wanderer-card';
import { QUESTIONNAIRE_ENTRY } from '@/screens/questionnaire/questionnaire.config';

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
      maxWidth: 480,
      alignSelf: 'center',
    },
    actions: {
      width: '100%',
      maxWidth: 480,
      alignSelf: 'center',
      gap: Spacing.sm,
      flexDirection: isDesktopWeb ? 'row' : 'column',
      alignItems: 'stretch',
      justifyContent: 'center',
    },
    actionButton: {
      flex: isDesktopWeb ? 1 : undefined,
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
  });
}

export default function UserProfileScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const userId = Array.isArray(id) ? id[0] : id;
  const router = useRouter();
  const colors = useTheme();
  const insets = useSafeAreaInsets();
  const isDesktopWebSidebar = useIsDesktopSidebarVisible();
  const { user } = useAuth();
  const topPadding = isDesktopWebSidebar ? Spacing.xl : insets.top + Spacing.md;
  const bottomPadding = isDesktopWebSidebar ? Spacing.lg : insets.bottom;
  const styles = useThemedStyles((themeColors) =>
    createStyles(themeColors, topPadding, bottomPadding, isDesktopWebSidebar),
  );

  const [item, setItem] = useState<WandererCardItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [isBusy, setIsBusy] = useState(false);

  const loadCard = useCallback(async () => {
    if (!userId) {
      return;
    }

    setLoading(true);
    setNotFound(false);
    setItem(null);

    try {
      const card = await fetchUserCard(userId);
      setItem(card);
    } catch {
      setNotFound(true);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useFocusEffect(
    useCallback(() => {
      void loadCard();
    }, [loadCard]),
  );

  const handleChat = useCallback(async () => {
    if (!item || isBusy) {
      return;
    }

    setIsBusy(true);
    try {
      const conversation = await openConversationWith(item.id);
      router.push(`/chats/${conversation.id}`);
    } catch (error) {
      toast.error(localizeErrorMessage(error, 'Не удалось открыть чат'));
    } finally {
      setIsBusy(false);
    }
  }, [isBusy, item, router]);

  const handleToggleFavorite = useCallback(async () => {
    if (!item || isBusy || item.blockedByMe) {
      return;
    }

    setIsBusy(true);
    const wasFavorite = Boolean(item.isFavorite);
    try {
      if (wasFavorite) {
        await clearWandererReaction(item.id);
        setItem({ ...item, isFavorite: false });
        toast.success(`${item.nickname} удалён из избранных`);
      } else {
        await upsertWandererReaction(item.id, 'favorite');
        setItem({ ...item, isFavorite: true });
        toast.success(`${item.nickname} добавлен в избранные`);
      }
    } catch (error) {
      toast.error(
        localizeErrorMessage(
          error,
          wasFavorite ? 'Не удалось удалить из избранных' : 'Не удалось добавить в избранные',
        ),
      );
    } finally {
      setIsBusy(false);
    }
  }, [isBusy, item]);

  const handleUnblock = useCallback(async () => {
    if (!item || isBusy || !item.blockedByMe) {
      return;
    }

    setIsBusy(true);
    try {
      await unblockPeerByUserId(item.id);
      setItem({ ...item, blockedByMe: false });
      toast.success(`${item.nickname} разблокирован`);
    } catch (error) {
      toast.error(localizeErrorMessage(error, 'Не удалось разблокировать'));
    } finally {
      setIsBusy(false);
    }
  }, [isBusy, item]);

  const isSelf = Boolean(item && user?.id && item.id === user.id);
  const title = item?.nickname ?? 'Анкета';

  const header = (
    <View style={styles.headerRow}>
      <View style={styles.headerSide}>
        <MobileBackButton />
      </View>
      <Text style={styles.headerTitle} numberOfLines={1}>
        {title}
      </Text>
      {isDesktopWebSidebar ? null : <View style={styles.headerSide} />}
    </View>
  );

  return (
    <ScreenTransition animateOnFocus>
      <View style={styles.root}>
        <View style={styles.inner}>
          {header}

          {loading ? (
            <View style={styles.stateWrap}>
              <ActivityIndicator color={colors.primary} />
            </View>
          ) : notFound || !item ? (
            <View style={styles.stateWrap}>
              <Text style={styles.stateText}>Анкета недоступна</Text>
            </View>
          ) : (
            <ScrollView
              style={styles.scroll}
              contentContainerStyle={styles.scrollContent}
              showsVerticalScrollIndicator={false}>
              <View style={styles.cardWrap}>
                <UserCard {...wandererCardToUserCardProps(item)} showVisibility={false} />
              </View>

              {isSelf ? (
                <View style={styles.actions}>
                  <Button
                    label="Редактировать анкету"
                    variant="outline"
                    style={styles.actionButton}
                    onPress={() =>
                      router.push({ pathname: QUESTIONNAIRE_ENTRY, params: { edit: '1' } })
                    }
                  />
                </View>
              ) : (
                <View style={styles.actions}>
                  <Button
                    label="Написать"
                    style={styles.actionButton}
                    disabled={isBusy}
                    onPress={() => void handleChat()}
                  />
                  {item.blockedByMe ? (
                    <Button
                      label="Разблокировать"
                      variant="outline"
                      style={styles.actionButton}
                      disabled={isBusy}
                      onPress={() => void handleUnblock()}
                    />
                  ) : (
                    <Button
                      label={item.isFavorite ? 'Убрать из избранных' : 'В избранные'}
                      variant="outline"
                      style={styles.actionButton}
                      disabled={isBusy}
                      onPress={() => void handleToggleFavorite()}
                    />
                  )}
                </View>
              )}
            </ScrollView>
          )}
        </View>
      </View>
    </ScreenTransition>
  );
}
