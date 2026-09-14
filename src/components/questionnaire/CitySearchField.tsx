import { Ionicons } from '@expo/vector-icons';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type ViewStyle,
} from 'react-native';

import { FontSize, Radius, Sizes, Spacing, type ThemeColors } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useThemedStyles } from '@/hooks/use-themed-styles';
import { fetchCities } from '@/services/reference/referenceApi';
import type { CityReferenceItem } from '@/utils/city-label';

type CitySelection = {
  id: string;
  label: string;
};

type CitySearchFieldBaseProps = {
  label: string;
  placeholder: string;
};

type CitySearchFieldSingleProps = CitySearchFieldBaseProps & {
  multiple?: false;
  value: string | null;
  selectedLabel: string;
  onChange: (cityId: string | null, cityLabel: string) => void;
};

type CitySearchFieldMultipleProps = CitySearchFieldBaseProps & {
  multiple: true;
  values: CitySelection[];
  onChange: (cities: CitySelection[]) => void;
  maxSelections?: number;
  limitHint?: string;
  addLabel?: string;
};

type CitySearchFieldProps = CitySearchFieldSingleProps | CitySearchFieldMultipleProps;

type DropdownAnchor = {
  top: number;
  left: number;
  width: number;
};

const SEARCH_DEBOUNCE_MS = 350;
const DEFAULT_CITIES_LIMIT = 24;
const SEARCH_CITIES_LIMIT = 24;
const RESULTS_HEIGHT = 240;
const RESULTS_HEADER_HEIGHT = 45;
const RESULTS_CLEAR_FOOTER_HEIGHT = 29;
const DEFAULT_MAX_SELECTIONS = 3;
const WEB_DROPDOWN_Z_INDEX = 10050;
const CITIES_COUNTRY = 'RU,BY';

const WEB_OVERFLOW_SCROLL_STYLE = {
  overflowY: 'scroll',
  overflowX: 'hidden',
  overscrollBehavior: 'contain',
  WebkitOverflowScrolling: 'touch',
  touchAction: 'pan-y',
} as const;

function getWebElement(ref: { current: View | null }): HTMLElement | null {
  const node = ref.current as unknown;
  if (node && typeof node === 'object' && 'getBoundingClientRect' in node) {
    return node as HTMLElement;
  }
  return null;
}

