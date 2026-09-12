import { Ionicons } from '@expo/vector-icons';
import { useEffect, useMemo, useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { DateRangePicker } from '@/components/games/DateRangePicker';
import { useIsDesktopWeb } from '@/components/navigation/DesktopThemeToggle';
import { CitySearchField } from '@/components/questionnaire/CitySearchField';
import {
  GameSystemsPicker,
  type GameSystemOption,
} from '@/components/questionnaire/GameSystemsPicker';
import { FontSize, Radius, Spacing, type ThemeColors } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useThemedStyles } from '@/hooks/use-themed-styles';
import { fetchGameSystems } from '@/services/reference/referenceApi';
import type { GameKind } from '@/services/games/gamesApi';
import {
  type GamesAgeFilter,
  type GamesFeedFilters,
  type GamesPlayMode,
  type GamesSchedulePreset,
  clearGamesScheduleFilter,
  countActiveGamesFilters,
  formatGamesScheduleLabel,
} from '@/utils/games-filters';

type GamesFiltersPanelProps = {
  draft: GamesFeedFilters;
  onChange: (next: GamesFeedFilters) => void;
  onApply: () => void;
  onClear: () => void;
  visible: boolean;
  onClose: () => void;
};

function createStyles(colors: ThemeColors, isDesktopWeb: boolean, bottomInset: number) {
  return StyleSheet.create({
    backdrop: {
      flex: 1,
      backgroundColor: 'rgba(15, 18, 24, 0.4)',
      justifyContent: isDesktopWeb ? 'center' : 'flex-end',
      alignItems: isDesktopWeb ? 'center' : 'stretch',
      paddingHorizontal: isDesktopWeb ? Spacing.lg : 0,
      paddingVertical: isDesktopWeb ? Spacing.xl : 0,
    },
    sheet: {
      width: isDesktopWeb ? '100%' : undefined,
      maxWidth: isDesktopWeb ? 560 : undefined,
      maxHeight: isDesktopWeb ? '82%' : '88%',
      flexDirection: 'column',
      borderTopLeftRadius: isDesktopWeb ? 20 : 20,
      borderTopRightRadius: isDesktopWeb ? 20 : 20,
      borderBottomLeftRadius: isDesktopWeb ? 20 : 0,
      borderBottomRightRadius: isDesktopWeb ? 20 : 0,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.borderLight,
      overflow: 'hidden',
      ...(isDesktopWeb
        ? ({
            boxShadow: '0 16px 40px rgba(0, 0, 0, 0.18)',
          } as object)
        : {}),
    },
    header: {
      flexShrink: 0,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: Spacing.lg,
      paddingTop: Spacing.md,
      paddingBottom: Spacing.sm,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.borderLight,
    },
    title: {
      fontSize: FontSize.button,
      fontWeight: '700',
      color: colors.text,
    },
    closeBtn: {
      width: 36,
      height: 36,
      borderRadius: 18,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.surfaceMuted,
    },
    bodyScroll: {
      flexGrow: 1,
      flexShrink: 1,
      minHeight: 0,
    },
    body: {
      paddingHorizontal: Spacing.lg,
      paddingVertical: Spacing.md,
      gap: Spacing.lg,
    },
    section: {
      gap: Spacing.sm,
    },
    sectionLabel: {
      fontSize: FontSize.label,
      fontWeight: '600',
      color: colors.textMuted,
    },
    chipsRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: Spacing.xs,
    },
    chip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      minHeight: 36,
      paddingHorizontal: Spacing.md,
      borderRadius: Radius.pill,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
    },
    chipSelected: {
      borderColor: 'rgba(21, 122, 254, 0.35)',
      backgroundColor: 'rgba(21, 122, 254, 0.12)',
    },
    chipLabel: {
      fontSize: FontSize.caption,
      fontWeight: '600',
      color: colors.text,
    },
    chipLabelSelected: {
      color: colors.primary,
    },
    systemBtn: {
      minHeight: 44,
      borderRadius: Radius.pill,
      borderWidth: 1,
      borderColor: colors.border,
      paddingLeft: Spacing.md,
      paddingRight: 10,
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.sm,
      backgroundColor: colors.surface,
    },
    systemBtnMain: {
      flex: 1,
      minWidth: 0,
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.sm,
      minHeight: 44,
    },
    systemBtnText: {
      flex: 1,
      minWidth: 0,
      fontSize: FontSize.input,
      color: colors.textSecondary,
    },
    systemBtnPlaceholder: {
      color: colors.textMuted,
    },
    dateBtn: {
      alignSelf: 'flex-start',
      minHeight: 36,
      maxWidth: '100%',
      borderRadius: Radius.pill,
      borderWidth: 1,
      borderColor: colors.border,
      paddingLeft: 12,
      paddingRight: 8,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      backgroundColor: colors.surface,
    },
    dateBtnActive: {
      borderColor: 'rgba(21, 122, 254, 0.35)',
      backgroundColor: 'rgba(21, 122, 254, 0.12)',
    },
    dateBtnMain: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      minHeight: 36,
      paddingRight: 2,
      minWidth: 0,
      flexShrink: 1,
    },
    dateBtnText: {
      flexShrink: 1,
      fontSize: FontSize.caption,
      fontWeight: '600',
      color: colors.textMuted,
    },
    dateBtnTextActive: {
      color: colors.primary,
    },
    clearIconBtn: {
      flexShrink: 0,
      padding: 2,
    },
    footer: {
      flexShrink: 0,
      flexDirection: 'row',
      justifyContent: isDesktopWeb ? 'flex-end' : undefined,
      gap: Spacing.sm,
      paddingHorizontal: Spacing.lg,
      paddingTop: Spacing.sm,
      paddingBottom: Math.max(Spacing.lg, bottomInset + Spacing.sm),
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.borderLight,
    },
    footerBtn: {
      ...(isDesktopWeb
        ? {
            minWidth: 132,
            minHeight: 40,
            paddingHorizontal: Spacing.lg,
          }
        : {
            flex: 1,
            minHeight: 48,
          }),
      borderRadius: Radius.pill,
      alignItems: 'center',
      justifyContent: 'center',
    },
    footerClear: {
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
    },
    footerApply: {
      backgroundColor: colors.primary,
    },
    footerClearLabel: {
      fontSize: isDesktopWeb ? FontSize.caption : FontSize.button,
      fontWeight: '600',
      color: colors.text,
    },
    footerApplyLabel: {
      fontSize: isDesktopWeb ? FontSize.caption : FontSize.button,
      fontWeight: '700',
      color: colors.onPrimary,
    },
  });
}

