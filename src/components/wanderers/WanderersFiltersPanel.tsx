import { Ionicons } from '@expo/vector-icons';
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native';

import { AvailabilityPicker } from '@/components/questionnaire/AvailabilityPicker';
import {
  GameSystemsPicker,
  type GameSystemOption,
} from '@/components/questionnaire/GameSystemsPicker';
import { Switcher, type SwitcherOption } from '@/components/ui';
import { FontSize, Radius, Spacing, type ThemeColors } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useThemedStyles } from '@/hooks/use-themed-styles';
import {
  EMPTY_QUESTIONNAIRE_AVAILABILITY,
  stripAvailabilityTimes,
} from '@/screens/questionnaire/availability';
import { fetchGameSystems } from '@/services/reference/referenceApi';
import type { WandererBucket } from '@/services/profile/wanderersApi';
import {
  countActiveWanderersFilters,
  formatWanderersAgeFilter,
  formatWanderersAvailabilityFilter,
  hasActiveAgeFilter,
  hasActiveAvailability,
  WANDERERS_ANY_SYSTEM,
  WANDERERS_READY_TO_LEARN,
  type WanderersFilterOptions,
  type WanderersFilters,
  type WanderersPlayMode,
} from '@/utils/wanderers-filters';
import {
  QUESTIONNAIRE_AGE_MAX,
  QUESTIONNAIRE_AGE_MIN,
} from '@/screens/questionnaire/questionnaire-validation';

const MODAL_SWITCH_DELAY_MS = 280;
const MOBILE_LAYOUT_MAX_WIDTH = 768;

type WanderersFiltersPanelProps = {
  filters: WanderersFilters;
  options: WanderersFilterOptions;
  expanded: boolean;
  onExpandedChange: (expanded: boolean) => void;
  onChange: (next: WanderersFilters) => void;
  onClear: () => void;
  nicknameQuery: string;
  onNicknameQueryChange: (query: string) => void;
  bucket: WandererBucket;
  bucketOptions: SwitcherOption[];
  onBucketChange: (bucket: WandererBucket) => void;
  bucketDisabled?: boolean;
};

