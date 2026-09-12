import { Ionicons } from '@expo/vector-icons';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { Switcher } from '@/components/ui';
import { FontSize, Radius, Sizes, Spacing, type ThemeColors } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useThemedStyles } from '@/hooks/use-themed-styles';
import { fetchCities } from '@/services/reference/referenceApi';
import type { CityReferenceItem } from '@/utils/city-label';

type CountryFilter = 'all' | 'RU' | 'BY';

type CitySearchFieldProps = {
  label: string;
  placeholder: string;
  value: string | null;
  selectedLabel: string;
  onChange: (cityId: string | null, cityLabel: string) => void;
};

const SEARCH_DEBOUNCE_MS = 350;
const RESULTS_HEIGHT = 240;

const COUNTRY_FILTER_OPTIONS = [
  { key: 'all', label: 'Все' },
  { key: 'RU', label: 'Россия' },
  { key: 'BY', label: 'Беларусь' },
] as const;

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    wrapper: {
      gap: Spacing.sm,
      position: 'relative',
      zIndex: 20,
      width: '100%',
      maxWidth: '100%',
    },
    wrapperRaised: {
      zIndex: 100,
    },
    webBackdrop: {
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      zIndex: 1,
    },
    label: {
      fontSize: FontSize.label,
      color: colors.textMuted,
      paddingLeft: Spacing.xs,
      position: 'relative',
      zIndex: 2,
    },
    controlsLayer: {
      position: 'relative',
      zIndex: 2,
      gap: Spacing.md,
      width: '100%',
      maxWidth: '100%',
    },
    inputWrap: {
      position: 'relative',
      zIndex: 2,
      width: '100%',
      maxWidth: '100%',
    },
    input: {
      minHeight: Sizes.controlHeight,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: Radius.pill,
      paddingHorizontal: Spacing.md,
      paddingRight: 44,
      fontSize: FontSize.input,
      color: colors.textSecondary,
      backgroundColor: colors.surface,
      width: '100%',
    },
    inputActions: {
      position: 'absolute',
      right: Spacing.sm,
      top: 0,
      bottom: 0,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 2,
    },
    clearButton: {
      width: 28,
      height: 28,
      alignItems: 'center',
      justifyContent: 'center',
    },
    fieldColumn: {
      width: '100%',
      maxWidth: '100%',
      gap: Spacing.sm,
    },
    selectedValue: {
      width: '100%',
      maxWidth: '100%',
      minHeight: Sizes.controlHeight,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: Radius.pill,
      paddingLeft: Spacing.md,
      paddingRight: 44,
      justifyContent: 'center',
      backgroundColor: colors.surface,
      overflow: 'hidden',
      position: 'relative',
    },
    selectedValuePressed: {
      opacity: 0.88,
    },
    selectedText: {
      fontSize: FontSize.input,
      color: colors.textSecondary,
    },
    selectedEditIcon: {
      position: 'absolute',
      right: Spacing.sm,
      top: 0,
      bottom: 0,
      width: 32,
      alignItems: 'center',
      justifyContent: 'center',
    },
    changeButton: {
      alignSelf: 'flex-start',
      paddingVertical: Spacing.xs,
      paddingHorizontal: Spacing.xs,
    },
    changeButtonText: {
      fontSize: FontSize.caption,
      fontWeight: '600',
      color: colors.primary,
    },
    inputRow: {
      flexDirection: 'column',
      alignItems: 'stretch',
      gap: Spacing.sm,
      width: '100%',
      maxWidth: '100%',
    },
    inputField: {
      width: '100%',
      maxWidth: '100%',
    },
    cancelLink: {
      alignSelf: 'flex-start',
      paddingVertical: Spacing.xs,
      paddingHorizontal: Spacing.xs,
    },
    cancelLinkText: {
      fontSize: FontSize.caption,
      fontWeight: '600',
      color: colors.textMuted,
    },
    results: {
      position: 'absolute',
      top: '100%',
      left: 0,
      right: 0,
      marginTop: Spacing.md,
      height: RESULTS_HEIGHT,
      borderWidth: 1,
      borderColor: colors.borderLight,
      borderRadius: 16,
      backgroundColor: colors.surface,
      overflow: 'hidden',
      zIndex: 30,
      shadowColor: colors.shadow,
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.08,
      shadowRadius: 16,
      elevation: 8,
    },
    resultsHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: Spacing.md,
      paddingVertical: Spacing.sm,
      borderBottomWidth: 1,
      borderBottomColor: colors.borderLight,
      backgroundColor: colors.surfaceMuted,
    },
    resultsHeaderText: {
      fontSize: FontSize.caption,
      fontWeight: '600',
      color: colors.textMuted,
    },
    resultsCloseButton: {
      width: 28,
      height: 28,
      alignItems: 'center',
      justifyContent: 'center',
    },
    resultsList: {
      flex: 1,
    },
    clearSelectionButton: {
      paddingHorizontal: Spacing.md,
      paddingVertical: Spacing.sm,
      borderTopWidth: 1,
      borderTopColor: colors.borderLight,
      backgroundColor: colors.surface,
    },
    clearSelectionText: {
      fontSize: FontSize.caption,
      fontWeight: '600',
      color: colors.textMuted,
      textAlign: 'center',
    },
    sectionHeader: {
      paddingHorizontal: Spacing.md,
      paddingTop: Spacing.sm,
      paddingBottom: Spacing.xs,
      backgroundColor: colors.surfaceMuted,
      borderBottomWidth: 1,
      borderBottomColor: colors.borderLight,
    },
    sectionHeaderText: {
      fontSize: FontSize.caption,
      fontWeight: '700',
      letterSpacing: 0.3,
      textTransform: 'uppercase',
      color: colors.textMuted,
    },
    resultItem: {
      paddingHorizontal: Spacing.md,
      paddingVertical: Spacing.sm,
      borderBottomWidth: 1,
      borderBottomColor: colors.borderLight,
    },
    resultItemPressed: {
      backgroundColor: colors.surfaceMuted,
    },
    resultItemSelected: {
      backgroundColor: colors.surfaceMuted,
      borderLeftWidth: 3,
      borderLeftColor: colors.primary,
    },
    resultRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: Spacing.sm,
    },
    resultLabel: {
      flex: 1,
      fontSize: FontSize.input,
      color: colors.textSecondary,
    },
    resultLabelSelected: {
      color: colors.primary,
      fontWeight: '600',
    },
    resultMeta: {
      marginTop: 2,
      fontSize: FontSize.caption,
      color: colors.textMuted,
    },
    emptyStateWrap: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: Spacing.md,
    },
    emptyState: {
      fontSize: FontSize.caption,
      color: colors.textMuted,
      textAlign: 'center',
    },
    resultsSpacer: {
      height: RESULTS_HEIGHT + Spacing.md + Spacing.sm,
    },
  });
}

