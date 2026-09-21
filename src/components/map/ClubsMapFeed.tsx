import { Ionicons } from '@expo/vector-icons';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
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

import type { ClubsSelectedCity } from '@/components/map/clubs-map-session';
import { toLatLng } from '@/components/map/map-coords';
import { useIsDesktopWeb } from '@/components/navigation/DesktopThemeToggle';
import { FadeInImage } from '@/components/ui/media/FadeInImage';
import { AnalyticsImpression } from '@/components/analytics/AnalyticsImpression';
import { FontSize, Radius, Spacing, type ThemeColors } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useThemedStyles } from '@/hooks/use-themed-styles';
import {
  geocodeCityLabel,
  isValidLatLng,
  type ClubListItem,
  type ClubScheduleDay,
} from '@/services/clubs/clubsApi';
import { fetchCities } from '@/services/reference/referenceApi';
import type { CityReferenceItem } from '@/utils/city-label';

type FeedItem = ClubListItem & { distanceKm: number };

type Props = {
  nearbyClubs: FeedItem[];
  allClubs: FeedItem[];
  mapCollapsed: boolean;
  selectedCity: ClubsSelectedCity | null;
  onSelectCity: (
    city: ClubsSelectedCity | null,
    options?: { moveCamera?: boolean; manual?: boolean },
  ) => void;
  onToggleMap: () => void;
  onPressClub: (club: ClubListItem) => void;
  showMapToggle?: boolean;
};

const CITY_SEARCH_DEBOUNCE_MS = 220;

function cityNeedle(label: string) {
  return label.split(',')[0]?.trim().toLowerCase() ?? '';
}

function clubMatchesCity(club: FeedItem, city: ClubsSelectedCity) {
  const needle = cityNeedle(city.label);
  if (!needle) {
    return true;
  }
  const clubCity = club.city?.name?.toLowerCase() ?? '';
  const region = club.city?.region?.toLowerCase() ?? '';
  const address = club.address.toLowerCase();
  return (
    clubCity === needle ||
    clubCity.includes(needle) ||
    needle.includes(clubCity) ||
    region.includes(needle) ||
    address.includes(needle)
  );
}