function renderWebPortal(node: ReactNode) {
  if (Platform.OS !== 'web' || typeof document === 'undefined') {
    return null;
  }

  // Нельзя ставить top-level import react-dom — ломает native bundle.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const reactDom = require('react-dom') as {
    createPortal: (child: ReactNode, container: Element) => ReactNode;
  };
  return reactDom.createPortal(node, document.body);
}

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
    webPortalResults: {
      position: 'fixed',
      zIndex: WEB_DROPDOWN_Z_INDEX,
      height: RESULTS_HEIGHT,
      borderWidth: 1,
      borderColor: colors.borderLight,
      borderRadius: 16,
      backgroundColor: colors.surface,
      overflow: 'hidden',
      shadowColor: colors.shadow,
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.18,
      shadowRadius: 24,
      elevation: 12,
      opacity: 0,
      transform: [{ translateY: -8 }],
      ...(Platform.OS === 'web'
        ? ({
            transitionProperty: 'opacity, transform',
            transitionDuration: '180ms',
            transitionTimingFunction: 'ease-out',
          } as object)
        : null),
    },
    webPortalResultsVisible: {
      opacity: 1,
      transform: [{ translateY: 0 }],
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
      opacity: 0,
      transform: [{ translateY: -8 }],
      ...(Platform.OS === 'web'
        ? ({
            transitionProperty: 'opacity, transform',
            transitionDuration: '180ms',
            transitionTimingFunction: 'ease-out',
          } as object)
        : null),
    },
    resultsVisible: {
      opacity: 1,
      transform: [{ translateY: 0 }],
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
    addButton: {
      alignSelf: 'flex-start',
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      minHeight: 32,
      paddingVertical: Spacing.xs,
      paddingHorizontal: Spacing.sm,
      borderRadius: Radius.pill,
      backgroundColor: 'rgba(21, 122, 254, 0.12)',
      borderWidth: 1,
      borderColor: 'rgba(21, 122, 254, 0.28)',
    },
    addButtonPressed: {
      opacity: 0.88,
    },
    addButtonText: {
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
      minHeight: 0,
      minWidth: 0,
    },
    resultsScroll: {
      flexGrow: 0,
      flexShrink: 0,
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
    chipsRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: Spacing.sm,
      width: '100%',
    },
    chip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      maxWidth: '100%',
      minHeight: 32,
      paddingLeft: Spacing.sm,
      paddingRight: 6,
      paddingVertical: 4,
      borderRadius: Radius.pill,
      backgroundColor: 'rgba(21, 122, 254, 0.12)',
      borderWidth: 1,
      borderColor: 'rgba(21, 122, 254, 0.28)',
    },
    chipLabel: {
      flexShrink: 1,
      fontSize: FontSize.caption,
      fontWeight: '600',
      color: colors.primary,
    },
    chipRemove: {
      width: 22,
      height: 22,
      borderRadius: 11,
      alignItems: 'center',
      justifyContent: 'center',
    },
    limitHint: {
      fontSize: FontSize.caption,
      color: colors.textMuted,
      lineHeight: FontSize.caption * 1.4,
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

export function CitySearchField(props: CitySearchFieldProps) {
  const { label, placeholder } = props;
  const isMultiple = props.multiple === true;
  const selectedCities: CitySelection[] = isMultiple
    ? props.values
    : props.value
      ? [{ id: props.value, label: props.selectedLabel }]
      : [];
  const maxSelections = isMultiple
    ? (props.maxSelections ?? DEFAULT_MAX_SELECTIONS)
    : 1;
  const canAddMore = selectedCities.length < maxSelections;
  const selectedIds = useMemo(
    () => new Set(selectedCities.map((city) => city.id)),
    [selectedCities],
  );

  const colors = useTheme();
  const styles = useThemedStyles(createStyles);
  const [query, setQuery] = useState('');
  const [isEditing, setIsEditing] = useState(selectedCities.length === 0);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [results, setResults] = useState<CityReferenceItem[]>([]);
  const [hasFetched, setHasFetched] = useState(false);
  const [dropdownVisible, setDropdownVisible] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const blurTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const resetRafRef = useRef<number | null>(null);
  const requestIdRef = useRef(0);
  const isResultsPointerDownRef = useRef(false);
  const defaultCitiesRef = useRef<CityReferenceItem[]>([]);
  const anchorRef = useRef<View>(null);
  const rootRef = useRef<View>(null);
  const resultsPortalRef = useRef<View>(null);
  const [webAnchor, setWebAnchor] = useState<DropdownAnchor | null>(null);

  const groupedResults = useMemo(() => groupCitiesByCountry(results), [results]);
  const singleValue = !isMultiple ? props.value : null;
  const singleLabel = !isMultiple ? props.selectedLabel : '';

  const cancelScheduledReset = () => {
    if (resetRafRef.current !== null) {
      cancelAnimationFrame(resetRafRef.current);
      resetRafRef.current = null;
    }
  };

  const resetSearchState = () => {
    requestIdRef.current += 1;
    setQuery('');
    const cached = defaultCitiesRef.current;
    setResults(cached);
    setHasFetched(cached.length > 0);
  };

  const scheduleResetSearchState = () => {
    cancelScheduledReset();
    resetRafRef.current = requestAnimationFrame(() => {
      resetRafRef.current = null;
      resetSearchState();
    });
  };

  const restoreDefaultResults = () => {
    const cached = defaultCitiesRef.current;
    setQuery('');
    if (cached.length > 0) {
      setResults(cached);
      setHasFetched(true);
      return;
    }

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
    closeDropdown();

    if (!isMultiple) {
      const shouldClearCity = Boolean(singleValue) && !query.trim();
      if (shouldClearCity) {
        props.onChange(null, '');
      } else if (singleValue) {
        setIsEditing(false);
      }
    } else if (selectedCities.length > 0) {
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
    let cancelled = false;

    fetchCities({
      country: CITIES_COUNTRY,
      limit: DEFAULT_CITIES_LIMIT,
    })
      .then((items) => {
        if (cancelled) {
          return;
        }

        defaultCitiesRef.current = items;
      })
      .catch(() => {
        // Кэш останется пустым — подгрузим при открытии списка.
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (isMultiple) {
      if (selectedCities.length === 0) {
        setIsEditing(true);
      }
      return;
    }

    requestIdRef.current += 1;
    setQuery('');
    const cached = defaultCitiesRef.current;
    setResults(cached);
    setHasFetched(cached.length > 0);
    setIsDropdownOpen(false);

    if (!singleValue) {
      setIsEditing(true);
      return;
    }

    setIsEditing(false);
  }, [isMultiple, selectedCities.length, singleValue]);

  useEffect(() => {
    if (!isEditing || !isDropdownOpen || (isMultiple && !canAddMore)) {
      return;
    }

    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    const trimmedQuery = query.trim();
    const delay = trimmedQuery ? SEARCH_DEBOUNCE_MS : 0;

    debounceRef.current = setTimeout(() => {
      const requestId = requestIdRef.current + 1;
      requestIdRef.current = requestId;

      fetchCities({
        q: query,
        country: CITIES_COUNTRY,
        limit: trimmedQuery ? SEARCH_CITIES_LIMIT : DEFAULT_CITIES_LIMIT,
      })
        .then((items) => {
          if (requestIdRef.current !== requestId) {
            return;
          }

          if (!trimmedQuery) {
            defaultCitiesRef.current = items;
          }

          setResults(items);
          setHasFetched(true);
        })
        .catch(() => {
          if (requestIdRef.current !== requestId) {
            return;
          }

          if (!trimmedQuery && defaultCitiesRef.current.length > 0) {
            setResults(defaultCitiesRef.current);
            setHasFetched(true);
            return;
          }

          setResults([]);
          setHasFetched(true);
        });
    }, delay);

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [canAddMore, isDropdownOpen, isEditing, isMultiple, query]);

  const handleSelect = (city: CityReferenceItem) => {
    if (blurTimeoutRef.current) {
      clearTimeout(blurTimeoutRef.current);
      blurTimeoutRef.current = null;
    }

    if (isMultiple) {
      if (selectedIds.has(city.id) || !canAddMore) {
        return;
      }

      props.onChange([...selectedCities, { id: city.id, label: city.label }]);
      resetSearchState();
      closeDropdown();
      setIsEditing(false);
      return;
    }

    props.onChange(city.id, city.label);
    resetSearchState();
    setIsEditing(false);
    closeDropdown();
  };

  const handleRemoveCity = (cityId: string) => {
    if (!isMultiple) {
      return;
    }

    props.onChange(selectedCities.filter((city) => city.id !== cityId));
  };

  const handleStartEditing = () => {
    cancelScheduledReset();
    restoreDefaultResults();
    setIsEditing(true);
    setIsDropdownOpen(true);
    if (!isMultiple && singleValue) {
      setQuery(getCityNameFromLabel(singleLabel));
    }
  };

  const handleClearQuery = () => {
    restoreDefaultResults();
  };

  const handleClearSelection = () => {
    if (blurTimeoutRef.current) {
      clearTimeout(blurTimeoutRef.current);
      blurTimeoutRef.current = null;
    }

    if (isMultiple) {
      props.onChange([]);
    } else {
      props.onChange(null, '');
    }

    resetSearchState();
    setIsEditing(true);
    closeDropdown();
  };

  const handleInputFocus = () => {
    if (blurTimeoutRef.current) {
      clearTimeout(blurTimeoutRef.current);
      blurTimeoutRef.current = null;
    }

    cancelScheduledReset();
    if (results.length === 0 && defaultCitiesRef.current.length > 0) {
      setResults(defaultCitiesRef.current);
      setHasFetched(true);
    }
    setIsDropdownOpen(true);
  };

  const preventInputBlur = () => {
    if (blurTimeoutRef.current) {
      clearTimeout(blurTimeoutRef.current);
      blurTimeoutRef.current = null;
    }
  };

  const handleInputBlur = () => {
    // Safari часто снимает фокус с инпута при скролле/клике по списку —
    // не закрываем дропдаун, пока жест идёт внутри результатов.
    if (isResultsPointerDownRef.current) {
      return;
    }

    blurTimeoutRef.current = setTimeout(() => {
      if (isResultsPointerDownRef.current) {
        return;
      }

      exitEditingMode();
    }, 150);
  };

  const handleResultsPointerDown = () => {
    isResultsPointerDownRef.current = true;
    preventInputBlur();
  };

  const handleResultsPointerUp = () => {
    isResultsPointerDownRef.current = false;
  };

  const handleResultsMouseDown =
    Platform.OS === 'web'
      ? (event: { preventDefault: () => void }) => {
          event.preventDefault();
          handleResultsPointerDown();
        }
      : undefined;

  const handleResultsWheel =
    Platform.OS === 'web'
      ? (event: { stopPropagation: () => void }) => {
          event.stopPropagation();
          preventInputBlur();
        }
      : undefined;

  const showSearchInput = isMultiple ? isEditing && canAddMore : isEditing;
  const showAddButton = isMultiple && !isEditing && canAddMore;
  const showResults = isEditing && isDropdownOpen && (!isMultiple || canAddMore);
  const showEmptyState = hasFetched && groupedResults.length === 0;
  const showClearSelection = !isMultiple && Boolean(singleValue);
  const addLabel = isMultiple ? (props.addLabel ?? 'Добавить') : 'Добавить';
  const resultsScrollHeight =
    RESULTS_HEIGHT -
    RESULTS_HEADER_HEIGHT -
    (showClearSelection ? RESULTS_CLEAR_FOOTER_HEIGHT : 0);
  const useWebPortal = Platform.OS === 'web';

  useEffect(() => {
    if (!showResults) {
      setDropdownVisible(false);
      return;
    }

    const frame = requestAnimationFrame(() => {
      setDropdownVisible(true);
    });

    return () => {
      cancelAnimationFrame(frame);
    };
  }, [showResults]);

  useEffect(() => {
    if (!useWebPortal || !showResults) {
      setWebAnchor(null);
      return;
    }

    const syncAnchor = () => {
      const node = getWebElement(anchorRef);
      if (!node) {
        return;
      }

      const rect = node.getBoundingClientRect();
      const gap = Spacing.md;
      const spaceBelow = window.innerHeight - rect.bottom - gap;
      const openUpward = spaceBelow < RESULTS_HEIGHT && rect.top > RESULTS_HEIGHT + gap;

      setWebAnchor({
        top: openUpward
          ? Math.max(gap, rect.top - RESULTS_HEIGHT - gap)
          : rect.bottom + gap,
        left: rect.left,
        width: rect.width,
      });
    };

    syncAnchor();
    window.addEventListener('resize', syncAnchor);
    window.addEventListener('scroll', syncAnchor, true);

    return () => {
      window.removeEventListener('resize', syncAnchor);
      window.removeEventListener('scroll', syncAnchor, true);
    };
  }, [useWebPortal, showResults, query, canAddMore]);

  useEffect(() => {
    if (!useWebPortal || !showResults) {
      return;
    }

    const handleOutsidePointerDown = (event: MouseEvent) => {
      const target = event.target as Node | null;
      if (!target) {
        return;
      }

      const root = getWebElement(rootRef);
      const results = getWebElement(resultsPortalRef);
      if (root?.contains(target) || results?.contains(target)) {
        return;
      }

      exitEditingMode();
    };

    document.addEventListener('mousedown', handleOutsidePointerDown);
    return () => {
      document.removeEventListener('mousedown', handleOutsidePointerDown);
    };
  }, [useWebPortal, showResults]);

  const renderCityGroups = () =>
    groupedResults.map(([countryCode, group]) => (
      <View key={countryCode}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionHeaderText}>{group.countryName}</Text>
        </View>

        {group.items.map((city) => {
          const isSelected = selectedIds.has(city.id);
          const isDisabled = isMultiple && !isSelected && !canAddMore;

          return (
            <Pressable
              key={city.id}
              disabled={isDisabled}
              onPress={() => handleSelect(city)}
              style={({ pressed }) => [
                styles.resultItem,
                isSelected ? styles.resultItemSelected : null,
                pressed && !isDisabled ? styles.resultItemPressed : null,
                isDisabled ? { opacity: 0.45 } : null,
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
    ));

  const renderResultsBody = () => (
    <>
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

      <View style={[styles.resultsList, { height: resultsScrollHeight }]}>
        {groupedResults.length > 0 ? (
          useWebPortal ? (
            <View
              style={[
                styles.resultsScroll,
                { height: resultsScrollHeight },
                WEB_OVERFLOW_SCROLL_STYLE as ViewStyle,
              ]}
              {...({ onWheel: handleResultsWheel } as object)}>
              {renderCityGroups()}
            </View>
          ) : (
            <ScrollView
              style={[styles.resultsScroll, { height: resultsScrollHeight }]}
              keyboardShouldPersistTaps="handled"
              nestedScrollEnabled
              bounces={false}
              overScrollMode="never"
              showsVerticalScrollIndicator>
              {renderCityGroups()}
            </ScrollView>
          )
        ) : showEmptyState ? (
          <View style={styles.emptyStateWrap}>
            <Text style={styles.emptyState}>
              {query.trim() ? 'Город не найден' : 'Города не загрузились'}
            </Text>
          </View>
        ) : (
          <View style={styles.emptyStateWrap}>
            <Text style={styles.emptyState}>Загрузка городов…</Text>
          </View>
        )}
      </View>

      {showClearSelection ? (
        <Pressable
          onPress={handleClearSelection}
          style={styles.clearSelectionButton}
          accessibilityRole="button"
          accessibilityLabel="Убрать город">
          <Text style={styles.clearSelectionText}>Убрать город</Text>
        </Pressable>
      ) : null}
    </>
  );

  const resultsInteractionProps = {
    onTouchStart: handleResultsPointerDown,
    onTouchEnd: handleResultsPointerUp,
    onTouchCancel: handleResultsPointerUp,
    ...(handleResultsMouseDown
      ? ({
          onMouseDown: handleResultsMouseDown,
          onMouseUp: handleResultsPointerUp,
          onMouseLeave: handleResultsPointerUp,
        } as object)
      : null),
  };

  const webPortal =
    useWebPortal && showResults && webAnchor
      ? renderWebPortal(
          <View
            ref={resultsPortalRef}
            collapsable={false}
            style={[
              styles.webPortalResults,
              dropdownVisible ? styles.webPortalResultsVisible : null,
              {
                top: webAnchor.top,
                left: webAnchor.left,
                width: webAnchor.width,
              },
            ]}
            {...resultsInteractionProps}>
            {renderResultsBody()}
          </View>,
        )
      : null;

  return (
    <View
      ref={rootRef}
      collapsable={false}
      style={[styles.wrapper, showResults ? styles.wrapperRaised : null]}>
      {label ? <Text style={styles.label}>{label}</Text> : null}

      <View style={styles.controlsLayer}>
        {isMultiple && selectedCities.length > 0 ? (
          <View style={styles.chipsRow}>
            {selectedCities.map((city) => (
              <View key={city.id} style={styles.chip}>
                <Text style={styles.chipLabel} numberOfLines={1}>
                  {city.label}
                </Text>
                <Pressable
                  onPress={() => handleRemoveCity(city.id)}
                  style={styles.chipRemove}
                  hitSlop={6}
                  accessibilityRole="button"
                  accessibilityLabel={`Убрать ${city.label}`}>
                  <Ionicons name="close" size={14} color={colors.primary} />
                </Pressable>
              </View>
            ))}
          </View>
        ) : null}

        {isMultiple ? (
          <Text style={styles.limitHint}>
            {props.limitHint ??
              `Выбрано ${selectedCities.length} из ${maxSelections}`}
          </Text>
        ) : null}

        <View ref={anchorRef} collapsable={false} style={styles.inputWrap}>
          {showSearchInput ? (
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
              {(!isMultiple && singleValue) || (isMultiple && selectedCities.length > 0) ? (
                <Pressable
                  onPress={exitEditingMode}
                  style={styles.cancelLink}
                  accessibilityRole="button"
                  accessibilityLabel="Отмена">
                  <Text style={styles.cancelLinkText}>Отмена</Text>
                </Pressable>
              ) : null}
            </View>
          ) : showAddButton ? (
            <Pressable
              onPress={handleStartEditing}
              style={({ pressed }) => [
                styles.addButton,
                pressed ? styles.addButtonPressed : null,
              ]}
              accessibilityRole="button"
              accessibilityLabel={addLabel}>
              <Ionicons name="add" size={16} color={colors.primary} />
              <Text style={styles.addButtonText}>{addLabel}</Text>
            </Pressable>
          ) : !isMultiple ? (
            <View style={styles.fieldColumn}>
              <Pressable
                onPress={handleStartEditing}
                style={({ pressed }) => [
                  styles.selectedValue,
                  pressed && styles.selectedValuePressed,
                ]}
                accessibilityRole="button"
                accessibilityLabel={`Город ${singleLabel}. Изменить`}>
                <Text style={styles.selectedText} numberOfLines={2}>
                  {singleLabel}
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
          ) : null}

          {showResults && !useWebPortal ? (
            <View
              style={[styles.results, dropdownVisible ? styles.resultsVisible : null]}
              {...resultsInteractionProps}>
              {renderResultsBody()}
            </View>
          ) : null}
        </View>

        {showResults && !useWebPortal ? (
          <View style={styles.resultsSpacer} pointerEvents="none" />
        ) : null}
      </View>

      {webPortal}
    </View>
  );
}