function OptionChip({
  label,
  icon,
  selected,
  onPress,
  styles,
  colors,
}: {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  selected: boolean;
  onPress: () => void;
  styles: ReturnType<typeof createStyles>;
  colors: ThemeColors;
}) {
  const tint = selected ? colors.primary : colors.text;
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
      <Ionicons name={icon} size={14} color={tint} />
      <Text style={[styles.chipLabel, selected && styles.chipLabelSelected]}>{label}</Text>
    </Pressable>
  );
}

export function GamesFiltersPanel({
  draft,
  onChange,
  onApply,
  onClear,
  visible,
  onClose,
}: GamesFiltersPanelProps) {
  const colors = useTheme();
  const isDesktopWeb = useIsDesktopWeb();
  const insets = useSafeAreaInsets();
  const bottomInset = isDesktopWeb ? 0 : insets.bottom;
  const styles = useThemedStyles((theme) => createStyles(theme, isDesktopWeb, bottomInset));
  const [systemOptions, setSystemOptions] = useState<GameSystemOption[]>([]);
  const [systemsOpen, setSystemsOpen] = useState(false);
  const [datesOpen, setDatesOpen] = useState(false);

  useEffect(() => {
    if (!visible) {
      return;
    }
    let cancelled = false;
    void fetchGameSystems()
      .then((items) => {
        if (cancelled) {
          return;
        }
        setSystemOptions(
          items.map((item) => ({
            id: item.id,
            name: item.name,
            description: item.description ?? null,
            isOfficial: true,
          })),
        );
      })
      .catch(() => {
        if (!cancelled) {
          setSystemOptions([]);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [visible]);

  const activeCount = useMemo(() => countActiveGamesFilters(draft), [draft]);

  const patch = (partial: Partial<GamesFeedFilters>) => {
    onChange({ ...draft, ...partial });
  };

  const closeSystemsAndFilters = () => {
    setSystemsOpen(false);
    setDatesOpen(false);
    onClose();
  };

  const dateRangeLabel = formatGamesScheduleLabel(draft);
  const nestedOpen = systemsOpen || datesOpen;

  const setSchedulePreset = (preset: GamesSchedulePreset) => {
    if (draft.schedulePreset === preset) {
      patch(clearGamesScheduleFilter(draft));
      return;
    }
    patch({
      schedulePreset: preset,
      scheduledFrom: null,
      scheduledTo: null,
    });
  };

  const toggleKind = (kind: GameKind) => {
    patch({ kind: draft.kind === kind ? null : kind });
  };

  const togglePlayMode = (mode: GamesPlayMode) => {
    if (draft.playMode === mode) {
      patch({ playMode: null, cityId: null, cityLabel: '' });
      return;
    }
    patch({
      playMode: mode,
      ...(mode === 'online' ? { cityId: null, cityLabel: '' } : {}),
    });
  };

  const toggleFree = (value: boolean) => {
    patch({ isFree: draft.isFree === value ? null : value });
  };

  const toggleAge = (age: GamesAgeFilter) => {
    patch({ age: draft.age === age ? null : age });
  };

  return (
    <>
      <Modal
        visible={visible && !nestedOpen}
        animationType={isDesktopWeb ? 'fade' : 'slide'}
        transparent
        onRequestClose={closeSystemsAndFilters}>
        <View style={styles.backdrop}>
          <Pressable style={StyleSheet.absoluteFill} onPress={closeSystemsAndFilters} />
          <View style={styles.sheet}>
            <View style={styles.header}>
              <Text style={styles.title}>
                Фильтры{activeCount > 0 ? ` · ${activeCount}` : ''}
              </Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Закрыть"
                onPress={closeSystemsAndFilters}
                style={({ pressed }) => [styles.closeBtn, pressed && { opacity: 0.8 }]}>
                <Ionicons name="close" size={18} color={colors.text} />
              </Pressable>
            </View>

            <ScrollView
              style={styles.bodyScroll}
              contentContainerStyle={styles.body}
              keyboardShouldPersistTaps="handled"
              nestedScrollEnabled>
              <View style={styles.section}>
                <Text style={styles.sectionLabel}>Формат</Text>
                <View style={styles.chipsRow}>
                  <OptionChip
                    label="Ваншот"
                    icon="flash-outline"
                    selected={draft.kind === 'ONESHOT'}
                    onPress={() => toggleKind('ONESHOT')}
                    styles={styles}
                    colors={colors}
                  />
                  <OptionChip
                    label="Кампания"
                    icon="library-outline"
                    selected={draft.kind === 'CAMPAIGN'}
                    onPress={() => toggleKind('CAMPAIGN')}
                    styles={styles}
                    colors={colors}
                  />
                </View>
              </View>

              <View style={styles.section}>
                <Text style={styles.sectionLabel}>Где играют</Text>
                <View style={styles.chipsRow}>
                  <OptionChip
                    label="Онлайн"
                    icon="wifi-outline"
                    selected={draft.playMode === 'online'}
                    onPress={() => togglePlayMode('online')}
                    styles={styles}
                    colors={colors}
                  />
                  <OptionChip
                    label="Офлайн"
                    icon="map-outline"
                    selected={draft.playMode === 'offline'}
                    onPress={() => togglePlayMode('offline')}
                    styles={styles}
                    colors={colors}
                  />
                </View>
                {draft.playMode === 'offline' ? (
                  <CitySearchField
                    label="Город"
                    placeholder="Начните вводить город"
                    value={draft.cityId}
                    selectedLabel={draft.cityLabel || 'Любой город'}
                    onChange={(cityId, cityLabel) =>
                      patch({
                        cityId,
                        cityLabel: cityId ? cityLabel : '',
                      })
                    }
                  />
                ) : null}
              </View>

              <View style={styles.section}>
                <Text style={styles.sectionLabel}>Система</Text>
                <View style={styles.systemBtn}>
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => setSystemsOpen(true)}
                    style={({ pressed }) => [
                      styles.systemBtnMain,
                      pressed && { opacity: 0.9 },
                    ]}>
                    <Ionicons
                      name="extension-puzzle-outline"
                      size={16}
                      color={draft.system ? colors.text : colors.textMuted}
                    />
                    <Text
                      style={[
                        styles.systemBtnText,
                        !draft.system && styles.systemBtnPlaceholder,
                      ]}
                      numberOfLines={1}>
                      {draft.system || 'Любая система'}
                    </Text>
                  </Pressable>
                  {draft.system ? (
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel="Сбросить систему"
                      hitSlop={8}
                      onPress={() => patch({ system: null })}
                      style={styles.clearIconBtn}>
                      <Ionicons name="close-circle" size={18} color={colors.textMuted} />
                    </Pressable>
                  ) : (
                    <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
                  )}
                </View>
              </View>

              <View style={styles.section}>
                <Text style={styles.sectionLabel}>Цена за сессию</Text>
                <View style={styles.chipsRow}>
                  <OptionChip
                    label="Бесплатно"
                    icon="pricetag-outline"
                    selected={draft.isFree === true}
                    onPress={() => toggleFree(true)}
                    styles={styles}
                    colors={colors}
                  />
                  <OptionChip
                    label="Платно"
                    icon="cash-outline"
                    selected={draft.isFree === false}
                    onPress={() => toggleFree(false)}
                    styles={styles}
                    colors={colors}
                  />
                </View>
              </View>

              <View style={styles.section}>
                <Text style={styles.sectionLabel}>Дата</Text>
                <View style={styles.chipsRow}>
                  <OptionChip
                    label="Текущие"
                    icon="today-outline"
                    selected={draft.schedulePreset === 'upcoming'}
                    onPress={() => setSchedulePreset('upcoming')}
                    styles={styles}
                    colors={colors}
                  />
                  <OptionChip
                    label="Прошедшие"
                    icon="time-outline"
                    selected={draft.schedulePreset === 'past'}
                    onPress={() => setSchedulePreset('past')}
                    styles={styles}
                    colors={colors}
                  />
                </View>
                <View
                  style={[
                    styles.dateBtn,
                    draft.scheduledFrom && draft.scheduledTo ? styles.dateBtnActive : null,
                  ]}>
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => setDatesOpen(true)}
                    style={({ pressed }) => [
                      styles.dateBtnMain,
                      pressed && { opacity: 0.9 },
                    ]}>
                    <Ionicons
                      name="calendar-outline"
                      size={14}
                      color={
                        draft.scheduledFrom && draft.scheduledTo
                          ? colors.primary
                          : colors.textMuted
                      }
                    />
                    <Text
                      style={[
                        styles.dateBtnText,
                        draft.scheduledFrom && draft.scheduledTo
                          ? styles.dateBtnTextActive
                          : null,
                      ]}
                      numberOfLines={1}>
                      {draft.scheduledFrom && draft.scheduledTo
                        ? dateRangeLabel
                        : 'Период'}
                    </Text>
                    {draft.scheduledFrom && draft.scheduledTo ? null : (
                      <Ionicons name="chevron-forward" size={14} color={colors.textMuted} />
                    )}
                  </Pressable>
                  {draft.scheduledFrom && draft.scheduledTo ? (
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel="Сбросить даты"
                      hitSlop={8}
                      onPress={() => patch(clearGamesScheduleFilter(draft))}
                      style={styles.clearIconBtn}>
                      <Ionicons name="close" size={14} color={colors.primary} />
                    </Pressable>
                  ) : null}
                </View>
              </View>

              <View style={styles.section}>
                <Text style={styles.sectionLabel}>Возраст стола</Text>
                <View style={styles.chipsRow}>
                  {(
                    [
                      ['any', 'Любой', 'people-outline'],
                      ['12', '12+', 'id-card-outline'],
                      ['16', '16+', 'id-card-outline'],
                      ['18', '18+', 'id-card-outline'],
                    ] as const
                  ).map(([value, label, icon]) => (
                    <OptionChip
                      key={value}
                      label={label}
                      icon={icon}
                      selected={draft.age === value}
                      onPress={() => toggleAge(value)}
                      styles={styles}
                      colors={colors}
                    />
                  ))}
                </View>
              </View>

              <View style={styles.section}>
                <Text style={styles.sectionLabel}>Ещё</Text>
                <View style={styles.chipsRow}>
                  <OptionChip
                    label="Есть места"
                    icon="people-outline"
                    selected={draft.hasSeats}
                    onPress={() => patch({ hasSeats: !draft.hasSeats })}
                    styles={styles}
                    colors={colors}
                  />
                  <OptionChip
                    label="Опыт не важен"
                    icon="school-outline"
                    selected={draft.beginnersWelcome}
                    onPress={() =>
                      patch({ beginnersWelcome: !draft.beginnersWelcome })
                    }
                    styles={styles}
                    colors={colors}
                  />
                </View>
              </View>
            </ScrollView>

            <View style={styles.footer}>
              <Pressable
                accessibilityRole="button"
                onPress={onClear}
                style={({ pressed }) => [
                  styles.footerBtn,
                  styles.footerClear,
                  pressed && { opacity: 0.88 },
                ]}>
                <Text style={styles.footerClearLabel}>Сбросить</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                onPress={onApply}
                style={({ pressed }) => [
                  styles.footerBtn,
                  styles.footerApply,
                  pressed && { opacity: 0.9 },
                ]}>
                <Text style={styles.footerApplyLabel}>Показать</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <GameSystemsPicker
        visible={systemsOpen && visible}
        options={systemOptions}
        selectedNames={draft.system ? [draft.system] : []}
        allowCustomSystems={false}
        selectionMode="single"
        layout="filter"
        title="Система"
        onChange={(names) => {
          patch({ system: names[0] ?? null });
          setSystemsOpen(false);
        }}
        onClose={() => setSystemsOpen(false)}
      />

      <DateRangePicker
        visible={datesOpen && visible}
        value={{
          from: draft.scheduledFrom,
          to: draft.scheduledTo,
          preset: draft.schedulePreset,
        }}
        onChange={({ from, to, preset }) =>
          patch({
            schedulePreset: preset ?? null,
            scheduledFrom: from,
            scheduledTo: to,
          })
        }
        onClose={() => setDatesOpen(false)}
      />
    </>
  );
}
