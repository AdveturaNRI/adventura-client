import { useCallback, useState } from 'react';
import { useFocusEffect, useRouter } from 'expo-router';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';

import { MobileScreenHeader } from '@/components/navigation/MobileScreenHeader';
import { useIsDesktopSidebarVisible, useIsDesktopWeb } from '@/components/navigation/DesktopThemeToggle';
import { ScreenTransition } from '@/components/navigation/ScreenTransition';
import { Button, toast } from '@/components/ui';
import { MenuIcon } from '@/components/ui/navigation/MenuIcons';
import { FontSize, Radius, Spacing, type ThemeColors } from '@/constants/theme';
import { useProfile } from '@/context/ProfileContext';
import { useTheme } from '@/hooks/use-theme';
import { useThemedStyles } from '@/hooks/use-themed-styles';
import { listMyGames, type GameListItem } from '@/services/games/gamesApi';
import { pickProfileCardUrl } from '@/services/profile/profileApi';
import { localizeErrorMessage } from '@/utils/localizeError';
import { formatCityLabel } from '@/utils/city-label';
import { DEFAULT_TIMEZONE, formatDateTimeInTimezone } from '@/utils/timezones';

import { useMainScreenStyles } from './main-screen.styles';

const DESKTOP_CONTENT_MAX = 1120;
const DESKTOP_CARD_WIDTH = 420;
const DESKTOP_GRID_GAP = Spacing.lg;

function formatViewerGameDateTime(iso: string | null, viewerTimezone: string): string {
  if (!iso) {
    return 'Дата по договорённости';
  }

  return (
    formatDateTimeInTimezone(iso, viewerTimezone) ?? 'Дата по договорённости'
  );
}

type Styles = ReturnType<typeof createLocalStyles>;

