import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { useIsDesktopWeb } from '@/components/navigation/DesktopThemeToggle';
import { FontSize, Spacing, type ThemeColors } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useThemedStyles } from '@/hooks/use-themed-styles';
import {
  applyAvailabilityTimeToAll,
  completeAvailabilityTime,
  formatAvailability,
  formatAvailabilityTimeInput,
  getAvailabilityDays,
  stripAvailabilityTimes,
  toggleAvailabilityDay,
  updateAvailabilityDayTime,
  WEEKDAY_OPTIONS,
  type QuestionnaireAvailability,
} from '@/screens/questionnaire/availability';
import { EXPERIENCE_STEP } from '@/screens/questionnaire/questionnaire.config';

type AvailabilityPickerProps = {
  value: QuestionnaireAvailability;
  onChange: (value: QuestionnaireAvailability) => void;
  showTime?: boolean;
  showDayLabels?: boolean;
};

function createStyles(colors: ThemeColors, isDesktopWeb: boolean) {
  return StyleSheet.create({
    wrapper: {
      gap: Spacing.lg,
      width: '100%',
      maxWidth: '100%',
      minWidth: 0,
    },
    daysBlock: {
      gap: Spacing.sm,
      width: '100%',
      minWidth: 0,
    },
    blockLabel: {
      fontSize: FontSize.label,
      fontWeight: '600',
      color: colors.text,
      paddingLeft: Spacing.xs,
    },
    blockHint: {
      fontSize: FontSize.caption,
      color: colors.textMuted,
      paddingLeft: Spacing.xs,
      lineHeight: FontSize.caption * 1.45,
    },
    daysRow: {
      flexDirection: 'row',
      gap: Spacing.xs,
      width: '100%',
      maxWidth: '100%',
      minWidth: 0,
    },
    dayChip: {
      flex: 1,
      minWidth: 0,
      height: 44,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.surface,
      paddingHorizontal: 2,
    },
    dayChipSelected: {
      borderColor: colors.primary,
      backgroundColor: colors.primary,
    },
    dayChipDisabled: {
      opacity: 0.4,
    },
    dayChipPressed: {
      opacity: 0.88,
    },
    dayChipLabel: {
      fontSize: FontSize.caption,
      fontWeight: '700',
      color: colors.textMuted,
    },
    dayChipLabelSelected: {
      color: colors.onPrimary,
    },
    timeBlock: {
      gap: Spacing.sm,
    },
    timeBlockHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: Spacing.sm,
      paddingLeft: Spacing.xs,
      paddingRight: Spacing.xs,
    },
    timeTitle: {
      fontSize: FontSize.label,
      fontWeight: '600',
      color: colors.text,
      flex: 1,
    },
    applyAllButton: {
      paddingVertical: 4,
      paddingHorizontal: Spacing.sm,
    },
    applyAllLabel: {
      fontSize: FontSize.caption,
      fontWeight: '600',
      color: colors.primary,
    },
    applyAllPressed: {
      opacity: 0.75,
    },
    timeCardDisabled: {
      opacity: 0.45,
    },
    slotList: {
      gap: Spacing.sm,
    },
    slotRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: isDesktopWeb ? Spacing.md : Spacing.sm,
      paddingVertical: Spacing.sm,
      paddingHorizontal: Spacing.md,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.borderLight,
      backgroundColor: colors.surfaceMuted,
    },
    slotDayBadge: {
      minWidth: 36,
      height: 32,
      borderRadius: 10,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.primary,
      paddingHorizontal: Spacing.sm,
    },
    slotDayLabel: {
      fontSize: FontSize.caption,
      fontWeight: '700',
      color: colors.onPrimary,
    },
    slotTimes: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.sm,
      minWidth: 0,
    },
    timeField: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      flexShrink: 0,
    },
    timeLabel: {
      fontSize: FontSize.caption,
      color: colors.textMuted,
    },
    timeInput: {
      width: isDesktopWeb ? 76 : 68,
      height: 36,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 10,
      paddingHorizontal: Spacing.sm,
      fontSize: FontSize.label,
      fontWeight: '600',
      color: colors.text,
      textAlign: 'center',
      backgroundColor: colors.surface,
    },
    timeDivider: {
      fontSize: FontSize.caption,
      color: colors.textSubtle,
    },
    agreementCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.md,
      padding: Spacing.md,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.borderLight,
      backgroundColor: colors.surface,
      width: '100%',
      maxWidth: '100%',
      minWidth: 0,
    },
    agreementCardActive: {
      borderColor: colors.primary,
      backgroundColor: colors.surfaceMuted,
    },
    agreementCardPressed: {
      opacity: 0.9,
    },
    agreementIconWrap: {
      width: 40,
      height: 40,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.surfaceMuted,
    },
    agreementIconWrapActive: {
      backgroundColor: colors.primary,
    },
    agreementBody: {
      flex: 1,
      minWidth: 0,
      gap: 2,
    },
    agreementLabel: {
      fontSize: FontSize.label,
      fontWeight: '600',
      color: colors.text,
    },
    agreementHint: {
      fontSize: FontSize.caption,
      color: colors.textMuted,
      lineHeight: FontSize.caption * 1.4,
    },
    preview: {
      fontSize: FontSize.caption,
      color: colors.primary,
      fontWeight: '600',
      paddingLeft: Spacing.xs,
    },
  });
}