function getCityNameFromLabel(label: string): string {
  const trimmed = label.trim();

  if (!trimmed) {
    return '';
  }

  const commaIndex = trimmed.indexOf(',');

  return (commaIndex === -1 ? trimmed : trimmed.slice(0, commaIndex)).trim();
}

function groupCitiesByCountry(results: CityReferenceItem[]) {
  const groups = new Map<string, { countryName: string; items: CityReferenceItem[] }>();

  for (const city of results) {
    const existing = groups.get(city.countryCode);

    if (existing) {
      existing.items.push(city);
      continue;
    }

    groups.set(city.countryCode, {
      countryName: city.countryName,
      items: [city],
    });
  }

  return [...groups.entries()].sort(([left]) => {
    if (left === 'RU') {
      return -1;
    }

    if (left === 'BY') {
      return 1;
    }

    return 0;
  });
}

export function CitySearchField({
  label,
  placeholder,
  value,
  selectedLabel,
  onChange,
}: CitySearchFieldProps) {
  const colors = useTheme();
  const styles = useThemedStyles(createStyles);
  const [query, setQuery] = useState('');
  const [countryFilter, setCountryFilter] = useState<CountryFilter>('all');
  const [isEditing, setIsEditing] = useState(!value);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [results, setResults] = useState<CityReferenceItem[]>([]);
  const [hasFetched, setHasFetched] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const blurTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const resetRafRef = useRef<number | null>(null);
  const requestIdRef = useRef(0);

  const groupedResults = useMemo(() => groupCitiesByCountry(results), [results]);

  const cancelScheduledReset = () => {
    if (resetRafRef.current !== null) {
      cancelAnimationFrame(resetRafRef.current);
      resetRafRef.current = null;
    }
  };

  const scheduleResetSearchState = () => {
    cancelScheduledReset();
    resetRafRef.current = requestAnimationFrame(() => {
      resetRafRef.current = null;
      resetSearchState();
    });
  };

  const beginLoadingResults = () => {
    requestIdRef.current += 1;
    setHasFetched(false);
  };

  const resetSearchState = () => {
    requestIdRef.current += 1;
    setQuery('');
    setResults([]);
    setHasFetched(false);
  };

  const closeDropdown = () => {
    if (blurTimeoutRef.current) {
      clearTimeout(blurTimeoutRef.current);
      blurTimeoutRef.current = null;
    }

    setIsDropdownOpen(false);
  };

  const exitEditingMode = () => {
    const shouldClearCity = Boolean(value) && !query.trim();

    closeDropdown();

    if (shouldClearCity) {
      onChange(null, '');
    } else if (value) {
      setIsEditing(false);
    }

    scheduleResetSearchState();
  };

  useEffect(() => {
    return () => {
      if (blurTimeoutRef.current) {
        clearTimeout(blurTimeoutRef.current);
      }

      cancelScheduledReset();
    };
  }, []);

  useEffect(() => {
    requestIdRef.current += 1;
    setQuery('');
    setResults([]);
    setHasFetched(false);
    setIsDropdownOpen(false);

    if (!value) {
      setIsEditing(true);
      return;
    }

    setIsEditing(false);
  }, [value]);

  useEffect(() => {
    if (!isEditing || !isDropdownOpen) {
      return;
    }

    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    debounceRef.current = setTimeout(() => {
      const requestId = requestIdRef.current + 1;
      requestIdRef.current = requestId;

      fetchCities({
        q: query,
        country: countryFilter === 'all' ? 'RU,BY' : countryFilter,
        limit: query.trim() ? 24 : countryFilter === 'all' ? 16 : 20,
      })
        .then((items) => {
          if (requestIdRef.current !== requestId) {
            return;
          }

          setResults(items);
          setHasFetched(true);
        })
        .catch(() => {
          if (requestIdRef.current !== requestId) {
            return;
          }

          setResults([]);
          setHasFetched(true);
        });
    }, SEARCH_DEBOUNCE_MS);

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [countryFilter, isDropdownOpen, isEditing, query]);

  const handleSelect = (city: CityReferenceItem) => {
    if (blurTimeoutRef.current) {
      clearTimeout(blurTimeoutRef.current);
      blurTimeoutRef.current = null;
    }

    onChange(city.id, city.label);
    resetSearchState();
    setIsEditing(false);
    closeDropdown();
  };

  const handleStartEditing = () => {
    cancelScheduledReset();
    resetSearchState();
    setIsEditing(true);
    setIsDropdownOpen(true);
    setQuery(value ? getCityNameFromLabel(selectedLabel) : '');
    beginLoadingResults();
  };

  const handleClearQuery = () => {
    setQuery('');
    beginLoadingResults();
  };

  const handleClearSelection = () => {
    if (blurTimeoutRef.current) {
      clearTimeout(blurTimeoutRef.current);
      blurTimeoutRef.current = null;
    }

    onChange(null, '');
    resetSearchState();
    setIsEditing(true);
    closeDropdown();
  };

  const handleCountryFilterChange = (nextValue: string) => {
    if (blurTimeoutRef.current) {
      clearTimeout(blurTimeoutRef.current);
      blurTimeoutRef.current = null;
    }

    cancelScheduledReset();
    setCountryFilter(nextValue as CountryFilter);
    setIsEditing(true);
    setIsDropdownOpen(true);
    setResults([]);
    beginLoadingResults();
  };

  const handleInputFocus = () => {
    if (blurTimeoutRef.current) {
      clearTimeout(blurTimeoutRef.current);
      blurTimeoutRef.current = null;
    }

    cancelScheduledReset();
    setIsDropdownOpen(true);

    if (results.length === 0) {
      beginLoadingResults();
    }
  };

  const preventInputBlur = () => {
    if (blurTimeoutRef.current) {
      clearTimeout(blurTimeoutRef.current);
      blurTimeoutRef.current = null;
    }
  };

  const handleSwitcherMouseDown =
    Platform.OS === 'web'
      ? (event: { preventDefault: () => void }) => {
          event.preventDefault();
          preventInputBlur();
        }
      : undefined;

  const handleInputBlur = () => {
    blurTimeoutRef.current = setTimeout(() => {
      exitEditingMode();
    }, 150);
  };

  const showResults = isEditing && isDropdownOpen;
  const showEmptyState = hasFetched && groupedResults.length === 0 && query.trim().length > 0;

  return (
    <View style={[styles.wrapper, showResults ? styles.wrapperRaised : null]}>
      {showResults && Platform.OS === 'web' ? (
        <Pressable
          style={styles.webBackdrop}
          onPress={exitEditingMode}
          accessibilityRole="button"
          accessibilityLabel="Закрыть список"
        />
      ) : null}

      {label ? <Text style={styles.label}>{label}</Text> : null}

      <View style={styles.controlsLayer}>
        <View onMouseDown={showResults ? handleSwitcherMouseDown : undefined}>
          <Switcher
            options={[...COUNTRY_FILTER_OPTIONS]}
            value={countryFilter}
            onChange={handleCountryFilterChange}
            disabled={!showResults}
            size="compact"
            stretch
          />
        </View>

        <View style={styles.inputWrap}>
        {isEditing ? (
          <View style={styles.inputRow}>
            <View style={[styles.inputWrap, styles.inputField]}>
              <TextInput
                value={query}
                onChangeText={setQuery}
                onFocus={handleInputFocus}
                onBlur={handleInputBlur}
                placeholder={placeholder}
                placeholderTextColor={colors.textMuted}
                style={styles.input}
                autoCapitalize="words"
                autoCorrect={false}
              />
              <View style={styles.inputActions}>
                {query.length > 0 ? (
                  <Pressable
                    onPress={handleClearQuery}
                    style={styles.clearButton}
                    hitSlop={8}
                    accessibilityRole="button"
                    accessibilityLabel="Очистить поиск">
                    <Ionicons name="close-circle" size={20} color={colors.textMuted} />
                  </Pressable>
                ) : null}
              </View>
            </View>
            {value ? (
              <Pressable
                onPress={exitEditingMode}
                style={styles.cancelLink}
                accessibilityRole="button"
                accessibilityLabel="Отмена">
                <Text style={styles.cancelLinkText}>Отмена</Text>
              </Pressable>
            ) : null}
          </View>
        ) : (
          <View style={styles.fieldColumn}>
            <Pressable
              onPress={handleStartEditing}
              style={({ pressed }) => [
                styles.selectedValue,
                pressed && styles.selectedValuePressed,
              ]}
              accessibilityRole="button"
              accessibilityLabel={`Город ${selectedLabel}. Изменить`}>
              <Text style={styles.selectedText} numberOfLines={2}>
                {selectedLabel}
              </Text>
              <View style={styles.selectedEditIcon} pointerEvents="none">
                <Ionicons name="create-outline" size={18} color={colors.primary} />
              </View>
            </Pressable>
            <Pressable
              onPress={handleStartEditing}
              style={styles.changeButton}
              accessibilityRole="button"
              accessibilityLabel="Изменить город">
              <Text style={styles.changeButtonText}>Изменить</Text>
            </Pressable>
          </View>
        )}

        {showResults ? (
          <View style={styles.results}>
            <View style={styles.resultsHeader}>
              <Text style={styles.resultsHeaderText}>Выберите город</Text>
              <Pressable
                onPress={exitEditingMode}
                style={styles.resultsCloseButton}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel="Закрыть список">
                <Ionicons name="close" size={18} color={colors.textMuted} />
              </Pressable>
            </View>

            <View style={styles.resultsList}>
              {groupedResults.length > 0 ? (
                <ScrollView keyboardShouldPersistTaps="handled" nestedScrollEnabled>
                  {groupedResults.map(([countryCode, group]) => (
                    <View key={countryCode}>
                      {countryFilter === 'all' ? (
                        <View style={styles.sectionHeader}>
                          <Text style={styles.sectionHeaderText}>{group.countryName}</Text>
                        </View>
                      ) : null}

                      {group.items.map((city) => {
                        const isSelected = city.id === value;

                        return (
                          <Pressable
                            key={city.id}
                            onPress={() => handleSelect(city)}
                            style={({ pressed }) => [
                              styles.resultItem,
                              isSelected ? styles.resultItemSelected : null,
                              pressed ? styles.resultItemPressed : null,
                            ]}>
                            <View style={styles.resultRow}>
                              <View style={{ flex: 1 }}>
                                <Text
                                  style={[
                                    styles.resultLabel,
                                    isSelected ? styles.resultLabelSelected : null,
                                  ]}>
                                  {city.name}
                                </Text>
                                {city.region ? (
                                  <Text style={styles.resultMeta}>{city.region}</Text>
                                ) : null}
                              </View>
                              {isSelected ? (
                                <Ionicons name="checkmark-circle" size={20} color={colors.primary} />
                              ) : null}
                            </View>
                          </Pressable>
                        );
                      })}
                    </View>
                  ))}
                </ScrollView>
              ) : showEmptyState ? (
                <View style={styles.emptyStateWrap}>
                  <Text style={styles.emptyState}>Город не найден</Text>
                </View>
              ) : (
                <View style={styles.emptyStateWrap}>
                  <Text style={styles.emptyState}>Начните вводить название</Text>
                </View>
              )}
            </View>

            {value ? (
              <Pressable
                onPress={handleClearSelection}
                style={styles.clearSelectionButton}
                accessibilityRole="button"
                accessibilityLabel="Убрать город">
                <Text style={styles.clearSelectionText}>Убрать город</Text>
              </Pressable>
            ) : null}
          </View>
        ) : null}
        </View>

        {showResults ? <View style={styles.resultsSpacer} pointerEvents="none" /> : null}
      </View>
    </View>
  );
}