function createLocalStyles(colors: ThemeColors, isDesktopWeb: boolean) {
  return StyleSheet.create({
    shell: {
      flex: 1,
      width: '100%',
      maxWidth: isDesktopWeb ? DESKTOP_CONTENT_MAX : undefined,
      alignSelf: isDesktopWeb ? 'center' : undefined,
      gap: isDesktopWeb ? Spacing.lg : Spacing.md,
    },
    headerBlock: {
      gap: Spacing.sm,
    },
    headerRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      gap: Spacing.lg,
    },
    headerCopy: {
      flex: 1,
      minWidth: 0,
      gap: 6,
    },
    pageTitle: {
      fontSize: isDesktopWeb ? 32 : FontSize.h1,
      fontWeight: '700',
      color: colors.text,
      letterSpacing: -0.4,
    },
    pageSubtitle: {
      fontSize: FontSize.label,
      color: colors.textMuted,
      lineHeight: FontSize.label * 1.45,
      maxWidth: 420,
    },
    createButtonDesktop: {
      alignSelf: 'flex-start',
      minWidth: 180,
    },
    createButtonMobile: {
      alignSelf: 'stretch',
    },
    gridScroll: {
      flex: 1,
      minHeight: 0,
    },
    grid: {
      flexDirection: isDesktopWeb ? 'row' : 'column',
      flexWrap: isDesktopWeb ? 'wrap' : 'nowrap',
      alignContent: 'flex-start',
      gap: isDesktopWeb ? DESKTOP_GRID_GAP : Spacing.md,
      paddingBottom: Spacing.xl,
    },
    cardSlot: {
      width: isDesktopWeb ? DESKTOP_CARD_WIDTH : '100%',
      maxWidth: isDesktopWeb ? DESKTOP_CARD_WIDTH : '100%',
    },
    card: {
      width: '100%',
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.borderLight,
      backgroundColor: colors.surface,
      overflow: 'hidden',
      ...Platform.select({
        ios: {
          shadowColor: colors.shadow,
          shadowOffset: { width: 0, height: 6 },
          shadowOpacity: 0.08,
          shadowRadius: 16,
        },
        android: {
          elevation: 3,
        },
        default: {
          boxShadow: '0 8px 24px rgba(0, 0, 0, 0.08)',
          transitionProperty: 'transform, box-shadow',
          transitionDuration: '160ms',
        } as object,
      }),
    },
    cardHovered: {
      ...Platform.select({
        default: {
          transform: [{ translateY: -2 }],
          boxShadow: '0 14px 32px rgba(0, 0, 0, 0.1)',
        } as object,
      }),
    },
    cover: {
      width: '100%',
      aspectRatio: 16 / 10,
      backgroundColor: colors.surfaceMuted,
      position: 'relative',
      overflow: 'hidden',
    },
    coverImage: {
      ...StyleSheet.absoluteFill,
      width: '100%',
      height: '100%',
      ...Platform.select({
        web: {
          userSelect: 'none',
          WebkitUserDrag: 'none',
          userDrag: 'none',
          pointerEvents: 'none',
        } as object,
        default: {},
      }),
    },
    coverShield: {
      ...StyleSheet.absoluteFill,
      zIndex: 1,
      ...Platform.select({
        web: {
          backgroundColor: 'rgba(0,0,0,0.001)',
        } as object,
        default: {},
      }),
    },
    coverGradient: {
      position: 'absolute',
      left: 0,
      right: 0,
      bottom: 0,
      height: '48%',
      zIndex: 2,
      ...Platform.select({
        web: {
          backgroundImage:
            'linear-gradient(to top, rgba(0,0,0,0.72) 0%, rgba(0,0,0,0.28) 55%, rgba(0,0,0,0) 100%)',
        } as object,
        default: {},
      }),
    },
    coverGradientNativeBase: {
      ...StyleSheet.absoluteFill,
      backgroundColor: 'rgba(0,0,0,0.5)',
      top: '52%',
    },
    coverGradientNativeMid: {
      ...StyleSheet.absoluteFill,
      backgroundColor: 'rgba(0,0,0,0.22)',
      top: '35%',
      bottom: '28%',
    },
    coverPlaceholder: {
      ...StyleSheet.absoluteFill,
      alignItems: 'center',
      justifyContent: 'center',
      gap: Spacing.xs,
      backgroundColor: colors.placeholder,
      zIndex: 0,
    },
    coverPlaceholderLabel: {
      fontSize: FontSize.caption,
      color: colors.textMuted,
    },
    coverTopBar: {
      position: 'absolute',
      top: Spacing.sm,
      left: Spacing.sm,
      right: Spacing.sm,
      zIndex: 4,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: Spacing.sm,
    },
    coverBottomBar: {
      position: 'absolute',
      left: Spacing.sm,
      right: Spacing.sm,
      bottom: Spacing.sm,
      zIndex: 4,
      flexDirection: 'row',
      alignItems: 'flex-end',
      justifyContent: 'space-between',
      gap: Spacing.sm,
    },
    statusBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: Radius.pill,
      backgroundColor: colors.success,
    },
    statusBadgeClosed: {
      backgroundColor: '#FF9500',
    },
    statusBadgeFinished: {
      backgroundColor: '#8E8E93',
    },
    statusBadgeText: {
      fontSize: FontSize.caption,
      fontWeight: '700',
      color: colors.onPrimary,
    },
    manageButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      paddingHorizontal: 14,
      paddingVertical: 7,
      borderRadius: Radius.pill,
      backgroundColor: colors.primary,
    },
    manageButtonText: {
      fontSize: FontSize.caption,
      fontWeight: '700',
      color: colors.onPrimary,
    },
    manageBadge: {
      minWidth: 18,
      height: 18,
      paddingHorizontal: 5,
      borderRadius: Radius.pill,
      backgroundColor: colors.onPrimary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    manageBadgeText: {
      fontSize: 11,
      fontWeight: '700',
      color: colors.primary,
    },
    dateChip: {
      maxWidth: '58%',
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 10,
      backgroundColor: 'rgba(0,0,0,0.45)',
    },
    dateChipText: {
      fontSize: FontSize.caption,
      fontWeight: '600',
      color: '#FFFFFF',
    },
    kindBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 12,
    },
    kindBadgeOneshot: {
      backgroundColor: colors.primary,
    },
    kindBadgeCampaign: {
      backgroundColor: '#FF9500',
    },
    kindBadgeText: {
      fontSize: FontSize.caption,
      fontWeight: '700',
      color: colors.onPrimary,
    },
    body: {
      gap: Spacing.sm,
      paddingHorizontal: Spacing.md,
      paddingTop: Spacing.md,
      paddingBottom: Spacing.md,
    },
    metaRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: Spacing.sm,
    },
    metaItems: {
      flex: 1,
      flexDirection: 'row',
      flexWrap: 'wrap',
      alignItems: 'center',
      gap: 10,
      minWidth: 0,
    },
    metaItem: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      maxWidth: '100%',
    },
    metaItemText: {
      flexShrink: 1,
      fontSize: FontSize.caption,
      color: colors.textMuted,
    },
    ageBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: Radius.pill,
      backgroundColor: 'rgba(21, 122, 254, 0.08)',
      borderWidth: 1,
      borderColor: 'rgba(21, 122, 254, 0.16)',
    },
    ageBadgeText: {
      fontSize: FontSize.caption,
      fontWeight: '700',
      color: colors.primary,
      letterSpacing: 0.2,
    },
    durationBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: Radius.pill,
      backgroundColor: 'rgba(255, 149, 0, 0.12)',
      borderWidth: 1,
      borderColor: 'rgba(255, 149, 0, 0.22)',
    },
    durationBadgeText: {
      fontSize: FontSize.caption,
      fontWeight: '700',
      color: '#FF9500',
      letterSpacing: 0.2,
    },
    titleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: Spacing.md,
    },
    title: {
      flex: 1,
      minWidth: 0,
      fontSize: 18,
      fontWeight: '700',
      color: colors.text,
      letterSpacing: -0.2,
    },
    priceWrap: {
      flexShrink: 0,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
    },
    priceText: {
      flexShrink: 0,
      fontSize: FontSize.label,
      fontWeight: '700',
      letterSpacing: 0.1,
    },
    priceTextFree: {
      color: '#3DAB5A',
    },
    priceTextPaid: {
      color: colors.text,
    },
    descriptionRow: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      justifyContent: 'space-between',
      gap: Spacing.sm,
    },
    description: {
      flex: 1,
      minWidth: 0,
      fontSize: FontSize.caption,
      color: colors.textMuted,
      lineHeight: FontSize.caption * 1.45,
    },
    players: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      flexShrink: 0,
    },
    playersText: {
      fontSize: FontSize.caption,
      color: colors.textMuted,
      fontWeight: '600',
    },
    empty: {
      flexGrow: 1,
      alignItems: 'center',
      justifyContent: 'center',
      gap: Spacing.md,
      paddingVertical: Spacing.section,
      paddingHorizontal: Spacing.xl,
    },
    emptyIconWrap: {
      width: 64,
      height: 64,
      borderRadius: 20,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.menuIconBg,
    },
    emptyTitle: {
      fontSize: isDesktopWeb ? 22 : FontSize.button,
      fontWeight: '700',
      color: colors.text,
      textAlign: 'center',
    },
    emptyHint: {
      fontSize: FontSize.label,
      color: colors.textMuted,
      textAlign: 'center',
      lineHeight: FontSize.label * 1.5,
      maxWidth: 360,
    },
    emptyCreate: {
      marginTop: Spacing.xs,
      minWidth: 200,
    },
    stateWrap: {
      flex: 1,
      paddingVertical: Spacing.xl,
      alignItems: 'center',
      justifyContent: 'center',
    },
  });
}