type FilterChipProps = {
  label: string;
  selected: boolean;
  onPress: () => void;
  removable?: boolean;
  icon?: keyof typeof Ionicons.glyphMap;
};

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    root: {
      width: '100%',
      gap: Spacing.sm,
      zIndex: 20,
    },
    toolbar: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: Spacing.sm,
      width: '100%',
    },
    toolbarStacked: {
      gap: Spacing.sm,
      width: '100%',
    },
    switcherRow: {
      width: '100%',
    },
    filtersRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'flex-end',
      gap: Spacing.xs,
      width: '100%',
    },
    toolbarPrimary: {
      flex: 1,
      minWidth: 0,
    },
    toolbarActions: {
      flexDirection: 'row',
      alignItems: 'center',
      flexShrink: 0,
      gap: Spacing.xs,
    },
    toggleButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.xs,
      minHeight: 36,
      paddingHorizontal: Spacing.md,
      borderRadius: Radius.pill,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
    },
    toggleButtonIconOnly: {
      width: 36,
      paddingHorizontal: 0,
      justifyContent: 'center',
    },
    toggleButtonActive: {
      borderColor: colors.primary,
      backgroundColor: colors.surfaceMuted,
    },
    toggleLabel: {
      fontSize: FontSize.caption,
      fontWeight: '600',
      color: colors.text,
    },
    badge: {
      minWidth: 18,
      height: 18,
      paddingHorizontal: 5,
      borderRadius: 999,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.primary,
    },
    badgeText: {
      fontSize: 11,
      fontWeight: '700',
      color: colors.onPrimary,
    },
    clearButton: {
      paddingHorizontal: Spacing.sm,
      paddingVertical: Spacing.xs,
    },
    clearLabel: {
      fontSize: FontSize.caption,
      fontWeight: '600',
      color: colors.primary,
    },
    searchWrap: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.sm,
      width: '100%',
      minHeight: 44,
      paddingHorizontal: Spacing.md,
      borderRadius: Radius.pill,
      borderWidth: 1,
      borderColor: colors.borderLight,
      backgroundColor: colors.surface,
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
    searchClear: {
      padding: 2,
    },
    activeChipsScroll: {
      maxWidth: '100%',
    },
    activeChipsRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.xs,
      paddingVertical: 2,
    },
    modalRoot: {
      flex: 1,
      justifyContent: 'flex-start',
      paddingTop: 120,
      paddingHorizontal: Spacing.lg,
      backgroundColor: 'rgba(15, 18, 24, 0.35)',
    },
    modalCard: {
      width: '100%',
      maxWidth: 720,
      maxHeight: '78%',
      alignSelf: 'center',
      borderRadius: 20,
      borderWidth: 1,
      borderColor: colors.borderLight,
      backgroundColor: colors.surface,
      overflow: 'hidden',
      ...({
        boxShadow: '0 16px 40px rgba(0, 0, 0, 0.18)',
      } as object),
    },
    modalHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: Spacing.md,
      paddingHorizontal: Spacing.lg,
      paddingTop: Spacing.md,
      paddingBottom: Spacing.sm,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.borderLight,
    },
    modalTitle: {
      fontSize: FontSize.button,
      fontWeight: '700',
      color: colors.text,
    },
    modalClose: {
      width: 36,
      height: 36,
      borderRadius: 18,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.surfaceMuted,
    },
    modalScroll: {
      paddingHorizontal: Spacing.lg,
      paddingVertical: Spacing.lg,
      gap: Spacing.lg,
    },
    hint: {
      fontSize: FontSize.caption,
      color: colors.textMuted,
      lineHeight: FontSize.caption * 1.45,
    },
    sectionsPair: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: Spacing.md,
    },
    sectionHalf: {
      flexGrow: 1,
      flexBasis: 240,
      minWidth: 0,
      gap: Spacing.sm,
      padding: Spacing.md,
      borderRadius: 16,
      backgroundColor: colors.surfaceMuted,
      borderWidth: 1,
      borderColor: colors.borderLight,
    },
    section: {
      gap: Spacing.sm,
      padding: Spacing.md,
      borderRadius: 16,
      backgroundColor: colors.surfaceMuted,
      borderWidth: 1,
      borderColor: colors.borderLight,
    },
    sectionHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.xs,
    },
    sectionTitle: {
      fontSize: FontSize.caption,
      fontWeight: '700',
      color: colors.textMuted,
      textTransform: 'uppercase',
      letterSpacing: 0.4,
    },
    chipsRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: Spacing.sm,
    },
    ageRangeRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.sm,
    },
    ageField: {
      flex: 1,
      gap: 4,
      minWidth: 0,
    },
    ageFieldLabel: {
      fontSize: FontSize.caption,
      fontWeight: '600',
      color: colors.textSecondary,
    },
    ageInput: {
      minHeight: 40,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      paddingHorizontal: Spacing.sm,
      fontSize: FontSize.button,
      color: colors.text,
    },
    ageRangeDivider: {
      paddingTop: 18,
      fontSize: FontSize.label,
      color: colors.textMuted,
    },
    chip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      minHeight: 36,
      maxWidth: '100%',
      paddingHorizontal: 12,
      paddingVertical: 7,
      borderRadius: Radius.pill,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
    },
    chipSelected: {
      borderColor: colors.primary,
      backgroundColor: colors.primary,
    },
    chipLabel: {
      flexShrink: 1,
      fontSize: FontSize.caption,
      fontWeight: '600',
      color: colors.textSecondary,
    },
    chipLabelSelected: {
      color: colors.onPrimary,
    },
    emptySection: {
      fontSize: FontSize.caption,
      color: colors.textMuted,
      lineHeight: FontSize.caption * 1.4,
    },
    sectionAction: {
      alignSelf: 'flex-start',
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingVertical: 2,
    },
    sectionActionText: {
      fontSize: FontSize.caption,
      fontWeight: '600',
      color: colors.primary,
    },
    modalFooter: {
      flexDirection: 'row',
      justifyContent: 'flex-end',
      gap: Spacing.sm,
      paddingHorizontal: Spacing.lg,
      paddingVertical: Spacing.md,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.borderLight,
    },
    footerButton: {
      minHeight: 40,
      paddingHorizontal: Spacing.md,
      borderRadius: Radius.pill,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
    },
    footerButtonGhost: {
      borderColor: colors.border,
      backgroundColor: colors.surface,
    },
    footerButtonPrimary: {
      borderColor: colors.primary,
      backgroundColor: colors.primary,
    },
    footerButtonLabel: {
      fontSize: FontSize.caption,
      fontWeight: '700',
    },
    footerButtonLabelGhost: {
      color: colors.text,
    },
    footerButtonLabelPrimary: {
      color: colors.onPrimary,
    },
  });
}

