import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { useIsDesktopWeb } from '@/components/navigation/DesktopThemeToggle';
import { FontSize, Spacing, type ThemeColors } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useThemedStyles } from '@/hooks/use-themed-styles';
import { DAY_LABELS, type ClubScheduleDay } from '@/services/clubs/clubsApi';

const WEEK_DAYS = [1, 2, 3, 4, 5, 6, 7] as const;

function formatTimeInput(raw: string) {
  const digits = raw.replace(/\D/g, '').slice(0, 4);
  if (digits.length <= 2) {
    return digits;
  }
  return `${digits.slice(0, 2)}:${digits.slice(2)}`;
}

function completeTime(value: string) {
  const trimmed = value.trim();
  if (/^\d{2}:\d{2}$/.test(trimmed)) {
    return trimmed;
  }
  const digits = trimmed.replace(/\D/g, '');
  if (digits.length === 3) {
    return `0${digits[0]}:${digits.slice(1)}`;
  }
  if (digits.length === 4) {
    return `${digits.slice(0, 2)}:${digits.slice(2)}`;
  }
  return trimmed;
}

function createStyles(colors: ThemeColors, isDesktopWeb: boolean) {
  return StyleSheet.create({
    wrapper: {
      gap: Spacing.md,
      width: '100%',
    },
    daysBlock: {
      gap: Spacing.sm,
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
    },
    dayChip: {
      flex: 1,
      minWidth: isDesktopWeb ? 44 : 40,
      height: 44,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.surface,
    },
    dayChipSelected: {
      borderColor: colors.primary,
      backgroundColor: colors.primary,
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
    toolbar: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: Spacing.sm,
      paddingLeft: Spacing.xs,
    },
    toolLink: {
      paddingVertical: 4,
      paddingHorizontal: Spacing.sm,
    },
    toolLinkLabel: {
      fontSize: FontSize.caption,
      fontWeight: '600',
      color: colors.primary,
    },
    toolLinkPressed: {
      opacity: 0.75,
    },
    timeBlock: {
      gap: Spacing.sm,
    },
    timeTitle: {
      fontSize: FontSize.label,
      fontWeight: '600',
      color: colors.text,
      paddingLeft: Spacing.xs,
    },
    slotList: {
      gap: Spacing.sm,
      flexDirection: isDesktopWeb ? 'row' : 'column',
      flexWrap: isDesktopWeb ? 'wrap' : 'nowrap',
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
      width: isDesktopWeb ? '48%' : '100%',
      flexGrow: isDesktopWeb ? 1 : undefined,
      minWidth: isDesktopWeb ? 280 : undefined,
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
    emptyHint: {
      fontSize: FontSize.caption,
      color: colors.textMuted,
      paddingLeft: Spacing.xs,
      lineHeight: FontSize.caption * 1.4,
    },
  });
}

type Props = {
  value: ClubScheduleDay[];
  onChange: (next: ClubScheduleDay[]) => void;
};

export function ClubScheduleEditor({ value, onChange }: Props) {
  const colors = useTheme();
  const isDesktopWeb = useIsDesktopWeb();
  const styles = useThemedStyles((themeColors) => createStyles(themeColors, isDesktopWeb));

  const workingDays = value.filter((day) => !day.closed).sort((a, b) => a.day - b.day);

  const updateDay = (day: number, patch: Partial<ClubScheduleDay>) => {
    onChange(
      value.map((item) => {
        if (item.day !== day) {
          return item;
        }
        const next = { ...item, ...patch };
        if (next.closed) {
          return { ...next, open: null, close: null };
        }
        return {
          ...next,
          open: next.open || '12:00',
          close: next.close || '22:00',
        };
      }),
    );
  };

  const toggleDay = (day: number) => {
    const current = value.find((item) => item.day === day);
    if (!current) {
      return;
    }
    updateDay(day, { closed: !current.closed });
  };

  const applyWeekdaysFromMonday = () => {
    const mon = value.find((d) => d.day === 1);
    if (!mon || mon.closed) {
      return;
    }
    onChange(
      value.map((item) =>
        item.day >= 1 && item.day <= 5
          ? { ...item, closed: false, open: mon.open, close: mon.close }
          : item,
      ),
    );
  };

  const markWeekendOff = () => {
    onChange(
      value.map((item) =>
        item.day >= 6 ? { ...item, closed: true, open: null, close: null } : item,
      ),
    );
  };

  const applyHoursToAllWorking = () => {
    const source = workingDays[0];
    if (!source?.open || !source.close) {
      return;
    }
    onChange(
      value.map((item) =>
        item.closed
          ? item
          : { ...item, open: source.open, close: source.close },
      ),
    );
  };

  return (
    <View style={styles.wrapper}>
      <View style={styles.daysBlock}>
        <Text style={styles.blockHint}>Нажмите дни, когда клуб открыт</Text>
        <View style={styles.daysRow}>
          {WEEK_DAYS.map((day) => {
            const item = value.find((entry) => entry.day === day);
            const isSelected = Boolean(item && !item.closed);

            return (
              <Pressable
                key={day}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: isSelected }}
                onPress={() => toggleDay(day)}
                style={({ pressed }) => [
                  styles.dayChip,
                  isSelected && styles.dayChipSelected,
                  pressed && styles.dayChipPressed,
                ]}>
                <Text
                  style={[styles.dayChipLabel, isSelected && styles.dayChipLabelSelected]}
                  numberOfLines={1}>
                  {DAY_LABELS[day]}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <View style={styles.toolbar}>
        <Pressable
          onPress={applyWeekdaysFromMonday}
          style={({ pressed }) => [styles.toolLink, pressed && styles.toolLinkPressed]}>
          <Text style={styles.toolLinkLabel}>Будни как в пн</Text>
        </Pressable>
        <Pressable
          onPress={markWeekendOff}
          style={({ pressed }) => [styles.toolLink, pressed && styles.toolLinkPressed]}>
          <Text style={styles.toolLinkLabel}>Сб–вс выходные</Text>
        </Pressable>
        {workingDays.length >= 2 ? (
          <Pressable
            onPress={applyHoursToAllWorking}
            style={({ pressed }) => [styles.toolLink, pressed && styles.toolLinkPressed]}>
            <Text style={styles.toolLinkLabel}>Одинаковые часы</Text>
          </Pressable>
        ) : null}
      </View>

      {workingDays.length ? (
        <View style={styles.timeBlock}>
          <Text style={styles.timeTitle}>Часы работы</Text>
          <View style={styles.slotList}>
            {workingDays.map((item) => (
              <View key={item.day} style={styles.slotRow}>
                <View style={styles.slotDayBadge}>
                  <Text style={styles.slotDayLabel}>{DAY_LABELS[item.day]}</Text>
                </View>
                <View style={styles.slotTimes}>
                  <View style={styles.timeField}>
                    <Text style={styles.timeLabel}>с</Text>
                    <TextInput
                      value={item.open ?? ''}
                      onChangeText={(open) => updateDay(item.day, { open: formatTimeInput(open) })}
                      onBlur={() =>
                        updateDay(item.day, { open: completeTime(item.open ?? '') })
                      }
                      placeholder="12:00"
                      placeholderTextColor={colors.textMuted}
                      keyboardType="number-pad"
                      maxLength={5}
                      style={styles.timeInput}
                    />
                  </View>
                  <Text style={styles.timeDivider}>—</Text>
                  <View style={styles.timeField}>
                    <Text style={styles.timeLabel}>до</Text>
                    <TextInput
                      value={item.close ?? ''}
                      onChangeText={(close) =>
                        updateDay(item.day, { close: formatTimeInput(close) })
                      }
                      onBlur={() =>
                        updateDay(item.day, { close: completeTime(item.close ?? '') })
                      }
                      placeholder="22:00"
                      placeholderTextColor={colors.textMuted}
                      keyboardType="number-pad"
                      maxLength={5}
                      style={styles.timeInput}
                    />
                  </View>
                </View>
              </View>
            ))}
          </View>
        </View>
      ) : (
        <Text style={styles.emptyHint}>Выберите хотя бы один рабочий день</Text>
      )}
    </View>
  );
}
