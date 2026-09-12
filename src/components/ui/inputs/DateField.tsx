import { Ionicons } from '@expo/vector-icons';
import { useEffect, useMemo, useState } from 'react';
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
  type ViewStyle,
} from 'react-native';

import { FieldLabelHint } from '@/components/ui/inputs/FieldLabelHint';
import { useIsDesktopWeb } from '@/components/navigation/DesktopThemeToggle';
import { FontSize, Radius, Sizes, Spacing, type ThemeColors } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useThemedStyles } from '@/hooks/use-themed-styles';
import {
  WEEKDAY_LABELS_RU,
  addMonths,
  buildMonthGrid,
  formatDateRu,
  isSameCalendarDay,
  monthTitleRu,
  parseDateRu,
  startOfMonth,
} from '@/utils/date-format';

type DateFieldProps = {
  label: string;
  labelHint?: string;
  placeholder?: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  error?: string;
  style?: ViewStyle;
  /** Inclusive lower bound; default = today */
  minDate?: Date | null;
};

const DESKTOP_SHEET_MAX_WIDTH = 360;

function createStyles(colors: ThemeColors, isDesktopWeb: boolean) {
  return StyleSheet.create({
    wrapper: {
      gap: Spacing.sm,
      flex: 1,
      minWidth: 0,
    },
    label: {
      fontSize: FontSize.label,
      color: colors.textMuted,
      paddingLeft: Spacing.xs,
    },
    labelRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.xs,
      paddingLeft: Spacing.xs,
    },
    labelText: {
      fontSize: FontSize.label,
      color: colors.textMuted,
    },
    trigger: {
      minHeight: Sizes.controlHeight,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: Radius.pill,
      paddingHorizontal: Spacing.md,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: Spacing.sm,
      backgroundColor: colors.surface,
    },
    triggerDisabled: {
      opacity: 0.45,
    },
    triggerError: {
      borderColor: colors.destructive,
    },
    triggerPressed: {
      opacity: 0.9,
    },
    value: {
      flex: 1,
      fontSize: FontSize.input,
      color: colors.textSecondary,
    },
    placeholder: {
      color: colors.textMuted,
    },
    error: {
      fontSize: FontSize.caption,
      color: colors.destructive,
      paddingLeft: Spacing.xs,
    },
    modalBackdrop: {
      flex: 1,
      backgroundColor: colors.overlay,
      justifyContent: isDesktopWeb ? 'center' : 'flex-end',
      alignItems: isDesktopWeb ? 'center' : 'stretch',
      paddingHorizontal: isDesktopWeb ? Spacing.lg : 0,
      paddingVertical: isDesktopWeb ? Spacing.xl : 0,
    },
    modalSheet: {
      width: '100%',
      maxWidth: isDesktopWeb ? DESKTOP_SHEET_MAX_WIDTH : undefined,
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      borderBottomLeftRadius: isDesktopWeb ? 20 : 0,
      borderBottomRightRadius: isDesktopWeb ? 20 : 0,
      backgroundColor: colors.surface,
      paddingBottom: Spacing.lg,
      overflow: 'hidden',
      ...(isDesktopWeb
        ? {
            borderWidth: 1,
            borderColor: colors.borderLight,
            shadowColor: colors.shadow,
            shadowOffset: { width: 0, height: 12 },
            shadowOpacity: 0.12,
            shadowRadius: 28,
            elevation: 8,
          }
        : null),
    },
    modalHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: Spacing.lg,
      paddingVertical: Spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: colors.borderLight,
    },
    modalTitle: {
      fontSize: FontSize.button,
      fontWeight: '600',
      color: colors.text,
    },
    calendar: {
      paddingHorizontal: Spacing.md,
      paddingTop: Spacing.md,
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
    navButtonDisabled: {
      opacity: 0.35,
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
      padding: 2,
    },
    dayButton: {
      width: '100%',
      height: '100%',
      maxWidth: 44,
      maxHeight: 44,
      borderRadius: 22,
      alignItems: 'center',
      justifyContent: 'center',
    },
    dayButtonToday: {
      borderWidth: 1.5,
      borderColor: colors.primary,
      backgroundColor: 'rgba(21, 122, 254, 0.06)',
    },
    dayButtonSelected: {
      backgroundColor: colors.primary,
      borderWidth: 0,
    },
    dayButtonDisabled: {
      opacity: 0.28,
    },
    dayLabel: {
      fontSize: FontSize.label,
      fontWeight: '600',
      color: colors.text,
    },
    dayLabelSelected: {
      color: colors.onPrimary,
    },
    dayLabelMuted: {
      color: colors.textMuted,
    },
    footer: {
      paddingHorizontal: Spacing.lg,
      paddingTop: Spacing.md,
      flexDirection: 'row',
      justifyContent: 'flex-end',
    },
    clearButton: {
      paddingVertical: 8,
      paddingHorizontal: 4,
    },
    clearLabel: {
      fontSize: FontSize.label,
      fontWeight: '500',
      color: colors.textMuted,
    },
  });
}

