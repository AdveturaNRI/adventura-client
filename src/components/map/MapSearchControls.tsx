import { Ionicons } from '@expo/vector-icons';
import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { toast } from '@/components/ui';
import { FontSize, Radius, Sizes, Spacing, type ThemeColors } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useThemedStyles } from '@/hooks/use-themed-styles';
import { geocodeCityLabel, isValidLatLng, type GeocodeResult } from '@/services/clubs/clubsApi';
import { fetchCities } from '@/services/reference/referenceApi';
import type { CityReferenceItem } from '@/utils/city-label';
import {
  GEOLOCATION_MANUAL_FALLBACK_MESSAGE,
  GeolocationPermissionError,
  readDeviceLocation,
} from '@/utils/geolocation';

const SEARCH_DEBOUNCE_MS = 220;

type Props = {
  onSelectCity: (hit: GeocodeResult, options?: { moveCamera?: boolean }) => void;
  onLocateMe: (point: { lat: number; lng: number }) => void;
  onLocationDenied?: () => void;
  onRetryLocation?: () => void;
  locationDenied?: boolean;
  onCollapseMap?: () => void;
  collapseLabel?: string;
  collapseIcon?: keyof typeof Ionicons.glyphMap;
};

export type MapSearchControlsHandle = {
  focusSearch: () => void;
};

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    overlay: {
      ...StyleSheet.absoluteFill,
      zIndex: 20,
      pointerEvents: 'box-none',
    },
    searchWrap: {
      position: 'absolute',
      top: Spacing.md,
      left: Spacing.md,
      right: Spacing.md,
      zIndex: 30,
      pointerEvents: 'box-none',
      gap: Spacing.sm,
    },
    inputWrap: {
      position: 'relative',
    },
    searchIcon: {
      position: 'absolute',
      left: Spacing.md,
      top: 0,
      bottom: 0,
      width: 22,
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1,
    },
    input: {
      minHeight: Sizes.controlHeight,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: Radius.pill,
      paddingHorizontal: Spacing.md,
      paddingLeft: 44,
      paddingRight: 44,
      fontSize: FontSize.input,
      color: colors.textSecondary,
      backgroundColor: colors.surface,
      ...Platform.select({
        web: {
          outlineStyle: 'none',
          outlineWidth: 0,
        } as object,
        default: {},
      }),
    },
    clearButton: {
      position: 'absolute',
      right: Spacing.sm,
      top: 0,
      bottom: 0,
      width: 36,
      alignItems: 'center',
      justifyContent: 'center',
    },
    collapseButton: {
      position: 'absolute',
      right: Spacing.md,
      bottom: Spacing.md + 44 + Spacing.sm,
      height: 44,
      paddingHorizontal: 14,
      borderRadius: 22,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.borderLight,
      shadowColor: colors.shadow,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.12,
      shadowRadius: 10,
      elevation: 5,
    },
    collapseButtonPressed: {
      opacity: 0.88,
    },
    collapseButtonText: {
      fontSize: FontSize.caption,
      fontWeight: '700',
      color: colors.primary,
    },
    results: {
      maxHeight: 220,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.borderLight,
      backgroundColor: colors.surface,
      overflow: 'hidden',
      shadowColor: colors.shadow,
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.1,
      shadowRadius: 14,
      elevation: 6,
    },
    resultItem: {
      paddingHorizontal: Spacing.md,
      paddingVertical: Spacing.sm,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.borderLight,
      gap: 2,
    },
    resultItemPressed: {
      backgroundColor: colors.surfaceMuted,
    },
    resultTitle: {
      fontSize: FontSize.input,
      fontWeight: '600',
      color: colors.text,
    },
    resultMeta: {
      fontSize: FontSize.caption,
      color: colors.textMuted,
    },
    emptyState: {
      paddingHorizontal: Spacing.md,
      paddingVertical: Spacing.md,
      fontSize: FontSize.caption,
      color: colors.textMuted,
      textAlign: 'center',
    },
    deniedBanner: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.sm,
      paddingHorizontal: Spacing.md,
      paddingVertical: Spacing.sm,
      borderRadius: Radius.pill,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.borderLight,
    },
    deniedText: {
      flex: 1,
      fontSize: FontSize.caption,
      color: colors.textMuted,
      lineHeight: FontSize.caption * 1.4,
    },
    locateButton: {
      position: 'absolute',
      right: Spacing.md,
      bottom: Spacing.md,
      width: 44,
      height: 44,
      borderRadius: 22,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.borderLight,
      shadowColor: colors.shadow,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.12,
      shadowRadius: 10,
      elevation: 5,
    },
    locateButtonPressed: {
      opacity: 0.88,
    },
  });
}