export function AvailabilityPicker({
  value,
  onChange,
  showTime = true,
  showDayLabels = true,
}: AvailabilityPickerProps) {
  const colors = useTheme();
  const isDesktopWeb = useIsDesktopWeb();
  const styles = useThemedStyles((themeColors) => createStyles(themeColors, isDesktopWeb));
  const isDisabled = value.byAgreement;
  const selectedDays = getAvailabilityDays(value);
  const sortedSlots = [...value.slots].sort((left, right) => left.day - right.day);
  const hasFilledTime = sortedSlots.some(
    (slot) => slot.timeFrom.trim() !== '' || slot.timeTo.trim() !== '',
  );
  const canApplyToAll = showTime && !isDisabled && sortedSlots.length >= 2 && hasFilledTime;
  const preview = formatAvailability(value, { includeTime: showTime });

  const handleAgreementToggle = () => {
    onChange({ ...value, byAgreement: !value.byAgreement });
  };

  const handleDayToggle = (dayIndex: number) => {
    const next = toggleAvailabilityDay(value, dayIndex);
    onChange(showTime ? next : stripAvailabilityTimes(next));
  };

  return (
    <View style={[styles.wrapper, !showDayLabels && !showTime && { gap: Spacing.sm }]}>
      <View style={[styles.daysBlock, !showDayLabels && { gap: Spacing.xs }]}>
        {showDayLabels ? (
          <>
            <Text style={styles.blockLabel}>{EXPERIENCE_STEP.availabilityDaysLabel}</Text>
            <Text style={styles.blockHint}>{EXPERIENCE_STEP.availabilityDaysHint}</Text>
          </>
        ) : null}

        <View style={styles.daysRow}>
          {WEEKDAY_OPTIONS.map((day) => {
            const isSelected = selectedDays.includes(day.index);

            return (
              <Pressable
                key={day.index}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: isSelected, disabled: isDisabled }}
                disabled={isDisabled}
                onPress={() => handleDayToggle(day.index)}
                style={({ pressed }) => [
                  styles.dayChip,
                  isSelected && styles.dayChipSelected,
                  isDisabled && styles.dayChipDisabled,
                  pressed && !isDisabled && styles.dayChipPressed,
                ]}>
                <Text
                  style={[styles.dayChipLabel, isSelected && styles.dayChipLabelSelected]}
                  numberOfLines={1}>
                  {day.short}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      {showTime && sortedSlots.length > 0 ? (
        <View style={[styles.timeBlock, isDisabled && styles.timeCardDisabled]}>
          <View style={styles.timeBlockHeader}>
            <Text style={styles.timeTitle}>{EXPERIENCE_STEP.availabilityTimeLabel}</Text>
            {canApplyToAll ? (
              <Pressable
                accessibilityRole="button"
                onPress={() => onChange(applyAvailabilityTimeToAll(value))}
                style={({ pressed }) => [
                  styles.applyAllButton,
                  pressed && styles.applyAllPressed,
                ]}>
                <Text style={styles.applyAllLabel}>
                  {EXPERIENCE_STEP.availabilityApplyToAllLabel}
                </Text>
              </Pressable>
            ) : null}
          </View>

          <View style={styles.slotList}>
            {sortedSlots.map((slot) => {
              const dayLabel =
                WEEKDAY_OPTIONS.find((day) => day.index === slot.day)?.short ?? String(slot.day);

              return (
                <View key={slot.day} style={styles.slotRow}>
                  <View style={styles.slotDayBadge}>
                    <Text style={styles.slotDayLabel}>{dayLabel}</Text>
                  </View>

                  <View style={styles.slotTimes}>
                    <View style={styles.timeField}>
                      <Text style={styles.timeLabel}>{EXPERIENCE_STEP.availabilityFromLabel}</Text>
                      <TextInput
                        editable={!isDisabled}
                        value={slot.timeFrom}
                        onChangeText={(timeFrom) =>
                          onChange(
                            updateAvailabilityDayTime(value, slot.day, {
                              timeFrom: formatAvailabilityTimeInput(timeFrom),
                            }),
                          )
                        }
                        onBlur={() => {
                          const completed = completeAvailabilityTime(slot.timeFrom);
                          if (completed !== slot.timeFrom) {
                            onChange(
                              updateAvailabilityDayTime(value, slot.day, {
                                timeFrom: completed,
                              }),
                            );
                          }
                        }}
                        placeholder={EXPERIENCE_STEP.availabilityTimePlaceholder}
                        placeholderTextColor={colors.textMuted}
                        keyboardType="number-pad"
                        maxLength={5}
                        style={styles.timeInput}
                      />
                    </View>

                    <Text style={styles.timeDivider}>—</Text>

                    <View style={styles.timeField}>
                      <Text style={styles.timeLabel}>{EXPERIENCE_STEP.availabilityToLabel}</Text>
                      <TextInput
                        editable={!isDisabled}
                        value={slot.timeTo}
                        onChangeText={(timeTo) =>
                          onChange(
                            updateAvailabilityDayTime(value, slot.day, {
                              timeTo: formatAvailabilityTimeInput(timeTo),
                            }),
                          )
                        }
                        onBlur={() => {
                          const completed = completeAvailabilityTime(slot.timeTo);
                          if (completed !== slot.timeTo) {
                            onChange(
                              updateAvailabilityDayTime(value, slot.day, {
                                timeTo: completed,
                              }),
                            );
                          }
                        }}
                        placeholder={EXPERIENCE_STEP.availabilityTimePlaceholder}
                        placeholderTextColor={colors.textMuted}
                        keyboardType="number-pad"
                        maxLength={5}
                        style={styles.timeInput}
                      />
                    </View>
                  </View>
                </View>
              );
            })}
          </View>
        </View>
      ) : null}

      <Pressable
        accessibilityRole="checkbox"
        accessibilityState={{ checked: value.byAgreement }}
        onPress={handleAgreementToggle}
        style={({ pressed }) => [
          styles.agreementCard,
          value.byAgreement && styles.agreementCardActive,
          pressed && styles.agreementCardPressed,
        ]}>
        <View style={[styles.agreementIconWrap, value.byAgreement && styles.agreementIconWrapActive]}>
          <Ionicons
            name="chatbubbles-outline"
            size={20}
            color={value.byAgreement ? colors.onPrimary : colors.primary}
          />
        </View>
        <View style={styles.agreementBody}>
          <Text style={styles.agreementLabel}>{EXPERIENCE_STEP.availabilityAgreementLabel}</Text>
          <Text style={styles.agreementHint}>{EXPERIENCE_STEP.availabilityAgreementHint}</Text>
        </View>
        <Ionicons
          name={value.byAgreement ? 'checkmark-circle' : 'ellipse-outline'}
          size={22}
          color={value.byAgreement ? colors.primary : colors.textSubtle}
        />
      </Pressable>

      {preview && !value.byAgreement ? <Text style={styles.preview}>{preview}</Text> : null}
    </View>
  );
}