function FilterChip({ label, selected, onPress, removable = false, icon }: FilterChipProps) {
  const colors = useTheme();
  const styles = useThemedStyles(createStyles);
  const iconColor = selected ? colors.onPrimary : colors.textMuted;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.chip,
        selected && styles.chipSelected,
        pressed && { opacity: 0.88 },
      ]}>
      {icon ? <Ionicons name={icon} size={14} color={iconColor} /> : null}
      <Text numberOfLines={1} style={[styles.chipLabel, selected && styles.chipLabelSelected]}>
        {label}
      </Text>
      {removable ? <Ionicons name="close" size={14} color={colors.onPrimary} /> : null}
    </Pressable>
  );
}

function FilterSection({
  title,
  icon,
  children,
  emptyLabel,
  isEmpty = false,
  half = false,
}: {
  title: string;
  icon?: keyof typeof Ionicons.glyphMap;
  children?: ReactNode;
  emptyLabel?: string;
  isEmpty?: boolean;
  half?: boolean;
}) {
  const colors = useTheme();
  const styles = useThemedStyles(createStyles);

  return (
    <View style={half ? styles.sectionHalf : styles.section}>
      <View style={styles.sectionHeader}>
        {icon ? <Ionicons name={icon} size={14} color={colors.textMuted} /> : null}
        <Text style={styles.sectionTitle}>{title}</Text>
      </View>
      {isEmpty ? (
        <Text style={styles.emptySection}>{emptyLabel}</Text>
      ) : (
        <View style={styles.chipsRow}>{children}</View>
      )}
    </View>
  );
}

function roleIcon(role: string): keyof typeof Ionicons.glyphMap {
  return role === 'Мастер' ? 'book-outline' : 'game-controller-outline';
}

function playModeIcon(mode: WanderersPlayMode): keyof typeof Ionicons.glyphMap {
  return mode === 'online' ? 'wifi-outline' : 'people-outline';
}

function systemIcon(system: string): keyof typeof Ionicons.glyphMap {
  if (system === WANDERERS_ANY_SYSTEM) {
    return 'apps-outline';
  }

  if (system === WANDERERS_READY_TO_LEARN) {
    return 'sparkles-outline';
  }

  return 'dice-outline';
}