function createStyles(colors: ThemeColors, isDesktop: boolean) {
  return StyleSheet.create({
    root: {
      flex: 1,
      minHeight: 0,
      borderRadius: isDesktop ? 20 : 12,
      borderWidth: isDesktop ? StyleSheet.hairlineWidth : 0,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      overflow: 'hidden',
    },
    header: {
      paddingHorizontal: Spacing.md,
      paddingTop: Spacing.md,
      paddingBottom: Spacing.sm,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.borderLight,
      gap: Spacing.sm,
    },
    headerTop: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: Spacing.sm,
    },
    headerText: {
      flex: 1,
      minWidth: 0,
      gap: 2,
    },
    title: {
      fontSize: FontSize.button,
      fontWeight: '700',
      color: colors.text,
    },
    subtitle: {
      fontSize: FontSize.caption,
      color: colors.textMuted,
    },
    mapToggle: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: Radius.pill,
      backgroundColor: colors.primary + '14',
      borderWidth: 1,
      borderColor: colors.primary + '33',
    },
    mapTogglePressed: {
      opacity: 0.88,
    },
    mapToggleText: {
      fontSize: FontSize.caption,
      fontWeight: '700',
      color: colors.primary,
    },
    searchField: {
      minHeight: 42,
      borderRadius: Radius.pill,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.background,
      paddingHorizontal: Spacing.md,
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.sm,
    },
    searchInput: {
      flex: 1,
      fontSize: FontSize.label,
      color: colors.text,
      paddingVertical: Platform.OS === 'web' ? 10 : 8,
      ...Platform.select({
        web: {
          outlineStyle: 'none',
          outlineWidth: 0,
        } as object,
        default: {},
      }),
    },
    list: {
      padding: Spacing.md,
      gap: Spacing.md,
      paddingBottom: Spacing.xl,
    },
    card: {
      borderRadius: 18,
      borderWidth: 1,
      borderColor: colors.borderLight,
      backgroundColor: colors.background,
      overflow: 'hidden',
      ...Platform.select({
        web: {
          boxShadow: '0 8px 24px rgba(0,0,0,0.06)',
        } as object,
        default: {
          shadowColor: colors.shadow,
          shadowOffset: { width: 0, height: 6 },
          shadowOpacity: 0.08,
          shadowRadius: 14,
          elevation: 3,
        },
      }),
    },
    cardPressed: {
      opacity: 0.94,
      transform: [{ scale: 0.995 }],
    },
    coverWrap: {
      width: '100%',
      aspectRatio: 16 / 9,
      backgroundColor: colors.surfaceMuted,
      position: 'relative',
    },
    cover: {
      ...StyleSheet.absoluteFill,
      width: '100%',
      height: '100%',
    },
    coverGradient: {
      ...StyleSheet.absoluteFill,
      ...Platform.select({
        web: {
          backgroundImage:
            'linear-gradient(to top, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0.12) 45%, rgba(0,0,0,0) 72%)',
        } as object,
        default: {
          backgroundColor: 'rgba(0,0,0,0.22)',
        },
      }),
    },
    coverEmpty: {
      ...StyleSheet.absoluteFill,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.primaryLight + '33',
    },
    coverBadges: {
      position: 'absolute',
      left: Spacing.sm,
      right: Spacing.sm,
      bottom: Spacing.sm,
      zIndex: 2,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: Spacing.sm,
    },
    distanceChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: Radius.pill,
      backgroundColor: colors.primary + 'E6',
    },
    distanceChipText: {
      fontSize: FontSize.caption,
      fontWeight: '700',
      color: colors.onPrimary,
    },
    statusChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: Radius.pill,
    },
    statusChipOpen: {
      backgroundColor: 'rgba(52, 199, 89, 0.92)',
    },
    statusChipClosed: {
      backgroundColor: 'rgba(0, 0, 0, 0.55)',
    },
    statusChipText: {
      fontSize: FontSize.caption,
      fontWeight: '700',
      color: '#FFFFFF',
    },
    body: {
      padding: Spacing.md,
      gap: Spacing.sm,
    },
    name: {
      fontSize: 17,
      fontWeight: '700',
      color: colors.text,
      letterSpacing: -0.2,
    },
    infoBlock: {
      gap: 8,
    },
    infoRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 10,
    },
    infoIcon: {
      width: 28,
      height: 28,
      borderRadius: 9,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.primary + '14',
    },
    infoIconSuccess: {
      backgroundColor: colors.success + '18',
    },
    infoTextCol: {
      flex: 1,
      minWidth: 0,
      gap: 1,
      paddingTop: 4,
    },
    infoLabel: {
      fontSize: 11,
      fontWeight: '600',
      color: colors.primary,
      textTransform: 'uppercase',
      letterSpacing: 0.3,
    },
    infoLabelMuted: {
      color: colors.success,
    },
    infoValue: {
      fontSize: FontSize.label,
      color: colors.textSecondary,
      lineHeight: FontSize.label * 1.35,
    },
    cityButton: {
      alignSelf: 'flex-start',
      maxWidth: '100%',
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      minHeight: 36,
      paddingLeft: 10,
      paddingRight: 10,
      borderRadius: Radius.pill,
      backgroundColor: 'rgba(21, 122, 254, 0.12)',
      borderWidth: 1,
      borderColor: 'rgba(21, 122, 254, 0.35)',
    },
    cityButtonPressed: {
      opacity: 0.88,
    },
    cityButtonLabel: {
      flexShrink: 1,
      fontSize: FontSize.caption,
      fontWeight: '700',
      color: colors.primary,
    },
    cityClear: {
      marginLeft: 2,
    },
    modalBackdrop: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.45)',
      justifyContent: isDesktop ? 'center' : 'flex-end',
      alignItems: 'center',
      padding: isDesktop ? Spacing.lg : 0,
    },
    modalSheet: {
      width: '100%',
      maxWidth: isDesktop ? 440 : undefined,
      maxHeight: isDesktop ? '80%' : '85%',
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      borderBottomLeftRadius: isDesktop ? 20 : 0,
      borderBottomRightRadius: isDesktop ? 20 : 0,
      backgroundColor: colors.surface,
      paddingHorizontal: Spacing.lg,
      paddingTop: Spacing.lg,
      gap: Spacing.md,
    },
    modalTitle: {
      fontSize: 18,
      fontWeight: '700',
      color: colors.text,
      letterSpacing: -0.2,
    },
    modalHint: {
      fontSize: FontSize.caption,
      color: colors.textMuted,
      marginTop: -4,
    },
    modalSearch: {
      minHeight: 44,
      borderRadius: Radius.pill,
      borderWidth: 1,
      borderColor: colors.borderLight,
      backgroundColor: colors.background,
      paddingHorizontal: Spacing.md,
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.sm,
    },
    modalInput: {
      flex: 1,
      fontSize: FontSize.input,
      color: colors.text,
      paddingVertical: Platform.OS === 'web' ? 10 : 8,
      ...Platform.select({
        web: { outlineStyle: 'none' } as object,
        default: {},
      }),
    },
    modalResults: {
      maxHeight: 280,
    },
    modalResult: {
      paddingVertical: 12,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.borderLight,
      gap: 2,
    },
    modalResultTitle: {
      fontSize: FontSize.label,
      fontWeight: '600',
      color: colors.text,
    },
    modalResultMeta: {
      fontSize: FontSize.caption,
      color: colors.textMuted,
    },
    modalEmpty: {
      paddingVertical: Spacing.lg,
      fontSize: FontSize.label,
      color: colors.textMuted,
      textAlign: 'center',
    },
    modalActions: {
      flexDirection: 'row',
      gap: Spacing.sm,
      paddingBottom: Spacing.lg,
    },
    modalSecondary: {
      flex: 1,
      minHeight: 44,
      borderRadius: Radius.pill,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.background,
      borderWidth: 1,
      borderColor: colors.borderLight,
    },
    modalSecondaryLabel: {
      fontSize: FontSize.label,
      fontWeight: '600',
      color: colors.textMuted,
    },
    empty: {
      paddingVertical: Spacing.xl,
      paddingHorizontal: Spacing.md,
      alignItems: 'center',
    },
    emptyText: {
      fontSize: FontSize.label,
      color: colors.textMuted,
      textAlign: 'center',
      lineHeight: FontSize.label * 1.4,
    },
  });
}

