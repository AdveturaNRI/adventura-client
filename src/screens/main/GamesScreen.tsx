import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import {
  ActivityIndicator,
  Modal,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { GameFeedCard } from '@/components/games/GameFeedCard';
import { GamesFiltersPanel } from '@/components/games/GamesFiltersPanel';
import { AuthorsBar } from '@/components/authors/AuthorsBar';
import { PartnersTicker } from '@/components/partners/PartnersTicker';
import { MobileScreenHeader } from '@/components/navigation/MobileScreenHeader';
import { useIsDesktopSidebarVisible, useIsDesktopWeb } from '@/components/navigation/DesktopThemeToggle';
import { ScreenTransition } from '@/components/navigation/ScreenTransition';
import {
  ScrollToTopButton,
  shouldShowScrollToTop,
} from '@/components/navigation/ScrollToTopButton';
import { toast } from '@/components/ui';
import { FontSize, Radius, Spacing, type ThemeColors } from '@/constants/theme';
import { useAuthors } from '@/context/AuthorsContext';
import { useProfile } from '@/context/ProfileContext';
import { useRequireAuth } from '@/hooks/use-require-auth';
import { useTheme } from '@/hooks/use-theme';
import { useThemedStyles } from '@/hooks/use-themed-styles';
import {
  applyToGame,
  cancelGameApplication,
  listGamesFeed,
  type GameListItem,
  type GamesFeedQuery,
  type GamesFeedStatus,
} from '@/services/games/gamesApi';
import {
  EMPTY_GAMES_FEED_FILTERS,
  applyGamesFilterPatch,
  buildActiveGamesFilterChips,
  clearGamesFilterChip,
  countActiveGamesFilters,
  gamesFeedFiltersFromSearchParams,
  gamesFeedSearchParamsFromFilters,
  gamesFiltersSignature,
  hasGamesFilterSearchParams,
  type GamesFeedFilters,
} from '@/utils/games-filters';
import { localizeErrorMessage } from '@/utils/localizeError';
import { DEFAULT_TIMEZONE } from '@/utils/timezones';

import { useMainScreenStyles } from './main-screen.styles';

const DESKTOP_CONTENT_MAX = 1120;
const DESKTOP_CARD_WIDTH = 420;
const DESKTOP_GRID_GAP = Spacing.lg;

function createLocalStyles(colors: ThemeColors, isDesktopWeb: boolean) {
  return StyleSheet.create({
    shell: {
      width: '100%',
      maxWidth: isDesktopWeb ? DESKTOP_CONTENT_MAX : undefined,
      alignSelf: isDesktopWeb ? 'center' : undefined,
      gap: isDesktopWeb ? Spacing.lg : Spacing.md,
      paddingBottom: Spacing.xl,
    },
    headerBlock: {
      gap: Spacing.xs,
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
      maxWidth: 480,
    },
    toolbar: {
      gap: Spacing.sm,
    },
    filtersRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
      alignItems: 'center',
    },
    searchRow: {
      flexDirection: isDesktopWeb ? 'row' : 'column',
      alignItems: isDesktopWeb ? 'center' : 'stretch',
      gap: Spacing.sm,
      width: '100%',
    },
    searchField: {
      flex: isDesktopWeb ? 1 : undefined,
      width: isDesktopWeb ? undefined : '100%',
      minWidth: 0,
      minHeight: 44,
      borderRadius: Radius.pill,
      borderWidth: 1,
      borderColor: colors.borderLight,
      backgroundColor: colors.surface,
      paddingHorizontal: Spacing.md,
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.sm,
    },
    filtersActionsRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.sm,
      flexShrink: 0,
    },
    searchInput: {
      flex: 1,
      minWidth: 0,
      fontSize: FontSize.input,
      color: colors.text,
      paddingVertical: Platform.OS === 'web' ? 10 : 8,
      ...Platform.select({
        web: { outlineStyle: 'none' } as object,
        default: {},
      }),
    },
    filtersOpenBtn: {
      flexShrink: 0,
      minHeight: 44,
      paddingHorizontal: 14,
      borderRadius: Radius.pill,
      borderWidth: 1,
      borderColor: colors.borderLight,
      backgroundColor: colors.surface,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    filtersOpenBtnActive: {
      borderColor: 'rgba(21, 122, 254, 0.35)',
      backgroundColor: 'rgba(21, 122, 254, 0.12)',
    },
    filtersOpenLabel: {
      fontSize: FontSize.caption,
      fontWeight: '700',
      color: colors.text,
    },
    filtersBadge: {
      minWidth: 18,
      height: 18,
      paddingHorizontal: 5,
      borderRadius: 999,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.primary,
    },
    filtersBadgeText: {
      fontSize: 11,
      fontWeight: '700',
      color: colors.onPrimary,
    },
    activeChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      minHeight: 32,
      paddingLeft: 10,
      paddingRight: 8,
      borderRadius: Radius.pill,
      borderWidth: 1,
      borderColor: 'rgba(21, 122, 254, 0.35)',
      backgroundColor: 'rgba(21, 122, 254, 0.12)',
    },
    activeChipLabel: {
      fontSize: FontSize.caption,
      fontWeight: '600',
      color: colors.primary,
    },
    filterChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: Radius.pill,
      borderWidth: 1,
      borderColor: colors.borderLight,
      backgroundColor: colors.surface,
    },
    filterChipSelected: {
      borderColor: 'rgba(21, 122, 254, 0.35)',
      backgroundColor: 'rgba(21, 122, 254, 0.12)',
    },
    filterChipLabel: {
      fontSize: FontSize.caption,
      fontWeight: '700',
      color: colors.text,
    },
    filterChipLabelSelected: {
      color: colors.primary,
    },
    grid: {
      flexDirection: isDesktopWeb ? 'row' : 'column',
      flexWrap: isDesktopWeb ? 'wrap' : 'nowrap',
      alignContent: 'flex-start',
      gap: isDesktopWeb ? DESKTOP_GRID_GAP : Spacing.md,
    },
    cardSlot: {
      width: isDesktopWeb ? DESKTOP_CARD_WIDTH : '100%',
      maxWidth: isDesktopWeb ? DESKTOP_CARD_WIDTH : '100%',
    },
    stateWrap: {
      alignItems: 'center',
      justifyContent: 'center',
      gap: Spacing.md,
      paddingHorizontal: Spacing.xl,
      paddingVertical: Spacing.xl,
    },
    emptyIconWrap: {
      width: 56,
      height: 56,
      borderRadius: 18,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'rgba(21, 122, 254, 0.1)',
    },
    emptyTitle: {
      fontSize: FontSize.button,
      fontWeight: '700',
      color: colors.text,
      textAlign: 'center',
    },
    emptyHint: {
      fontSize: FontSize.caption,
      color: colors.textMuted,
      textAlign: 'center',
      lineHeight: FontSize.caption * 1.45,
      maxWidth: 320,
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
      fontSize: FontSize.label,
      color: colors.text,
      textAlignVertical: 'top',
    },
    modalActions: {
      gap: Spacing.sm,
    },
    modalPrimary: {
      minHeight: 48,
      borderRadius: Radius.pill,
      backgroundColor: colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: Spacing.lg,
    },
    modalPrimaryLabel: {
      fontSize: FontSize.label,
      fontWeight: '700',
      color: colors.onPrimary,
    },
    modalSecondary: {
      minHeight: 44,
      borderRadius: Radius.pill,
      alignItems: 'center',
      justifyContent: 'center',
    },
    modalSecondaryLabel: {
      fontSize: FontSize.label,
      fontWeight: '600',
      color: colors.textMuted,
    },
  });
}