function MetaItem({
  icon,
  label,
  styles,
  colors,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  styles: Styles;
  colors: ThemeColors;
}) {
  return (
    <View style={styles.metaItem}>
      <Ionicons name={icon} size={13} color={colors.textMuted} />
      <Text style={styles.metaItemText} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

function GameCard({
  item,
  styles,
  colors,
  onManage,
}: {
  item: GameListItem;
  styles: Styles;
  colors: ThemeColors;
  onManage: (gameId: string) => void;
}) {
  const [hovered, setHovered] = useState(false);
  const { profile } = useProfile();
  const viewerTimezone = profile?.timezone?.trim() || DEFAULT_TIMEZONE;
  const coverUrl = pickProfileCardUrl(item.cover, item.updatedAt);
  const isCampaign = item.kind === 'CAMPAIGN';
  const kindLabel = isCampaign ? 'Кампания' : 'Ваншот';
  const kindIcon = isCampaign ? ('library-outline' as const) : ('flash-outline' as const);
  const location = item.isOnline
    ? 'Онлайн'
    : item.city
      ? formatCityLabel({
          name: item.city.name,
          region: item.city.region,
          countryCode: 'RU',
        })
      : 'Офлайн';
  const scheduleLabel = formatViewerGameDateTime(item.scheduledAt, viewerTimezone);
  const priceLabel = item.isFree
    ? 'Бесплатно'
    : item.priceRub != null
      ? `${item.priceRub.toLocaleString('ru-RU')} ₽`
      : '—';
  const experienceLabel = item.beginnersWelcome
    ? 'Опыт не важен'
    : item.experienceLabel?.trim()
      ? `Опыт: ${item.experienceLabel.trim()}`
      : 'Опыт не указан';
  const ageLabel =
    item.anyAge || item.minAge == null || item.minAge <= 0
      ? 'Любой возраст'
      : `${item.minAge}+`;
  const durationLabel = (() => {
    const hours = item.durationHours;
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
  const description =
    item.description?.trim() ||
    'Описание пока не добавлено — откройте управление, чтобы дополнить карточку.';
  const statusText =
    item.status === 'FINISHED'
      ? 'Завершена'
      : item.status === 'CLOSED'
        ? 'Набор закрыт'
        : 'Набор открыт';
  const statusIcon =
    item.status === 'FINISHED'
      ? ('flag' as const)
      : item.status === 'CLOSED'
        ? ('lock-closed' as const)
        : ('radio-button-on' as const);
  const playersLabel = `${item.playersCount ?? 0}/${item.maxPlayers}`;

  return (
    <View
      style={styles.cardSlot}
      {...(Platform.OS === 'web'
        ? ({
            onMouseEnter: () => setHovered(true),
            onMouseLeave: () => setHovered(false),
          } as object)
        : null)}>
      <View style={[styles.card, hovered && styles.cardHovered]}>
        <View style={styles.cover}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={item.title}
            onPress={() => onManage(item.id)}
            style={StyleSheet.absoluteFill}>
            {coverUrl ? (
              <Image
                key={coverUrl}
                source={{ uri: coverUrl }}
                style={styles.coverImage}
                contentFit="cover"
                pointerEvents="none"
                {...(Platform.OS === 'web'
                  ? ({
                      draggable: false,
                      className: 'game-cover-photo',
                    } as object)
                  : {})}
              />
            ) : (
              <View style={styles.coverPlaceholder}>
                <Ionicons name="image-outline" size={28} color={colors.textMuted} />
                <Text style={styles.coverPlaceholderLabel}>Без обложки</Text>
              </View>
            )}

            <View pointerEvents="none" style={styles.coverShield} />
            <View pointerEvents="none" style={styles.coverGradient}>
              {Platform.OS !== 'web' ? (
                <>
                  <View style={styles.coverGradientNativeMid} />
                  <View style={styles.coverGradientNativeBase} />
                </>
              ) : null}
            </View>
          </Pressable>

          <View style={styles.coverTopBar} pointerEvents="box-none">
            <View
              style={[
                styles.statusBadge,
                item.status === 'CLOSED' && styles.statusBadgeClosed,
                item.status === 'FINISHED' && styles.statusBadgeFinished,
              ]}>
              <Ionicons name={statusIcon} size={11} color={colors.onPrimary} />
              <Text style={styles.statusBadgeText}>{statusText}</Text>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Управление"
              onPress={() => onManage(item.id)}
              style={({ pressed }) => [styles.manageButton, pressed && { opacity: 0.88 }]}>
              <Ionicons name="settings-outline" size={13} color={colors.onPrimary} />
              <Text style={styles.manageButtonText}>Управление</Text>
              {(item.pendingApplicationsCount ?? 0) > 0 ? (
                <View style={styles.manageBadge}>
                  <Text style={styles.manageBadgeText}>{item.pendingApplicationsCount}</Text>
                </View>
              ) : null}
            </Pressable>
          </View>

          <View style={styles.coverBottomBar} pointerEvents="box-none">
            <View style={styles.dateChip}>
              <Ionicons name="today-outline" size={12} color="#FFFFFF" />
              <Text style={styles.dateChipText} numberOfLines={1}>
                {scheduleLabel}
              </Text>
            </View>
            <View
              style={[
                styles.kindBadge,
                isCampaign ? styles.kindBadgeCampaign : styles.kindBadgeOneshot,
              ]}>
              <Ionicons name={kindIcon} size={13} color={colors.onPrimary} />
              <Text style={styles.kindBadgeText}>{kindLabel}</Text>
            </View>
          </View>
        </View>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={item.title}
          onPress={() => onManage(item.id)}>
          <View style={styles.body}>
            <View style={styles.metaRow}>
              <View style={styles.metaItems}>
                <MetaItem
                  icon={item.isOnline ? 'wifi-outline' : 'map-outline'}
                  label={location}
                  styles={styles}
                  colors={colors}
                />
                <MetaItem
                  icon="layers-outline"
                  label={item.systemName}
                  styles={styles}
                  colors={colors}
                />
                <MetaItem
                  icon={item.beginnersWelcome ? 'leaf-outline' : 'ribbon-outline'}
                  label={experienceLabel}
                  styles={styles}
                  colors={colors}
                />
                {durationLabel ? (
                  <View style={styles.durationBadge}>
                    <Ionicons name="timer-outline" size={12} color="#FF9500" />
                    <Text style={styles.durationBadgeText}>{durationLabel}</Text>
                  </View>
                ) : null}
                <View style={styles.ageBadge}>
                  <Ionicons name="id-card-outline" size={12} color={colors.primary} />
                  <Text style={styles.ageBadgeText}>{ageLabel}</Text>
                </View>
              </View>
            </View>

            <View style={styles.titleRow}>
              <Text style={styles.title} numberOfLines={2}>
                {item.title}
              </Text>
              <View style={styles.priceWrap}>
                {item.isFree ? (
                  <Ionicons name="pricetag-outline" size={15} color="#3DAB5A" />
                ) : null}
                <Text
                  style={[
                    styles.priceText,
                    item.isFree ? styles.priceTextFree : styles.priceTextPaid,
                  ]}>
                  {priceLabel}
                </Text>
              </View>
            </View>

            <View style={styles.descriptionRow}>
              <Text style={styles.description} numberOfLines={2}>
                {description}
              </Text>
              <View style={styles.players}>
                <Ionicons name="people-outline" size={13} color={colors.textMuted} />
                <Text style={styles.playersText}>{playersLabel}</Text>
              </View>
            </View>
          </View>
        </Pressable>
      </View>
    </View>
  );
}

export default function MasterRoomScreen() {
  const router = useRouter();
  const mainStyles = useMainScreenStyles();
  const colors = useTheme();
  const isDesktopWeb = useIsDesktopWeb();
  const hasDesktopSidebar = useIsDesktopSidebarVisible();
  const showCompactNav = !hasDesktopSidebar;
  const styles = useThemedStyles((theme) => createLocalStyles(theme, isDesktopWeb));

  const [items, setItems] = useState<GameListItem[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const next = await listMyGames();
      setItems(next);
    } catch (error) {
      toast.error(localizeErrorMessage(error, 'Не удалось загрузить игры'));
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const openCreate = useCallback(() => {
    router.push('/games-create');
  }, [router]);

  const openManage = useCallback(
    (id: string) => {
      router.push({ pathname: '/games-manage', params: { id } });
    },
    [router],
  );

  const gamesCountLabel =
    items.length === 0
      ? 'Пока нет созданных игр'
      : items.length === 1
        ? '1 игра'
        : `${items.length} игр`;

  return (
    <ScreenTransition animateOnFocus>
      <View style={mainStyles.container}>
        <View style={styles.shell}>
          {showCompactNav ? (
            <View style={styles.headerBlock}>
              <MobileScreenHeader title="Кабинет мастера" showBack />
              <Button
                label="Создать игру"
                icon={<MenuIcon name="dragon" size={18} />}
                onPress={openCreate}
                style={styles.createButtonMobile}
              />
            </View>
          ) : (
            <View style={styles.headerRow}>
              <View style={styles.headerCopy}>
                <Text style={styles.pageTitle}>Кабинет мастера</Text>
                <Text style={styles.pageSubtitle}>
                  {items.length === 0
                    ? 'Создавайте ваншоты и кампании, управляйте столами и приглашайте игроков.'
                    : `${gamesCountLabel} · управляйте столами и приглашайте игроков`}
                </Text>
              </View>
              <Button
                label="Создать игру"
                icon={<MenuIcon name="dragon" size={18} />}
                onPress={openCreate}
                style={styles.createButtonDesktop}
              />
            </View>
          )}

          {loading ? (
            <View style={styles.stateWrap}>
              <ActivityIndicator color={colors.primary} />
            </View>
          ) : items.length === 0 ? (
            <View style={styles.empty}>
              <View style={styles.emptyIconWrap}>
                <MenuIcon name="master" size={28} />
              </View>
              <Text style={styles.emptyTitle}>Пока нет игр</Text>
              <Text style={styles.emptyHint}>
                Создайте первый ваншот или кампанию — игроки смогут найти ваш стол и
                присоединиться.
              </Text>
              <Button
                label="Создать игру"
                icon={<MenuIcon name="dragon" size={18} />}
                onPress={openCreate}
                style={styles.emptyCreate}
              />
            </View>
          ) : (
            <ScrollView
              style={styles.gridScroll}
              contentContainerStyle={styles.grid}
              showsVerticalScrollIndicator={false}>
              {items.map((item) => (
                <GameCard
                  key={item.id}
                  item={item}
                  styles={styles}
                  colors={colors}
                  onManage={openManage}
                />
              ))}
            </ScrollView>
          )}
        </View>
      </View>
    </ScreenTransition>
  );
}