function formatDistance(km: number) {
  if (km < 1) {
    return `${Math.max(50, Math.round(km * 1000))} м`;
  }
  if (km < 10) {
    return `${km.toFixed(1)} км`;
  }
  return `${Math.round(km)} км`;
}

function getTodaySchedule(schedule: ClubScheduleDay[]) {
  const jsDay = new Date().getDay();
  const day = jsDay === 0 ? 7 : jsDay;
  return schedule.find((item) => item.day === day) ?? null;
}

function formatTodayHours(schedule: ClubScheduleDay[]) {
  const today = getTodaySchedule(schedule);
  if (!today || today.closed || !today.open || !today.close) {
    return { open: false, label: 'Сегодня выходной' };
  }
  return { open: true, label: `Сегодня ${today.open}–${today.close}` };
}

function clubMatchesQuery(club: FeedItem, query: string) {
  const q = query.trim().toLowerCase();
  if (!q) {
    return true;
  }

  const city = club.city
    ? `${club.city.name} ${club.city.region ?? ''}`.toLowerCase()
    : '';

  return (
    club.name.toLowerCase().includes(q) ||
    club.address.toLowerCase().includes(q) ||
    city.includes(q) ||
    (club.description ?? '').toLowerCase().includes(q)
  );
}

export function ClubsMapFeed({
  nearbyClubs,
  allClubs,
  mapCollapsed,
  selectedCity,
  onSelectCity,
  onToggleMap,
  onPressClub,
  showMapToggle = true,
}: Props) {
  const colors = useTheme();
  const insets = useSafeAreaInsets();
  const isDesktopWeb = useIsDesktopWeb();
  const styles = useThemedStyles((theme) => createStyles(theme, isDesktopWeb));
  const [query, setQuery] = useState('');
  const [cityPickerOpen, setCityPickerOpen] = useState(false);
  const [cityQuery, setCityQuery] = useState('');
  const [cityResults, setCityResults] = useState<CityReferenceItem[]>([]);
  const [citySettled, setCitySettled] = useState(false);
  const [cityPicking, setCityPicking] = useState(false);
  const cityRequestIdRef = useRef(0);
  const cityDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (cityDebounceRef.current) {
      clearTimeout(cityDebounceRef.current);
    }

    const q = cityQuery.trim();
    if (!cityPickerOpen || !q) {
      setCityResults([]);
      setCitySettled(false);
      return;
    }

    setCitySettled(false);
    cityDebounceRef.current = setTimeout(() => {
      const requestId = ++cityRequestIdRef.current;
      void fetchCities({ q, country: 'RU,BY', limit: 24 })
        .then((items) => {
          if (requestId !== cityRequestIdRef.current) {
            return;
          }
          setCityResults(items);
        })
        .catch(() => {
          if (requestId !== cityRequestIdRef.current) {
            return;
          }
          setCityResults([]);
        })
        .finally(() => {
          if (requestId === cityRequestIdRef.current) {
            setCitySettled(true);
          }
        });
    }, CITY_SEARCH_DEBOUNCE_MS);

    return () => {
      if (cityDebounceRef.current) {
        clearTimeout(cityDebounceRef.current);
      }
    };
  }, [cityPickerOpen, cityQuery]);

  const cityFilter = isDesktopWeb ? null : selectedCity;

  const filteredClubs = useMemo(() => {
    const q = query.trim();
    let source = cityFilter
      ? allClubs.filter((club) => clubMatchesCity(club, cityFilter))
      : q || mapCollapsed
        ? allClubs
        : nearbyClubs;

    if (!q) {
      return source;
    }
    return source.filter((club) => clubMatchesQuery(club, q));
  }, [allClubs, cityFilter, mapCollapsed, nearbyClubs, query]);

  const subtitle = (() => {
    if (query.trim()) {
      return filteredClubs.length
        ? `Найдено: ${filteredClubs.length}`
        : 'Ничего не нашлось';
    }
    if (cityFilter) {
      return filteredClubs.length
        ? `В городе: ${filteredClubs.length}`
        : 'В этом городе пока нет клубов';
    }
    if (mapCollapsed) {
      return allClubs.length
        ? `Всего клубов: ${allClubs.length}`
        : 'Пока нет площадок';
    }
    return nearbyClubs.length
      ? `В зоне карты: ${nearbyClubs.length}`
      : 'Подвигайте карту — появятся клубы в кадре';
  })();

  const openCityPicker = () => {
    setCityQuery('');
    setCityResults([]);
    setCitySettled(false);
    setCityPickerOpen(true);
  };

  const closeCityPicker = () => {
    setCityPickerOpen(false);
    setCityQuery('');
    setCityResults([]);
    setCitySettled(false);
  };

  const pickCity = (city: CityReferenceItem) => {
    if (cityPicking) {
      return;
    }
    setCityPicking(true);

    // Сразу выбираем город из справочника (фильтр по имени), камеру двигаем только с валидными coords
    const [fallbackLat, fallbackLng] = toLatLng(selectedCity?.lat, selectedCity?.lng);
    onSelectCity(
      { label: city.label, lat: fallbackLat, lng: fallbackLng },
      { manual: true, moveCamera: false },
    );
    closeCityPicker();

    void geocodeCityLabel(city.label)
      .then((hit) => {
        if (!isValidLatLng(Number(hit.lat), Number(hit.lng))) {
          return;
        }
        onSelectCity(
          {
            label: city.label,
            lat: Number(hit.lat),
            lng: Number(hit.lng),
          },
          { manual: true, moveCamera: true },
        );
      })
      .catch(() => {
        // город уже выбран — без камеры
      })
      .finally(() => {
        setCityPicking(false);
      });
  };

  const clearCity = () => {
    onSelectCity(null);
    closeCityPicker();
  };

  const showCityResults =
    cityQuery.trim().length > 0 && (cityResults.length > 0 || citySettled);

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <View style={styles.headerText}>
            <Text style={styles.title}>Список клубов</Text>
            <Text style={styles.subtitle}>{subtitle}</Text>
          </View>
          {showMapToggle ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={mapCollapsed ? 'Показать карту' : 'Свернуть карту'}
              onPress={onToggleMap}
              style={({ pressed }) => [styles.mapToggle, pressed && styles.mapTogglePressed]}>
              <Ionicons
                name={mapCollapsed ? 'map-outline' : 'albums-outline'}
                size={16}
                color={colors.primary}
              />
              <Text style={styles.mapToggleText}>{mapCollapsed ? 'Карта' : 'Свернуть'}</Text>
            </Pressable>
          ) : null}
        </View>

        {!isDesktopWeb ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, maxWidth: '100%' }}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={
                selectedCity ? `Город ${selectedCity.label}. Сменить город` : 'Выбрать город'
              }
              onPress={openCityPicker}
              style={({ pressed }) => [
                styles.cityButton,
                { flexShrink: 1 },
                pressed && styles.cityButtonPressed,
              ]}>
              <Ionicons name="location" size={14} color={colors.primary} />
              <Text style={styles.cityButtonLabel} numberOfLines={1}>
                {selectedCity?.label ?? 'Выберите город'}
              </Text>
              <Ionicons name="chevron-down" size={14} color={colors.primary} />
            </Pressable>
            {selectedCity ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Сбросить город"
                hitSlop={8}
                onPress={() => onSelectCity(null)}
                style={({ pressed }) => [styles.cityButton, pressed && styles.cityButtonPressed]}>
                <Ionicons name="close" size={14} color={colors.primary} />
              </Pressable>
            ) : null}
          </View>
        ) : null}

        <View style={styles.searchField}>
          <Ionicons name="search-outline" size={16} color={colors.textMuted} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Название или адрес"
            placeholderTextColor={colors.textMuted}
            style={styles.searchInput}
            returnKeyType="search"
            autoCorrect={false}
            autoCapitalize="none"
          />
          {query.length > 0 ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Очистить поиск"
              hitSlop={8}
              onPress={() => setQuery('')}>
              <Ionicons name="close-circle" size={16} color={colors.textMuted} />
            </Pressable>
          ) : null}
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.list} nestedScrollEnabled>
        {!filteredClubs.length ? (
          <View style={styles.empty}>
            <Text style={styles.emptyText}>
              {query.trim()
                ? 'По запросу клубов нет. Попробуйте другое название или адрес.'
                : cityFilter
                  ? 'В этом городе пока нет опубликованных клубов.'
                  : mapCollapsed
                    ? 'Пока нет опубликованных клубов. Создайте площадку — она появится здесь.'
                    : 'В видимой области пока нет клубов. Приблизьте другой район или создайте площадку.'}
            </Text>
          </View>
        ) : (
          filteredClubs.map((club) => {
            const hours = formatTodayHours(club.schedule ?? []);
            const cityLine = club.city
              ? `${club.city.name}${club.city.region ? `, ${club.city.region}` : ''}`
              : null;

            return (
              <AnalyticsImpression key={club.id} entity="club" id={club.id}>
                <Pressable
                  onPress={() => onPressClub(club)}
                  style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}>
                <View style={styles.coverWrap}>
                  {club.coverUrl ? (
                    <FadeInImage
                      uri={club.coverUrl}
                      style={styles.cover}
                      contentFit="cover"
                    />
                  ) : (
                    <View style={styles.coverEmpty}>
                      <Ionicons name="storefront-outline" size={28} color={colors.primary} />
                    </View>
                  )}
                  <View pointerEvents="none" style={styles.coverGradient} />
                  <View style={styles.coverBadges} pointerEvents="none">
                    <View style={styles.distanceChip}>
                      <Ionicons name="navigate" size={12} color={colors.onPrimary} />
                      <Text style={styles.distanceChipText}>
                        {formatDistance(club.distanceKm)}
                      </Text>
                    </View>
                    <View
                      style={[
                        styles.statusChip,
                        hours.open ? styles.statusChipOpen : styles.statusChipClosed,
                      ]}>
                      <Ionicons
                        name={hours.open ? 'time' : 'moon'}
                        size={12}
                        color="#FFFFFF"
                      />
                      <Text style={styles.statusChipText}>
                        {hours.open ? 'Открыто' : 'Выходной'}
                      </Text>
                    </View>
                  </View>
                </View>

                <View style={styles.body}>
                  <Text style={styles.name} numberOfLines={2}>
                    {club.name}
                  </Text>

                  <View style={styles.infoBlock}>
                    <View style={styles.infoRow}>
                      <View style={styles.infoIcon}>
                        <Ionicons name="location" size={14} color={colors.primary} />
                      </View>
                      <View style={styles.infoTextCol}>
                        <Text style={styles.infoLabel}>Адрес</Text>
                        <Text style={styles.infoValue} numberOfLines={2}>
                          {club.address}
                        </Text>
                      </View>
                    </View>

                    {cityLine ? (
                      <View style={styles.infoRow}>
                        <View style={styles.infoIcon}>
                          <Ionicons name="business" size={14} color={colors.primary} />
                        </View>
                        <View style={styles.infoTextCol}>
                          <Text style={styles.infoLabel}>Город</Text>
                          <Text style={styles.infoValue} numberOfLines={1}>
                            {cityLine}
                          </Text>
                        </View>
                      </View>
                    ) : null}

                    <View style={styles.infoRow}>
                      <View
                        style={[styles.infoIcon, hours.open && styles.infoIconSuccess]}>
                        <Ionicons
                          name="time"
                          size={14}
                          color={hours.open ? colors.success : colors.primary}
                        />
                      </View>
                      <View style={styles.infoTextCol}>
                        <Text
                          style={[styles.infoLabel, hours.open && styles.infoLabelMuted]}>
                          Режим
                        </Text>
                        <Text style={styles.infoValue} numberOfLines={1}>
                          {hours.label}
                        </Text>
                      </View>
                    </View>
                  </View>
                </View>
              </Pressable>
              </AnalyticsImpression>
            );
          })
        )}
      </ScrollView>

      {!isDesktopWeb ? (
      <Modal
        visible={cityPickerOpen}
        transparent
        animationType={isDesktopWeb ? 'fade' : 'slide'}
        onRequestClose={closeCityPicker}>
        <Pressable style={styles.modalBackdrop} onPress={closeCityPicker}>
          <Pressable
            style={[styles.modalSheet, { paddingBottom: Math.max(insets.bottom, Spacing.lg) }]}
            onPress={(event) => event.stopPropagation?.()}>
            <Text style={styles.modalTitle}>Город</Text>
            <Text style={styles.modalHint}>Покажем клубы в выбранном городе</Text>

            <View style={styles.modalSearch}>
              <Ionicons name="search-outline" size={16} color={colors.textMuted} />
              <TextInput
                value={cityQuery}
                onChangeText={setCityQuery}
                placeholder="Начните вводить город"
                placeholderTextColor={colors.textMuted}
                style={styles.modalInput}
                autoFocus
                returnKeyType="search"
                autoCorrect={false}
                autoCapitalize="none"
              />
              {cityQuery ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Очистить"
                  hitSlop={8}
                  onPress={() => setCityQuery('')}>
                  <Ionicons name="close-circle" size={16} color={colors.textMuted} />
                </Pressable>
              ) : null}
            </View>

            {showCityResults ? (
              cityResults.length ? (
                <ScrollView style={styles.modalResults} keyboardShouldPersistTaps="handled">
                  {cityResults.map((item) => (
                    <Pressable
                      key={item.id}
                      disabled={cityPicking}
                      onPress={() => pickCity(item)}
                      style={({ pressed }) => [
                        styles.modalResult,
                        (pressed || cityPicking) && { opacity: 0.75 },
                      ]}>
                      <Text style={styles.modalResultTitle} numberOfLines={1}>
                        {item.name}
                      </Text>
                      {item.region && item.region !== item.name ? (
                        <Text style={styles.modalResultMeta} numberOfLines={1}>
                          {item.region}
                        </Text>
                      ) : item.countryCode === 'BY' ? (
                        <Text style={styles.modalResultMeta} numberOfLines={1}>
                          Беларусь
                        </Text>
                      ) : null}
                    </Pressable>
                  ))}
                </ScrollView>
              ) : (
                <Text style={styles.modalEmpty}>Город не найден</Text>
              )
            ) : null}

            <View style={styles.modalActions}>
              {selectedCity ? (
                <Pressable
                  accessibilityRole="button"
                  onPress={clearCity}
                  style={({ pressed }) => [styles.modalSecondary, pressed && { opacity: 0.85 }]}>
                  <Text style={styles.modalSecondaryLabel}>Сбросить</Text>
                </Pressable>
              ) : null}
              <Pressable
                accessibilityRole="button"
                onPress={closeCityPicker}
                style={({ pressed }) => [styles.modalSecondary, pressed && { opacity: 0.85 }]}>
                <Text style={styles.modalSecondaryLabel}>Закрыть</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
      ) : null}
    </View>
  );
}