export default function GamesScreen() {
  const router = useRouter();
  const searchParams = useLocalSearchParams();
  const mainStyles = useMainScreenStyles();
  const colors = useTheme();
  const isDesktopWeb = useIsDesktopWeb();
  const hasDesktopSidebar = useIsDesktopSidebarVisible();
  const showCompactNav = !hasDesktopSidebar;
  const styles = useThemedStyles((theme) => createLocalStyles(theme, isDesktopWeb));
  const { profile } = useProfile();
  const { authors } = useAuthors();
  const requireAuth = useRequireAuth();
  const viewerTimezone = profile?.timezone?.trim() || DEFAULT_TIMEZONE;

  const [items, setItems] = useState<GameListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<GamesFeedFilters>(EMPTY_GAMES_FEED_FILTERS);
  const [draftFilters, setDraftFilters] = useState<GamesFeedFilters>(EMPTY_GAMES_FEED_FILTERS);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [searchDraft, setSearchDraft] = useState('');
  const [busyGameId, setBusyGameId] = useState<string | null>(null);
  const [applyTarget, setApplyTarget] = useState<GameListItem | null>(null);
  const [applyMessage, setApplyMessage] = useState('');
  const [showScrollTop, setShowScrollTop] = useState(false);
  const lastAppliedParamsSignature = useRef<string>('');
  const scrollRef = useRef<ScrollView>(null);

  const searchParamsSignature = useMemo(
    () =>
      [
        searchParams.kind,
        searchParams.type,
        searchParams.playMode,
        searchParams.format,
        searchParams.age,
        searchParams.system,
        searchParams.isFree,
        searchParams.free,
        searchParams.beginnersWelcome,
        searchParams.cityId,
        searchParams.cityLabel,
        searchParams.q,
      ]
        .flat()
        .join('|'),
    [searchParams],
  );
  const activeFilterCount = useMemo(
    () => countActiveGamesFilters({ ...filters, q: '' }),
    [filters],
  );
  const activeChips = useMemo(
    () => buildActiveGamesFilterChips({ ...filters, q: '' }),
    [filters],
  );

  const toQuery = useCallback(
    (next: GamesFeedFilters): GamesFeedQuery => {
      const profileCityIds =
        profile?.cities && profile.cities.length > 0
          ? profile.cities.map((city) => city.id)
          : profile?.city?.id
            ? [profile.city.id]
            : [];

      return {
        status: next.status,
        timezone: viewerTimezone,
        ...(next.q.trim() ? { q: next.q.trim() } : {}),
        ...(next.kind ? { kind: next.kind } : {}),
        ...(next.playMode === 'online'
          ? { isOnline: true }
          : next.playMode === 'offline'
            ? { isOnline: false }
            : {}),
        ...(next.playMode === 'offline' && next.cityId
          ? { cityId: next.cityId }
          : next.playMode === 'offline' && profileCityIds.length > 0
            ? { cityIds: profileCityIds }
            : {}),
        ...(next.system ? { system: next.system } : {}),
        ...(next.isFree !== null ? { isFree: next.isFree } : {}),
        ...(next.hasSeats ? { hasSeats: true } : {}),
        ...(next.beginnersWelcome ? { beginnersWelcome: true } : {}),
        ...(next.age ? { age: next.age } : {}),
        ...(next.schedulePreset
          ? { schedulePreset: next.schedulePreset }
          : next.scheduledFrom && next.scheduledTo
            ? { scheduledFrom: next.scheduledFrom, scheduledTo: next.scheduledTo }
            : {}),
      };
    },
    [profile?.cities, profile?.city?.id, viewerTimezone],
  );

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const next = await listGamesFeed(toQuery(filters));
      setItems(next);
    } catch (error) {
      toast.error(localizeErrorMessage(error, 'Не удалось загрузить ленту игр'));
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [filters, toQuery]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  useEffect(() => {
    if (!hasGamesFilterSearchParams(searchParams)) {
      return;
    }
    if (searchParamsSignature === lastAppliedParamsSignature.current) {
      return;
    }

    setFilters((current) => {
      const next = gamesFeedFiltersFromSearchParams(searchParams, {
        ...EMPTY_GAMES_FEED_FILTERS,
        status: current.status,
        schedulePreset: current.schedulePreset,
        scheduledFrom: current.scheduledFrom,
        scheduledTo: current.scheduledTo,
      });
      if (gamesFiltersSignature(next) === gamesFiltersSignature(current)) {
        lastAppliedParamsSignature.current = searchParamsSignature;
        return current;
      }
      lastAppliedParamsSignature.current = searchParamsSignature;
      setDraftFilters(next);
      setSearchDraft(next.q);
      return next;
    });
  }, [searchParams, searchParamsSignature]);

  useEffect(() => {
    const handle = setTimeout(() => {
      const trimmed = searchDraft.trim();
      setFilters((current) =>
        current.q === trimmed ? current : { ...current, q: trimmed },
      );
    }, 350);
    return () => clearTimeout(handle);
  }, [searchDraft]);

  const selectFeedStatus = useCallback((status: GamesFeedStatus) => {
    setFilters((current) => ({ ...current, status }));
    setDraftFilters((current) => ({ ...current, status }));
  }, []);

  const openFilters = useCallback(() => {
    setDraftFilters(filters);
    setFiltersOpen(true);
  }, [filters]);

  const applyFilters = useCallback(() => {
    setFilters({ ...draftFilters, q: searchDraft.trim() });
    setFiltersOpen(false);
  }, [draftFilters, searchDraft]);

  const clearFilters = useCallback(() => {
    const next = { ...EMPTY_GAMES_FEED_FILTERS, status: filters.status, q: searchDraft.trim() };
    setDraftFilters(next);
    setFilters(next);
    setFiltersOpen(false);
  }, [filters.status, searchDraft]);

  const removeChip = useCallback((key: string) => {
    setFilters((current) => {
      const next = clearGamesFilterChip(current, key);
      if (key === 'q') {
        setSearchDraft('');
      }
      return next;
    });
  }, []);

  const syncFiltersToSearchParams = useCallback(
    (next: GamesFeedFilters) => {
      if (Platform.OS !== 'web') {
        return;
      }
      const params = gamesFeedSearchParamsFromFilters(next);
      const signature = Object.entries(params)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, value]) => `${key}=${value}`)
        .join('&');
      lastAppliedParamsSignature.current = signature;
      router.setParams(params);
    },
    [router],
  );

  const applyFilterBadge = useCallback(
    (patch: Partial<GamesFeedFilters>) => {
      setFilters((current) => {
        const next = applyGamesFilterPatch(current, patch);
        syncFiltersToSearchParams(next);
        return next;
      });
      setDraftFilters((current) => applyGamesFilterPatch(current, patch));
    },
    [syncFiltersToSearchParams],
  );

  const isOpenFeed = filters.status === 'RECRUITING';
  const pageSubtitle = isOpenFeed
    ? 'Столы с открытым набором — найдите игру и присоединяйтесь.'
    : 'Столы с закрытым набором — посмотреть составы и детали, заявки уже не принимаются.';
  const emptyTitle =
    activeFilterCount > 0
      ? 'Ничего не нашлось'
      : isOpenFeed
        ? 'Пока нет открытых столов'
        : 'Нет столов с закрытым набором';
  const emptyHint =
    activeFilterCount > 0
      ? 'Снимите часть фильтров или измените поиск — так проще найти подходящий стол.'
      : isOpenFeed
        ? 'Когда мастера откроют набор, игры появятся здесь. Свой стол можно создать в кабинете мастера.'
        : 'Когда мастера закроют набор, такие игры появятся в этом списке.';

  const patchItem = useCallback((next: GameListItem) => {
    setItems((current) => current.map((item) => (item.id === next.id ? next : item)));
  }, []);

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

  const openDetail = useCallback(
    (id: string) => {
      router.push(`/games/${id}`);
    },
    [router],
  );

  const openApply = useCallback(
    (item: GameListItem) => {
      if (!requireAuth(`/games/${item.id}`)) {
        return;
      }
      setApplyTarget(item);
      setApplyMessage('');
    },
    [requireAuth],
  );

  const closeApply = useCallback(() => {
    if (busyGameId) {
      return;
    }
    setApplyTarget(null);
    setApplyMessage('');
  }, [busyGameId]);

  const submitApply = useCallback(async () => {
    if (!applyTarget || busyGameId) {
      return;
    }

    const gameId = applyTarget.id;
    setBusyGameId(gameId);
    try {
      const next = await applyToGame(gameId, applyMessage);
      patchItem(next);
      setApplyTarget(null);
      setApplyMessage('');
      toast.success('Заявка отправлена');
    } catch (error) {
      toast.error(localizeErrorMessage(error, 'Не удалось отправить заявку'));
    } finally {
      setBusyGameId(null);
    }
  }, [applyMessage, applyTarget, busyGameId, patchItem]);

  const handleCancel = useCallback(
    async (gameId: string) => {
      if (busyGameId) {
        return;
      }
      setBusyGameId(gameId);
      try {
        const next = await cancelGameApplication(gameId);
        patchItem(next);
        toast.success('Заявка отменена');
      } catch (error) {
        toast.error(localizeErrorMessage(error, 'Не удалось отменить заявку'));
      } finally {
        setBusyGameId(null);
      }
    },
    [busyGameId, patchItem],
  );

  const filtersOpenButton = (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Фильтры"
      onPress={openFilters}
      style={({ pressed }) => [
        styles.filtersOpenBtn,
        activeFilterCount > 0 && styles.filtersOpenBtnActive,
        pressed && { opacity: 0.88 },
      ]}>
      <Ionicons
        name="options-outline"
        size={16}
        color={activeFilterCount > 0 ? colors.primary : colors.text}
      />
      <Text
        style={[
          styles.filtersOpenLabel,
          activeFilterCount > 0 && { color: colors.primary },
        ]}>
        Фильтры
      </Text>
      {activeFilterCount > 0 ? (
        <View style={styles.filtersBadge}>
          <Text style={styles.filtersBadgeText}>{activeFilterCount}</Text>
        </View>
      ) : null}
    </Pressable>
  );

  return (
    <ScreenTransition animateOnFocus>
      <View style={{ flex: 1 }}>
      <ScrollView
        ref={scrollRef}
        style={mainStyles.scroll}
        contentContainerStyle={mainStyles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        scrollEventThrottle={16}
        onScroll={(event: NativeSyntheticEvent<NativeScrollEvent>) => {
          setShowScrollTop(shouldShowScrollToTop(event.nativeEvent.contentOffset.y));
        }}>
        <View style={styles.shell}>
          {showCompactNav ? (
            <View style={styles.headerBlock}>
              <MobileScreenHeader title="Игры" />
              <Text style={styles.pageSubtitle}>{pageSubtitle}</Text>
            </View>
          ) : (
            <View style={styles.headerBlock}>
              <Text style={styles.pageTitle}>Игры</Text>
              <Text style={styles.pageSubtitle}>{pageSubtitle}</Text>
            </View>
          )}

          <AuthorsBar title="✨ Свежее от сообщества" authors={authors} />

          <PartnersTicker />

          <View style={styles.toolbar}>
            <View style={styles.searchRow}>
              <View style={styles.searchField}>
                <Ionicons name="search-outline" size={16} color={colors.textMuted} />
                <TextInput
                  value={searchDraft}
                  onChangeText={setSearchDraft}
                  placeholder="Название, мастер или система"
                  placeholderTextColor={colors.textMuted}
                  style={styles.searchInput}
                  returnKeyType="search"
                  autoCorrect={false}
                  autoCapitalize="none"
                />
                {searchDraft ? (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Очистить поиск"
                    hitSlop={8}
                    onPress={() => setSearchDraft('')}>
                    <Ionicons name="close-circle" size={16} color={colors.textMuted} />
                  </Pressable>
                ) : null}
              </View>
              {isDesktopWeb ? (
                <View style={styles.filtersActionsRow}>{filtersOpenButton}</View>
              ) : null}
            </View>

            <View style={styles.filtersRow}>
              {!isDesktopWeb ? filtersOpenButton : null}
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ selected: isOpenFeed }}
                onPress={() => selectFeedStatus('RECRUITING')}
                style={({ pressed }) => [
                  styles.filterChip,
                  isOpenFeed && styles.filterChipSelected,
                  pressed && { opacity: 0.85 },
                ]}>
                <Ionicons
                  name="radio-button-on"
                  size={14}
                  color={isOpenFeed ? colors.primary : colors.text}
                />
                <Text
                  style={[
                    styles.filterChipLabel,
                    isOpenFeed && styles.filterChipLabelSelected,
                  ]}>
                  Открытый набор
                </Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ selected: !isOpenFeed }}
                onPress={() => selectFeedStatus('CLOSED')}
                style={({ pressed }) => [
                  styles.filterChip,
                  !isOpenFeed && styles.filterChipSelected,
                  pressed && { opacity: 0.85 },
                ]}>
                <Ionicons
                  name="lock-closed-outline"
                  size={14}
                  color={!isOpenFeed ? colors.primary : colors.text}
                />
                <Text
                  style={[
                    styles.filterChipLabel,
                    !isOpenFeed && styles.filterChipLabelSelected,
                  ]}>
                  Закрытый набор
                </Text>
              </Pressable>
              {activeChips.map((chip) => (
                <Pressable
                  key={chip.key}
                  accessibilityRole="button"
                  accessibilityLabel={`Убрать фильтр ${chip.label}`}
                  onPress={() => removeChip(chip.key)}
                  style={({ pressed }) => [styles.activeChip, pressed && { opacity: 0.85 }]}>
                  <Ionicons
                    name={chip.icon as keyof typeof Ionicons.glyphMap}
                    size={13}
                    color={colors.primary}
                  />
                  <Text style={styles.activeChipLabel}>{chip.label}</Text>
                  <Ionicons name="close" size={14} color={colors.primary} />
                </Pressable>
              ))}
            </View>
          </View>

          {loading ? (
            <View style={styles.stateWrap}>
              <ActivityIndicator color={colors.primary} />
            </View>
          ) : items.length === 0 ? (
            <View style={styles.stateWrap}>
              <View style={styles.emptyIconWrap}>
                <Ionicons
                  name={isOpenFeed ? 'flame-outline' : 'lock-closed-outline'}
                  size={26}
                  color={colors.primary}
                />
              </View>
              <Text style={styles.emptyTitle}>{emptyTitle}</Text>
              <Text style={styles.emptyHint}>{emptyHint}</Text>
            </View>
          ) : (
            <View style={styles.grid}>
              {items.map((item) => (
                <View key={item.id} style={styles.cardSlot}>
                  <GameFeedCard
                    item={item}
                    busy={busyGameId === item.id}
                    onPress={() => openDetail(item.id)}
                    onFilterBadgePress={applyFilterBadge}
                    onOpenMaster={openMaster}
                    onApply={openApply}
                    onCancel={(id) => void handleCancel(id)}
                    onManage={openManage}
                  />
                </View>
              ))}
            </View>
          )}
        </View>
      </ScrollView>

      <ScrollToTopButton
        visible={showScrollTop}
        onPress={() => scrollRef.current?.scrollTo({ y: 0, animated: true })}
      />
      </View>

      <Modal
        visible={Boolean(applyTarget)}
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
              placeholder="Привет! Хочу к вам за стол…"
              placeholderTextColor={colors.textMuted}
              multiline
              maxLength={1000}
              style={styles.modalInput}
            />
            <View style={styles.modalActions}>
              <Pressable
                accessibilityRole="button"
                disabled={Boolean(busyGameId)}
                onPress={() => void submitApply()}
                style={({ pressed }) => [
                  styles.modalPrimary,
                  pressed && { opacity: 0.88 },
                  busyGameId && { opacity: 0.55 },
                ]}>
                <Text style={styles.modalPrimaryLabel}>
                  {busyGameId ? 'Отправляем…' : 'Отправить заявку'}
                </Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                disabled={Boolean(busyGameId)}
                onPress={closeApply}
                style={({ pressed }) => [styles.modalSecondary, pressed && { opacity: 0.75 }]}>
                <Text style={styles.modalSecondaryLabel}>Отмена</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      <GamesFiltersPanel
        visible={filtersOpen}
        draft={draftFilters}
        onChange={setDraftFilters}
        onApply={applyFilters}
        onClear={clearFilters}
        onClose={() => setFiltersOpen(false)}
      />
    </ScreenTransition>
  );
}