export const MapSearchControls = forwardRef<MapSearchControlsHandle, Props>(
  function MapSearchControls(
    {
      onSelectCity,
      onLocateMe,
      onLocationDenied,
      onRetryLocation,
      locationDenied,
      onCollapseMap,
      collapseLabel = 'Свернуть',
      collapseIcon = 'albums-outline',
    },
    ref,
  ) {
  const colors = useTheme();
  const styles = useThemedStyles(createStyles);
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [results, setResults] = useState<CityReferenceItem[]>([]);
  const [settled, setSettled] = useState(false);
  const [picking, setPicking] = useState(false);
  const requestIdRef = useRef(0);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef = useRef<TextInput>(null);

  const focusSearch = () => {
    setOpen(true);
    requestAnimationFrame(() => {
      inputRef.current?.focus();
    });
  };

  useImperativeHandle(ref, () => ({
    focusSearch,
  }));

  useEffect(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    const q = query.trim();
    if (!q) {
      setResults([]);
      setSettled(false);
      return;
    }

    if (!open) {
      return;
    }

    setSettled(false);
    debounceRef.current = setTimeout(() => {
      const requestId = ++requestIdRef.current;
      void fetchCities({ q, country: 'RU,BY', limit: 24 })
        .then((items) => {
          if (requestId !== requestIdRef.current) {
            return;
          }
          setResults(items);
        })
        .catch(() => {
          if (requestId !== requestIdRef.current) {
            return;
          }
          setResults([]);
        })
        .finally(() => {
          if (requestId === requestIdRef.current) {
            setSettled(true);
          }
        });
    }, SEARCH_DEBOUNCE_MS);

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [query, open]);

  const showResults = open && query.trim().length > 0 && (results.length > 0 || settled);

  const notifyGeolocationFallback = (denied = false) => {
    if (denied) {
      onLocationDenied?.();
    }

    toast.info(GEOLOCATION_MANUAL_FALLBACK_MESSAGE, {
      title: 'Местоположение',
      duration: 4500,
    });
    focusSearch();
  };

  const pickCity = (city: CityReferenceItem) => {
    if (picking) {
      return;
    }
    setPicking(true);
    void geocodeCityLabel(city.label)
      .then((hit) => {
        if (!isValidLatLng(hit.lat, hit.lng)) {
          throw new Error('bad coords');
        }
        onSelectCity(hit, { moveCamera: true });
        setQuery(city.label);
        setOpen(false);
        setResults([]);
        setSettled(false);
      })
      .catch(() => {
        toast.error('Не удалось найти город на карте');
      })
      .finally(() => {
        setPicking(false);
      });
  };

  const handleLocatePress = async () => {
    try {
      const point = await readDeviceLocation({ maximumAge: 0 });
      onLocateMe(point);
    } catch (error) {
      notifyGeolocationFallback(error instanceof GeolocationPermissionError);
    }
  };

  return (
    <View style={styles.overlay} pointerEvents="box-none">
      <View style={styles.searchWrap} pointerEvents="box-none">
        <View style={styles.inputWrap}>
          <View pointerEvents="none" style={styles.searchIcon}>
            <Ionicons name="search-outline" size={18} color={colors.textMuted} />
          </View>
          <TextInput
            ref={inputRef}
            value={query}
            onChangeText={(text) => {
              setQuery(text);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            placeholder="Поиск города"
            placeholderTextColor={colors.textMuted}
            autoCorrect={false}
            autoCapitalize="words"
            style={styles.input}
          />
          {query.length > 0 ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Очистить поиск"
              onPress={() => {
                setQuery('');
                setResults([]);
                setSettled(false);
                setOpen(false);
              }}
              style={styles.clearButton}>
              <Ionicons name="close-circle" size={18} color={colors.textMuted} />
            </Pressable>
          ) : null}
        </View>

        {showResults ? (
          <View style={styles.results}>
            {results.length ? (
              <ScrollView keyboardShouldPersistTaps="handled" nestedScrollEnabled>
                {results.map((item) => (
                  <Pressable
                    key={item.id}
                    disabled={picking}
                    onPress={() => pickCity(item)}
                    style={({ pressed }) => [
                      styles.resultItem,
                      (pressed || picking) && styles.resultItemPressed,
                    ]}>
                    <Text style={styles.resultTitle} numberOfLines={1}>
                      {item.name}
                    </Text>
                    {item.region && item.region !== item.name ? (
                      <Text style={styles.resultMeta} numberOfLines={1}>
                        {item.region}
                      </Text>
                    ) : item.countryCode === 'BY' ? (
                      <Text style={styles.resultMeta} numberOfLines={1}>
                        Беларусь
                      </Text>
                    ) : null}
                  </Pressable>
                ))}
              </ScrollView>
            ) : (
              <Text style={styles.emptyState}>Город не найден</Text>
            )}
          </View>
        ) : null}

        {locationDenied ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Запросить геолокацию снова"
            onPress={() => {
              if (onRetryLocation) {
                onRetryLocation();
                return;
              }
              void handleLocatePress();
            }}
            style={({ pressed }) => [styles.deniedBanner, pressed && { opacity: 0.88 }]}>
            <Ionicons name="location-outline" size={16} color={colors.textMuted} />
            <Text style={styles.deniedText}>Вы запретили доступ к геолокации</Text>
          </Pressable>
        ) : null}
      </View>

      {onCollapseMap ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={collapseLabel}
          onPress={onCollapseMap}
          style={({ pressed }) => [
            styles.collapseButton,
            pressed && styles.collapseButtonPressed,
          ]}>
          <Ionicons name={collapseIcon} size={18} color={colors.primary} />
          <Text style={styles.collapseButtonText}>{collapseLabel}</Text>
        </Pressable>
      ) : null}

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Моё местоположение"
        onPress={() => void handleLocatePress()}
        style={({ pressed }) => [styles.locateButton, pressed && styles.locateButtonPressed]}>
        <Ionicons name="locate-outline" size={22} color={colors.primary} />
      </Pressable>
    </View>
  );
});
