import { Ionicons } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { useIsDesktopWeb } from '@/components/navigation/DesktopThemeToggle';
import { FontSize, Radius, Spacing, type ThemeColors } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useThemedStyles } from '@/hooks/use-themed-styles';
import {
  WEEKDAY_LABELS_RU,
  addMonths,
  buildMonthGrid,
  formatDateRu,
  isSameCalendarDay,
  monthTitleRu,
  startOfMonth,
} from '@/utils/date-format';

export type DateRangeValue = {
  from: string | null;
  to: string | null;
  preset?: 'upcoming' | 'past' | null;
};

type DateRangePickerProps = {
  visible: boolean;
  value: DateRangeValue;
  title?: string;
  onChange: (next: DateRangeValue) => void;
  onClose: () => void;
};

function toIsoDate(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function parseIsoDate(value: string | null | undefined): Date | null {
  if (!value?.trim()) {
    return null;
  }
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!match) {
    return null;
  }
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(year, month - 1, day);
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null;
  }
  return date;
}

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function isInRange(date: Date, from: Date | null, to: Date | null): boolean {
  if (!from || !to) {
    return false;
  }
  const time = startOfDay(date).getTime();
  return time > from.getTime() && time < to.getTime();
}

function createStyles(colors: ThemeColors, isDesktopWeb: boolean) {
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
      width: '100%',
      maxWidth: isDesktopWeb ? 560 : undefined,
      maxHeight: isDesktopWeb ? '82%' : '88%',
      flexDirection: 'column',
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
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
      paddingVertical: Spacing.md,
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
      backgroundColor: 'rgba(21, 122, 254, 0.08)',
    },
    summary: {
      paddingHorizontal: Spacing.lg,
      paddingTop: Spacing.md,
      paddingBottom: Spacing.xs,
      alignItems: 'center',
    },
    summaryText: {
      fontSize: FontSize.label,
      fontWeight: '600',
      color: colors.primary,
      textAlign: 'center',
    },
    summaryPlaceholder: {
      fontSize: FontSize.label,
      fontWeight: '500',
      color: colors.textMuted,
      textAlign: 'center',
    },
    presetsRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: Spacing.xs,
      paddingHorizontal: Spacing.lg,
      paddingTop: Spacing.sm,
      paddingBottom: Spacing.xs,
    },
    presetChip: {
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
    presetChipSelected: {
      borderColor: 'rgba(21, 122, 254, 0.35)',
      backgroundColor: 'rgba(21, 122, 254, 0.12)',
    },
    presetChipLabel: {
      fontSize: FontSize.caption,
      fontWeight: '600',
      color: colors.text,
    },
    presetChipLabelSelected: {
      color: colors.primary,
    },
    calendar: {
      paddingHorizontal: Spacing.md,
      paddingTop: Spacing.sm,
      gap: Spacing.sm,
    },
    monthRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: Spacing.xs,
      marginBottom: Spacing.xs,
    },
    monthTitle: {
      fontSize: FontSize.button,
      fontWeight: '700',
      color: colors.text,
    },
    navButton: {
      width: 36,
      height: 36,
      borderRadius: 18,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'rgba(21, 122, 254, 0.08)',
    },
    weekdays: {
      flexDirection: 'row',
    },
    weekdayCell: {
      flex: 1,
      alignItems: 'center',
      paddingVertical: 6,
    },
    weekdayLabel: {
      fontSize: FontSize.caption,
      fontWeight: '600',
      color: colors.textMuted,
    },
    daysGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
    },
    dayCell: {
      width: '14.2857%',
      aspectRatio: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },
    dayHit: {
      position: 'absolute',
      top: 0,
      right: 0,
      bottom: 0,
      left: 0,
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1,
    },
    dayRangeBg: {
      position: 'absolute',
      top: '12%',
      right: 0,
      bottom: '12%',
      left: 0,
      backgroundColor: 'rgba(21, 122, 254, 0.12)',
    },
    dayRangeBgStart: {
      left: '50%',
      borderTopLeftRadius: 0,
      borderBottomLeftRadius: 0,
    },
    dayRangeBgEnd: {
      right: '50%',
      borderTopRightRadius: 0,
      borderBottomRightRadius: 0,
    },
    dayRangeBgSingle: {
      left: '18%',
      right: '18%',
      borderRadius: 999,
    },
    dayButton: {
      width: '84%',
      maxWidth: 40,
      aspectRatio: 1,
      borderRadius: 999,
      alignItems: 'center',
      justifyContent: 'center',
    },
    dayButtonToday: {
      borderWidth: 1.5,
      borderColor: colors.primary,
    },
    dayButtonEndpoint: {
      backgroundColor: colors.primary,
      borderWidth: 0,
    },
    dayLabel: {
      fontSize: FontSize.label,
      fontWeight: '600',
      color: colors.text,
    },
    dayLabelEndpoint: {
      color: colors.onPrimary,
    },
    dayLabelMuted: {
      color: colors.textMuted,
    },
    footer: {
      flexShrink: 0,
      flexDirection: 'row',
      justifyContent: isDesktopWeb ? 'flex-end' : undefined,
      gap: Spacing.sm,
      paddingHorizontal: Spacing.lg,
      paddingTop: Spacing.md,
      paddingBottom: Spacing.lg,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.borderLight,
      marginTop: Spacing.md,
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
    footerApplyDisabled: {
      opacity: 0.45,
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

function formatCompactRange(from: Date | null, to: Date | null): string | null {
  if (!from) {
    return null;
  }
  if (!to || isSameCalendarDay(from, to)) {
    return formatDateRu(from);
  }
  return `${formatDateRu(from)} – ${formatDateRu(to)}`;
}

export function DateRangePicker({
  visible,
  value,
  title = 'Период',
  onChange,
  onClose,
}: DateRangePickerProps) {
  if (!visible) {
    return null;
  }

  return (
    <DateRangePickerSheet
      key={`${value.from ?? ''}:${value.to ?? ''}`}
      value={value}
      title={title}
      onChange={onChange}
      onClose={onClose}
    />
  );
}

function DateRangePickerSheet({
  value,
  title,
  onChange,
  onClose,
}: Omit<DateRangePickerProps, 'visible'>) {
  const colors = useTheme();
  const isDesktopWeb = useIsDesktopWeb();
  const styles = useThemedStyles((theme) => createStyles(theme, isDesktopWeb));

  const today = useMemo(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), now.getDate());
  }, []);

  const initialFrom = parseIsoDate(value.from);
  const initialTo = parseIsoDate(value.to);

  const [draftFrom, setDraftFrom] = useState<Date | null>(initialFrom);
  const [draftTo, setDraftTo] = useState<Date | null>(initialTo);
  const [visibleMonth, setVisibleMonth] = useState(() =>
    startOfMonth(initialFrom ?? initialTo ?? today),
  );

  const grid = useMemo(() => buildMonthGrid(visibleMonth), [visibleMonth]);
  const canApply = Boolean(draftFrom && draftTo);
  const summary =
    draftFrom && draftTo
      ? formatCompactRange(draftFrom, draftTo)
      : draftFrom
        ? `${formatDateRu(draftFrom)} – …`
        : null;

  const pickDay = (date: Date) => {
    const day = startOfDay(date);

    if (!draftFrom || (draftFrom && draftTo)) {
      setDraftFrom(day);
      setDraftTo(null);
      return;
    }

    if (day.getTime() < draftFrom.getTime()) {
      setDraftTo(draftFrom);
      setDraftFrom(day);
      return;
    }

    setDraftTo(day);
  };

  const apply = () => {
    if (!draftFrom || !draftTo) {
      return;
    }
    onChange({
      from: toIsoDate(draftFrom),
      to: toIsoDate(draftTo),
      preset: null,
    });
    onClose();
  };

  const clear = () => {
    setDraftFrom(null);
    setDraftTo(null);
    onChange({ from: null, to: null, preset: null });
    onClose();
  };

  const applyPreset = (preset: 'upcoming' | 'past') => {
    onChange({ from: null, to: null, preset });
    onClose();
  };

  return (
    <Modal
      visible
      transparent
      animationType={isDesktopWeb ? 'fade' : 'slide'}
      onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={styles.sheet}>
          <View style={styles.header}>
            <Text style={styles.title}>{title}</Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Закрыть"
              onPress={onClose}
              style={({ pressed }) => [styles.closeBtn, pressed && { opacity: 0.8 }]}>
              <Ionicons name="close" size={18} color={colors.text} />
            </Pressable>
          </View>

          <View style={styles.presetsRow}>
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ selected: value.preset === 'upcoming' }}
              onPress={() => applyPreset('upcoming')}
              style={({ pressed }) => [
                styles.presetChip,
                value.preset === 'upcoming' && styles.presetChipSelected,
                pressed && { opacity: 0.88 },
              ]}>
              <Ionicons
                name="today-outline"
                size={14}
                color={value.preset === 'upcoming' ? colors.primary : colors.text}
              />
              <Text
                style={[
                  styles.presetChipLabel,
                  value.preset === 'upcoming' && styles.presetChipLabelSelected,
                ]}>
                Текущие
              </Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ selected: value.preset === 'past' }}
              onPress={() => applyPreset('past')}
              style={({ pressed }) => [
                styles.presetChip,
                value.preset === 'past' && styles.presetChipSelected,
                pressed && { opacity: 0.88 },
              ]}>
              <Ionicons
                name="time-outline"
                size={14}
                color={value.preset === 'past' ? colors.primary : colors.text}
              />
              <Text
                style={[
                  styles.presetChipLabel,
                  value.preset === 'past' && styles.presetChipLabelSelected,
                ]}>
                Прошедшие
              </Text>
            </Pressable>
          </View>

          <View style={styles.summary}>
            <Text style={summary ? styles.summaryText : styles.summaryPlaceholder}>
              {summary ?? 'Или выберите период на календаре'}
            </Text>
          </View>

          <View style={styles.calendar}>
            <View style={styles.monthRow}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Предыдущий месяц"
                onPress={() => setVisibleMonth((current) => addMonths(current, -1))}
                style={({ pressed }) => [styles.navButton, pressed && { opacity: 0.75 }]}>
                <Ionicons name="chevron-back" size={18} color={colors.primary} />
              </Pressable>
              <Text style={styles.monthTitle}>{monthTitleRu(visibleMonth)}</Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Следующий месяц"
                onPress={() => setVisibleMonth((current) => addMonths(current, 1))}
                style={({ pressed }) => [styles.navButton, pressed && { opacity: 0.75 }]}>
                <Ionicons name="chevron-forward" size={18} color={colors.primary} />
              </Pressable>
            </View>

            <View style={styles.weekdays}>
              {WEEKDAY_LABELS_RU.map((weekday) => (
                <View key={weekday} style={styles.weekdayCell}>
                  <Text style={styles.weekdayLabel}>{weekday}</Text>
                </View>
              ))}
            </View>

            <View style={styles.daysGrid}>
              {grid.map((date, index) => {
                if (!date) {
                  return <View key={`empty-${index}`} style={styles.dayCell} />;
                }

                const isStart = draftFrom ? isSameCalendarDay(date, draftFrom) : false;
                const isEnd = draftTo ? isSameCalendarDay(date, draftTo) : false;
                const endpoint = isStart || isEnd;
                const inRange = isInRange(date, draftFrom, draftTo);
                const sameDayRange =
                  Boolean(draftFrom && draftTo && isSameCalendarDay(draftFrom, draftTo) && isStart);
                const isToday = isSameCalendarDay(date, today);
                const showRangeBar = inRange || (endpoint && draftFrom && draftTo && !sameDayRange);

                return (
                  <View key={toIsoDate(date)} style={styles.dayCell}>
                    {showRangeBar ? (
                      <View
                        pointerEvents="none"
                        style={[
                          styles.dayRangeBg,
                          isStart ? styles.dayRangeBgStart : null,
                          isEnd ? styles.dayRangeBgEnd : null,
                        ]}
                      />
                    ) : null}
                    {sameDayRange ? (
                      <View pointerEvents="none" style={[styles.dayRangeBg, styles.dayRangeBgSingle]} />
                    ) : null}
                    <Pressable
                      accessibilityRole="button"
                      accessibilityState={{ selected: endpoint }}
                      onPress={() => pickDay(date)}
                      style={styles.dayHit}>
                      <View
                        style={[
                          styles.dayButton,
                          isToday && !endpoint ? styles.dayButtonToday : null,
                          endpoint ? styles.dayButtonEndpoint : null,
                        ]}>
                        <Text
                          style={[
                            styles.dayLabel,
                            endpoint ? styles.dayLabelEndpoint : null,
                            !endpoint && !inRange && date < today ? styles.dayLabelMuted : null,
                          ]}>
                          {date.getDate()}
                        </Text>
                      </View>
                    </Pressable>
                  </View>
                );
              })}
            </View>
          </View>

          <View style={styles.footer}>
            <Pressable
              accessibilityRole="button"
              onPress={clear}
              style={({ pressed }) => [
                styles.footerBtn,
                styles.footerClear,
                pressed && { opacity: 0.88 },
              ]}>
              <Text style={styles.footerClearLabel}>Сбросить</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              disabled={!canApply}
              onPress={apply}
              style={({ pressed }) => [
                styles.footerBtn,
                styles.footerApply,
                !canApply && styles.footerApplyDisabled,
                pressed && canApply && { opacity: 0.9 },
              ]}>
              <Text style={styles.footerApplyLabel}>Готово</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

export function formatDateRangeLabel(from: string | null, to: string | null): string | null {
  const fromDate = parseIsoDate(from);
  const toDate = parseIsoDate(to);
  if (!fromDate || !toDate) {
    return null;
  }
  return formatCompactRange(fromDate, toDate);
}