export function DateField({
  label,
  labelHint,
  placeholder = 'Выберите дату',
  value,
  onChange,
  disabled = false,
  error,
  style,
  minDate,
}: DateFieldProps) {
  const colors = useTheme();
  const isDesktopWeb = useIsDesktopWeb();
  const styles = useThemedStyles((themeColors) => createStyles(themeColors, isDesktopWeb));
  const [isOpen, setIsOpen] = useState(false);

  const selectedDate = useMemo(() => parseDateRu(value), [value]);
  const today = useMemo(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), now.getDate());
  }, []);
  const lowerBound = minDate === null ? null : (minDate ?? today);

  const [visibleMonth, setVisibleMonth] = useState(() =>
    startOfMonth(selectedDate ?? today),
  );

  useEffect(() => {
    if (isOpen) {
      setVisibleMonth(startOfMonth(selectedDate ?? today));
    }
  }, [isOpen, selectedDate, today]);

  const grid = useMemo(() => buildMonthGrid(visibleMonth), [visibleMonth]);

  const canGoPrev = useMemo(() => {
    if (!lowerBound) {
      return true;
    }
    const prevMonthEnd = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth(), 0);
    return prevMonthEnd >= lowerBound;
  }, [lowerBound, visibleMonth]);

  const close = () => setIsOpen(false);

  const isDayDisabled = (date: Date) => {
    if (!lowerBound) {
      return false;
    }
    return date < lowerBound;
  };

  return (
    <View style={[styles.wrapper, style]}>
      <View style={styles.labelRow}>
        <Text style={styles.labelText}>{label}</Text>
        {labelHint ? <FieldLabelHint text={labelHint} /> : null}
      </View>

      <Pressable
        accessibilityRole="button"
        accessibilityState={{ disabled }}
        disabled={disabled}
        onPress={() => setIsOpen(true)}
        style={({ pressed }) => [
          styles.trigger,
          disabled && styles.triggerDisabled,
          error ? styles.triggerError : null,
          pressed && !disabled && styles.triggerPressed,
        ]}>
        <Text style={[styles.value, !selectedDate && styles.placeholder]} numberOfLines={1}>
          {selectedDate ? formatDateRu(selectedDate) : placeholder}
        </Text>
        <Ionicons name="calendar-outline" size={18} color={colors.primary} />
      </Pressable>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <Modal
        visible={isOpen}
        transparent
        animationType={isDesktopWeb ? 'fade' : 'slide'}
        onRequestClose={close}>
        <Pressable style={styles.modalBackdrop} onPress={close}>
          <Pressable style={styles.modalSheet} onPress={(event) => event.stopPropagation()}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{label}</Text>
              <Pressable accessibilityRole="button" onPress={close} hitSlop={8}>
                <Ionicons name="close" size={22} color={colors.textMuted} />
              </Pressable>
            </View>

            <View style={styles.calendar}>
              <View style={styles.monthRow}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Предыдущий месяц"
                  disabled={!canGoPrev}
                  onPress={() => setVisibleMonth((current) => addMonths(current, -1))}
                  style={({ pressed }) => [
                    styles.navButton,
                    !canGoPrev && styles.navButtonDisabled,
                    pressed && canGoPrev && { opacity: 0.75 },
                  ]}>
                  <Ionicons
                    name="chevron-back"
                    size={18}
                    color={canGoPrev ? colors.primary : colors.textMuted}
                  />
                </Pressable>
                <Text style={styles.monthTitle}>{monthTitleRu(visibleMonth)}</Text>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Следующий месяц"
                  onPress={() => setVisibleMonth((current) => addMonths(current, 1))}
                  style={({ pressed }) => [
                    styles.navButton,
                    pressed && { opacity: 0.75 },
                  ]}>
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

                  const selected = selectedDate
                    ? isSameCalendarDay(date, selectedDate)
                    : false;
                  const isToday = isSameCalendarDay(date, today);
                  const dayDisabled = isDayDisabled(date);

                  return (
                    <View key={formatDateRu(date)} style={styles.dayCell}>
                      <Pressable
                        accessibilityRole="button"
                        accessibilityState={{ selected, disabled: dayDisabled }}
                        disabled={dayDisabled}
                        onPress={() => {
                          onChange(formatDateRu(date));
                          close();
                        }}
                        style={({ pressed }) => [
                          styles.dayButton,
                          isToday && !selected ? styles.dayButtonToday : null,
                          selected ? styles.dayButtonSelected : null,
                          dayDisabled ? styles.dayButtonDisabled : null,
                          pressed && !dayDisabled && { opacity: 0.85 },
                        ]}>
                        <Text
                          style={[
                            styles.dayLabel,
                            dayDisabled && styles.dayLabelMuted,
                            selected && styles.dayLabelSelected,
                          ]}>
                          {date.getDate()}
                        </Text>
                      </Pressable>
                    </View>
                  );
                })}
              </View>
            </View>

            {value ? (
              <View style={styles.footer}>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => {
                    onChange('');
                    close();
                  }}
                  style={({ pressed }) => [
                    styles.clearButton,
                    pressed && { opacity: 0.75 },
                  ]}>
                  <Text style={styles.clearLabel}>Сбросить</Text>
                </Pressable>
              </View>
            ) : null}
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}
