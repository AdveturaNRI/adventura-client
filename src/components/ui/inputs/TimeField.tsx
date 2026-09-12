import { Ionicons } from '@expo/vector-icons';
import { useEffect, useMemo, useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
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
import { pad2 } from '@/utils/date-format';

type TimeFieldProps = {
  label: string;
  labelHint?: string;
  placeholder?: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  error?: string;
  style?: ViewStyle;
  /** Minute step, default 15 */
  minuteStep?: 5 | 10 | 15 | 30;
};

const DESKTOP_SHEET_MAX_WIDTH = 360;
const HOURS = Array.from({ length: 24 }, (_, index) => pad2(index));

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
      fontVariant: ['tabular-nums'],
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
      maxHeight: isDesktopWeb ? '80%' : '70%',
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
    columns: {
      flexDirection: 'row',
      gap: Spacing.sm,
      paddingHorizontal: Spacing.md,
      paddingTop: Spacing.md,
      minHeight: 260,
    },
    column: {
      flex: 1,
      gap: Spacing.xs,
    },
    columnTitle: {
      fontSize: FontSize.caption,
      fontWeight: '600',
      color: colors.textMuted,
      paddingHorizontal: Spacing.sm,
      marginBottom: 4,
    },
    columnScroll: {
      maxHeight: 240,
    },
    option: {
      minHeight: 44,
      borderRadius: Radius.pill,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: Spacing.md,
    },
    optionSelected: {
      backgroundColor: 'rgba(21, 122, 254, 0.1)',
    },
    optionLabel: {
      fontSize: FontSize.input,
      fontWeight: '600',
      color: colors.text,
      fontVariant: ['tabular-nums'],
    },
    optionLabelSelected: {
      color: colors.primary,
    },
    footer: {
      paddingHorizontal: Spacing.lg,
      paddingTop: Spacing.md,
      flexDirection: 'row',
      justifyContent: 'flex-end',
      gap: Spacing.md,
    },
    footerAction: {
      paddingVertical: 8,
      paddingHorizontal: 4,
    },
    footerActionLabel: {
      fontSize: FontSize.label,
      fontWeight: '500',
      color: colors.textMuted,
    },
    footerActionPrimary: {
      color: colors.primary,
      fontWeight: '600',
    },
  });
}

function parseTimeParts(value: string): { hour: string; minute: string } | null {
  const match = /^(\d{2}):(\d{2})$/.exec(value.trim());
  if (!match) {
    return null;
  }

  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) {
    return null;
  }

  return { hour: match[1], minute: match[2] };
}

export function TimeField({
  label,
  labelHint,
  placeholder = 'Выберите время',
  value,
  onChange,
  disabled = false,
  error,
  style,
  minuteStep = 15,
}: TimeFieldProps) {
  const colors = useTheme();
  const isDesktopWeb = useIsDesktopWeb();
  const styles = useThemedStyles((themeColors) => createStyles(themeColors, isDesktopWeb));
  const [isOpen, setIsOpen] = useState(false);

  const minutes = useMemo(
    () => Array.from({ length: Math.floor(60 / minuteStep) }, (_, index) => pad2(index * minuteStep)),
    [minuteStep],
  );

  const parsed = useMemo(() => parseTimeParts(value), [value]);
  const [draftHour, setDraftHour] = useState(parsed?.hour ?? '19');
  const [draftMinute, setDraftMinute] = useState(parsed?.minute ?? '00');

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const next = parseTimeParts(value);
    setDraftHour(next?.hour ?? '19');
    const rawMinute = next?.minute ?? '00';
    const snapped =
      minutes.find((item) => item === rawMinute) ??
      minutes.reduce((closest, item) =>
        Math.abs(Number(item) - Number(rawMinute)) < Math.abs(Number(closest) - Number(rawMinute))
          ? item
          : closest,
      );
    setDraftMinute(snapped);
  }, [isOpen, minutes, value]);

  const close = () => setIsOpen(false);

  const apply = () => {
    onChange(`${draftHour}:${draftMinute}`);
    close();
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
        <Text style={[styles.value, !parsed && styles.placeholder]} numberOfLines={1}>
          {parsed ? `${parsed.hour}:${parsed.minute}` : placeholder}
        </Text>
        <Ionicons name="time-outline" size={18} color={colors.textMuted} />
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

            <View style={styles.columns}>
              <View style={styles.column}>
                <Text style={styles.columnTitle}>Часы</Text>
                <ScrollView style={styles.columnScroll} keyboardShouldPersistTaps="handled">
                  {HOURS.map((hour) => {
                    const selected = hour === draftHour;
                    return (
                      <Pressable
                        key={hour}
                        accessibilityRole="button"
                        onPress={() => setDraftHour(hour)}
                        style={({ pressed }) => [
                          styles.option,
                          selected && styles.optionSelected,
                          pressed && { opacity: 0.85 },
                        ]}>
                        <Text
                          style={[
                            styles.optionLabel,
                            selected && styles.optionLabelSelected,
                          ]}>
                          {hour}
                        </Text>
                      </Pressable>
                    );
                  })}
                </ScrollView>
              </View>

              <View style={styles.column}>
                <Text style={styles.columnTitle}>Минуты</Text>
                <ScrollView style={styles.columnScroll} keyboardShouldPersistTaps="handled">
                  {minutes.map((minute) => {
                    const selected = minute === draftMinute;
                    return (
                      <Pressable
                        key={minute}
                        accessibilityRole="button"
                        onPress={() => setDraftMinute(minute)}
                        style={({ pressed }) => [
                          styles.option,
                          selected && styles.optionSelected,
                          pressed && { opacity: 0.85 },
                        ]}>
                        <Text
                          style={[
                            styles.optionLabel,
                            selected && styles.optionLabelSelected,
                          ]}>
                          {minute}
                        </Text>
                      </Pressable>
                    );
                  })}
                </ScrollView>
              </View>
            </View>

            <View style={styles.footer}>
              {value ? (
                <Pressable
                  accessibilityRole="button"
                  onPress={() => {
                    onChange('');
                    close();
                  }}
                  style={({ pressed }) => [styles.footerAction, pressed && { opacity: 0.75 }]}>
                  <Text style={styles.footerActionLabel}>Сбросить</Text>
                </Pressable>
              ) : null}
              <Pressable
                accessibilityRole="button"
                onPress={apply}
                style={({ pressed }) => [styles.footerAction, pressed && { opacity: 0.75 }]}>
                <Text style={[styles.footerActionLabel, styles.footerActionPrimary]}>Готово</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}