export function WanderersFiltersPanel({
  filters,
  options,
  expanded,
  onExpandedChange,
  onChange,
  onClear,
  nicknameQuery,
  onNicknameQueryChange,
  bucket,
  bucketOptions,
  onBucketChange,
  bucketDisabled = false,
}: WanderersFiltersPanelProps) {
  const colors = useTheme();
  const styles = useThemedStyles(createStyles);
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const isMobileLayout = Platform.OS !== 'web' || windowWidth < MOBILE_LAYOUT_MAX_WIDTH;
  const activeCount = countActiveWanderersFilters(filters);
  const availabilityLabel = formatWanderersAvailabilityFilter(filters.availability);
  const ageFilterLabel = formatWanderersAgeFilter(filters);
  const officialSystemSet = useMemo(
    () => new Set(options.officialSystems),
    [options.officialSystems],
  );
  const extraSystems = useMemo(
    () =>
      filters.systems.filter(
        (system) =>
          system !== WANDERERS_ANY_SYSTEM &&
          system !== WANDERERS_READY_TO_LEARN &&
          !officialSystemSet.has(system),
      ),
    [filters.systems, officialSystemSet],
  );

  const [isSystemsPickerOpen, setIsSystemsPickerOpen] = useState(false);
  const [systemOptions, setSystemOptions] = useState<GameSystemOption[]>([]);
  const reopenFiltersAfterSystemsRef = useRef(false);
  const switchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (switchTimeoutRef.current) {
        clearTimeout(switchTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    let isMounted = true;

    fetchGameSystems()
      .then((items) => {
        if (!isMounted) {
          return;
        }

        setSystemOptions(
          items.map((item) => ({
            id: item.id,
            name: item.name,
            description: item.description,
            isOfficial: item.isOfficial,
          })),
        );
      })
      .catch(() => {
        if (!isMounted) {
          return;
        }

        setSystemOptions([]);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const openSystemsPicker = useCallback(() => {
    reopenFiltersAfterSystemsRef.current = true;
    onExpandedChange(false);

    if (switchTimeoutRef.current) {
      clearTimeout(switchTimeoutRef.current);
    }

    switchTimeoutRef.current = setTimeout(() => {
      setIsSystemsPickerOpen(true);
    }, MODAL_SWITCH_DELAY_MS);
  }, [onExpandedChange]);

  const closeSystemsPicker = useCallback(() => {
    setIsSystemsPickerOpen(false);

    if (!reopenFiltersAfterSystemsRef.current) {
      return;
    }

    reopenFiltersAfterSystemsRef.current = false;

    if (switchTimeoutRef.current) {
      clearTimeout(switchTimeoutRef.current);
    }

    switchTimeoutRef.current = setTimeout(() => {
      onExpandedChange(true);
    }, MODAL_SWITCH_DELAY_MS);
  }, [onExpandedChange]);

  const toggleRole = (role: string) => {
    const next = filters.roles.includes(role)
      ? filters.roles.filter((item) => item !== role)
      : [...filters.roles, role];
    onChange({ ...filters, roles: next });
  };

  const togglePlayMode = (mode: WanderersPlayMode) => {
    const next = filters.playModes.includes(mode)
      ? filters.playModes.filter((item) => item !== mode)
      : [...filters.playModes, mode];
    onChange({ ...filters, playModes: next });
  };

  const toggleListValue = (key: 'locations' | 'systems' | 'experiences', value: string) => {
    const current = filters[key];
    const next = current.includes(value)
      ? current.filter((item) => item !== value)
      : [...current, value];
    onChange({ ...filters, [key]: next });
  };

  const parseAgeFilterInput = (raw: string): number | null => {
    const digits = raw.replace(/[^\d]/g, '').slice(0, 3);

    if (!digits) {
      return null;
    }

    const parsed = Number.parseInt(digits, 10);

    if (!Number.isFinite(parsed) || parsed < 1) {
      return null;
    }

    return Math.min(QUESTIONNAIRE_AGE_MAX, parsed);
  };

  const setAgeBound = (key: 'ageMin' | 'ageMax', raw: string) => {
    const nextValue = parseAgeFilterInput(raw);
    let ageMin = key === 'ageMin' ? nextValue : filters.ageMin;
    let ageMax = key === 'ageMax' ? nextValue : filters.ageMax;

    if (ageMin != null && ageMax != null && ageMin > ageMax) {
      if (key === 'ageMin') {
        ageMax = ageMin;
      } else {
        ageMin = ageMax;
      }
    }

    onChange({ ...filters, ageMin, ageMax });
  };

  const handleSystemsPickerChange = (selectedNames: string[]) => {
    const specials = filters.systems.filter(
      (system) => system === WANDERERS_ANY_SYSTEM || system === WANDERERS_READY_TO_LEARN,
    );
    onChange({
      ...filters,
      systems: [...specials, ...selectedNames],
    });
  };

  const systemsPickerSelected = filters.systems.filter(
    (system) => system !== WANDERERS_ANY_SYSTEM && system !== WANDERERS_READY_TO_LEARN,
  );

  const filterActions = (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Фильтры"
        accessibilityState={{ expanded }}
        onPress={() => onExpandedChange(!expanded)}
        style={[
          styles.toggleButton,
          isMobileLayout && activeCount === 0 && styles.toggleButtonIconOnly,
          (expanded || activeCount > 0) && styles.toggleButtonActive,
        ]}>
        <Ionicons
          name="options-outline"
          size={16}
          color={activeCount > 0 ? colors.primary : colors.text}
        />
        {!isMobileLayout ? <Text style={styles.toggleLabel}>Фильтры</Text> : null}
        {activeCount > 0 ? (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{activeCount}</Text>
          </View>
        ) : null}
      </Pressable>

      {activeCount > 0 && !isMobileLayout ? (
        <Pressable accessibilityRole="button" onPress={onClear} style={styles.clearButton}>
          <Text style={styles.clearLabel}>Сбросить</Text>
        </Pressable>
      ) : null}
    </>
  );

  return (
    <View style={styles.root}>
      <View style={styles.toolbar}>
        <View style={styles.toolbarPrimary}>
          <Switcher
            stretch={isMobileLayout}
            showLabelOnlyWhenActive={isMobileLayout}
            size="compact"
            options={bucketOptions}
            value={bucket}
            onChange={(key) => onBucketChange(key as WandererBucket)}
            disabled={bucketDisabled}
          />
        </View>
        <View style={styles.toolbarActions}>{filterActions}</View>
      </View>

      <View style={styles.searchWrap}>
        <Ionicons name="search" size={16} color={colors.textMuted} />
        <TextInput
          value={nicknameQuery}
          onChangeText={onNicknameQueryChange}
          placeholder="Поиск по нику"
          placeholderTextColor={colors.textMuted}
          style={styles.searchInput}
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="search"
          clearButtonMode="never"
        />
        {nicknameQuery.length > 0 ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Очистить поиск"
            onPress={() => onNicknameQueryChange('')}
            hitSlop={8}
            style={styles.searchClear}>
            <Ionicons name="close-circle" size={18} color={colors.textMuted} />
          </Pressable>
        ) : null}
      </View>

      {activeCount > 0 && !expanded && !isMobileLayout ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.activeChipsScroll}
          contentContainerStyle={styles.activeChipsRow}>
          {filters.roles.map((role) => (
            <FilterChip
              key={`role-${role}`}
              label={role}
              icon={roleIcon(role)}
              selected
              removable
              onPress={() => toggleRole(role)}
            />
          ))}
          {filters.playModes.map((mode) => (
            <FilterChip
              key={`play-${mode}`}
              label={mode === 'online' ? 'Онлайн' : 'Офлайн'}
              icon={playModeIcon(mode)}
              selected
              removable
              onPress={() => togglePlayMode(mode)}
            />
          ))}
          {filters.locations.map((location) => (
            <FilterChip
              key={`loc-${location}`}
              label={location}
              icon="location-outline"
              selected
              removable
              onPress={() => toggleListValue('locations', location)}
            />
          ))}
          {filters.systems.map((system) => (
            <FilterChip
              key={`sys-${system}`}
              label={system}
              icon={systemIcon(system)}
              selected
              removable
              onPress={() => toggleListValue('systems', system)}
            />
          ))}
          {filters.experiences.map((experience) => (
            <FilterChip
              key={`exp-${experience}`}
              label={experience}
              icon="ribbon-outline"
              selected
              removable
              onPress={() => toggleListValue('experiences', experience)}
            />
          ))}
          {hasActiveAgeFilter(filters) ? (
            <FilterChip
              key="age"
              label={ageFilterLabel || 'Возраст'}
              icon="hourglass-outline"
              selected
              removable
              onPress={() => onChange({ ...filters, ageMin: null, ageMax: null })}
            />
          ) : null}
          {hasActiveAvailability(filters.availability) ? (
            <FilterChip
              key="availability"
              label={availabilityLabel || 'Расписание'}
              icon="calendar-outline"
              selected
              removable
              onPress={() =>
                onChange({
                  ...filters,
                  availability: { ...EMPTY_QUESTIONNAIRE_AVAILABILITY },
                })
              }
            />
          ) : null}
        </ScrollView>
      ) : null}

      <Modal
        visible={expanded}
        transparent
        animationType="fade"
        presentationStyle="overFullScreen"
        onRequestClose={() => onExpandedChange(false)}>
        <View style={[styles.modalRoot, { paddingTop: Math.max(72, windowHeight * 0.08) }]}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => onExpandedChange(false)} />
          <View style={styles.modalCard} collapsable={false}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Фильтры</Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Закрыть фильтры"
                onPress={() => onExpandedChange(false)}
                style={styles.modalClose}>
                <Ionicons name="close" size={18} color={colors.text} />
              </Pressable>
            </View>

            <ScrollView
              contentContainerStyle={styles.modalScroll}
              showsVerticalScrollIndicator
              keyboardShouldPersistTaps="handled">
              <Text style={styles.hint}>
                Фильтры дополняют друг друга: анкета должна подходить по всем выбранным пунктам.
              </Text>

              <View style={styles.sectionsPair}>
                <FilterSection title="Роль" icon="person-outline" half>
                  {options.roles.map((role) => (
                    <FilterChip
                      key={role}
                      label={role}
                      icon={roleIcon(role)}
                      selected={filters.roles.includes(role)}
                      onPress={() => toggleRole(role)}
                    />
                  ))}
                </FilterSection>

                <FilterSection title="Формат" icon="laptop-outline" half>
                  {options.playModes.map((mode) => (
                    <FilterChip
                      key={mode.value}
                      label={mode.label}
                      icon={playModeIcon(mode.value)}
                      selected={filters.playModes.includes(mode.value)}
                      onPress={() => togglePlayMode(mode.value)}
                    />
                  ))}
                </FilterSection>
              </View>

              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <Ionicons name="hourglass-outline" size={14} color={colors.textMuted} />
                  <Text style={styles.sectionTitle}>Возраст</Text>
                </View>
                <View style={styles.ageRangeRow}>
                  <View style={styles.ageField}>
                    <Text style={styles.ageFieldLabel}>От</Text>
                    <TextInput
                      value={filters.ageMin != null ? String(filters.ageMin) : ''}
                      onChangeText={(value) => setAgeBound('ageMin', value)}
                      keyboardType="number-pad"
                      maxLength={3}
                      placeholder={`${QUESTIONNAIRE_AGE_MIN}`}
                      placeholderTextColor={colors.textSubtle}
                      style={styles.ageInput}
                    />
                  </View>
                  <Text style={styles.ageRangeDivider}>—</Text>
                  <View style={styles.ageField}>
                    <Text style={styles.ageFieldLabel}>До</Text>
                    <TextInput
                      value={filters.ageMax != null ? String(filters.ageMax) : ''}
                      onChangeText={(value) => setAgeBound('ageMax', value)}
                      keyboardType="number-pad"
                      maxLength={3}
                      placeholder={`${QUESTIONNAIRE_AGE_MAX}`}
                      placeholderTextColor={colors.textSubtle}
                      style={styles.ageInput}
                    />
                  </View>
                </View>
              </View>

              <FilterSection
                title="Город"
                icon="location-outline"
                isEmpty={options.locations.length === 0}
                emptyLabel="Городов пока нет">
                {options.locations.map((location) => (
                  <FilterChip
                    key={location}
                    label={location}
                    icon="location-outline"
                    selected={filters.locations.includes(location)}
                    onPress={() => toggleListValue('locations', location)}
                  />
                ))}
              </FilterSection>

              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <Ionicons name="dice-outline" size={14} color={colors.textMuted} />
                  <Text style={styles.sectionTitle}>Системы</Text>
                </View>
                <View style={styles.chipsRow}>
                  <FilterChip
                    label={WANDERERS_ANY_SYSTEM}
                    icon={systemIcon(WANDERERS_ANY_SYSTEM)}
                    selected={filters.systems.includes(WANDERERS_ANY_SYSTEM)}
                    onPress={() => toggleListValue('systems', WANDERERS_ANY_SYSTEM)}
                  />
                  <FilterChip
                    label={WANDERERS_READY_TO_LEARN}
                    icon={systemIcon(WANDERERS_READY_TO_LEARN)}
                    selected={filters.systems.includes(WANDERERS_READY_TO_LEARN)}
                    onPress={() => toggleListValue('systems', WANDERERS_READY_TO_LEARN)}
                  />
                  {options.officialSystems.map((system) => (
                    <FilterChip
                      key={system}
                      label={system}
                      icon={systemIcon(system)}
                      selected={filters.systems.includes(system)}
                      onPress={() => toggleListValue('systems', system)}
                    />
                  ))}
                  {extraSystems.map((system) => (
                    <FilterChip
                      key={`extra-${system}`}
                      label={system}
                      icon={systemIcon(system)}
                      selected
                      removable
                      onPress={() => toggleListValue('systems', system)}
                    />
                  ))}
                </View>
                <Pressable
                  accessibilityRole="button"
                  onPress={openSystemsPicker}
                  style={({ pressed }) => [
                    styles.sectionAction,
                    pressed && { opacity: 0.75 },
                  ]}>
                  <Ionicons name="add-circle-outline" size={16} color={colors.primary} />
                  <Text style={styles.sectionActionText}>
                    {extraSystems.length > 0 ? 'Изменить другие' : 'Другие системы'}
                  </Text>
                </Pressable>
              </View>

              <FilterSection
                title="Опыт игры"
                icon="ribbon-outline"
                isEmpty={options.experiences.length === 0}
                emptyLabel="Вариантов пока нет">
                {options.experiences.map((experience) => (
                  <FilterChip
                    key={experience}
                    label={experience}
                    icon="ribbon-outline"
                    selected={filters.experiences.includes(experience)}
                    onPress={() => toggleListValue('experiences', experience)}
                  />
                ))}
              </FilterSection>

              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <Ionicons name="calendar-outline" size={14} color={colors.textMuted} />
                  <Text style={styles.sectionTitle}>Смогу играть</Text>
                </View>
                <AvailabilityPicker
                  value={filters.availability}
                  showTime={false}
                  showDayLabels={false}
                  onChange={(availability) =>
                    onChange({
                      ...filters,
                      availability: stripAvailabilityTimes(availability),
                    })
                  }
                />
              </View>
            </ScrollView>

            <View style={styles.modalFooter}>
              <Pressable
                accessibilityRole="button"
                disabled={activeCount === 0}
                onPress={onClear}
                style={[
                  styles.footerButton,
                  styles.footerButtonGhost,
                  activeCount === 0 && { opacity: 0.4 },
                ]}>
                <Text style={[styles.footerButtonLabel, styles.footerButtonLabelGhost]}>
                  Сбросить
                </Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                onPress={() => onExpandedChange(false)}
                style={[styles.footerButton, styles.footerButtonPrimary]}>
                <Text style={[styles.footerButtonLabel, styles.footerButtonLabelPrimary]}>
                  Готово
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <GameSystemsPicker
        visible={isSystemsPickerOpen}
        options={systemOptions}
        selectedNames={systemsPickerSelected}
        allowCustomSystems={false}
        initialTab="other"
        onChange={handleSystemsPickerChange}
        onClose={closeSystemsPicker}
      />
    </View>
  );
}
