import { Ionicons } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type ViewStyle,
} from 'react-native';

import { FieldLabelHint } from '@/components/ui/inputs/FieldLabelHint';
import { useIsDesktopWeb } from '@/components/navigation/DesktopThemeToggle';
import { FontSize, Radius, Sizes, Spacing, type ThemeColors } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useThemedStyles } from '@/hooks/use-themed-styles';
import {
  DEFAULT_TIMEZONE,
  formatTimezoneLabel,
  formatTimezoneOffset,
  formatTimezoneSubtitle,
  searchTimezones,
} from '@/utils/timezones';

type TimezoneFieldProps = {
  label: string;
  labelHint?: string;
  placeholder?: string;
  value: string;
  onChange: (timezone: string) => void;
  error?: string;
  style?: ViewStyle;
};

const DESKTOP_SHEET_MAX_WIDTH = 460;

function createStyles(colors: ThemeColors, isDesktopWeb: boolean) {
  return StyleSheet.create({
    wrapper: {
      gap: Spacing.sm,
      width: '100%',
      maxWidth: '100%',
      minWidth: 0,
    },
    labelRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      alignItems: 'center',
      gap: Spacing.xs,
      paddingLeft: Spacing.xs,
    },
    label: {
      fontSize: FontSize.label,
      color: colors.textMuted,
    },
    trigger: {
      minHeight: Sizes.controlHeight,
      width: '100%',
      maxWidth: '100%',
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
    triggerError: {
      borderColor: colors.destructive,
    },
    triggerPressed: {
      opacity: 0.9,
    },
    value: {
      flex: 1,
      minWidth: 0,
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
      backgroundColor: 'rgba(0,0,0,0.4)',
      justifyContent: isDesktopWeb ? 'center' : 'flex-end',
      alignItems: 'center',
      padding: isDesktopWeb ? Spacing.lg : 0,
    },
    modalSheet: {
      width: '100%',
      maxWidth: isDesktopWeb ? DESKTOP_SHEET_MAX_WIDTH : undefined,
      maxHeight: isDesktopWeb ? '82%' : '90%',
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      borderBottomLeftRadius: isDesktopWeb ? 20 : 0,
      borderBottomRightRadius: isDesktopWeb ? 20 : 0,
      backgroundColor: colors.surface,
      overflow: 'hidden',
    },
    sheetHandle: {
      alignSelf: 'center',
      width: 36,
      height: 4,
      borderRadius: 2,
      backgroundColor: colors.borderLight,
      marginTop: Spacing.sm,
      marginBottom: Spacing.xs,
    },
    modalHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: Spacing.lg,
      paddingTop: isDesktopWeb ? Spacing.md : Spacing.xs,
      paddingBottom: Spacing.sm,
      gap: Spacing.sm,
    },
    modalTitle: {
      flex: 1,
      fontSize: FontSize.button,
      fontWeight: '700',
      color: colors.text,
    },
    searchBlock: {
      paddingHorizontal: Spacing.lg,
      paddingBottom: Spacing.sm,
      gap: 6,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.borderLight,
    },
    searchLabel: {
      fontSize: FontSize.caption,
      fontWeight: '600',
      color: colors.textMuted,
    },
    searchWrap: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 14,
      paddingHorizontal: Spacing.md,
      minHeight: 48,
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.sm,
      backgroundColor: colors.surface,
    },
    searchInput: {
      flex: 1,
      fontSize: FontSize.input,
      color: colors.text,
      paddingVertical: Spacing.sm,
    },
    list: {
      flexGrow: 0,
    },
    option: {
      paddingHorizontal: Spacing.lg,
      paddingVertical: 12,
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.md,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.borderLight,
    },
    optionSelected: {
      backgroundColor: 'rgba(21, 122, 254, 0.08)',
    },
    optionPressed: {
      backgroundColor: 'rgba(21, 122, 254, 0.06)',
    },
    offsetBadge: {
      minWidth: 64,
      paddingHorizontal: 8,
      paddingVertical: 6,
      borderRadius: 10,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'rgba(21, 122, 254, 0.12)',
    },
    offsetBadgeSelected: {
      backgroundColor: colors.primary,
    },
    offsetBadgeText: {
      fontSize: 12,
      fontWeight: '700',
      color: colors.primary,
    },
    offsetBadgeTextSelected: {
      color: colors.onPrimary,
    },
    optionCopy: {
      flex: 1,
      minWidth: 0,
      gap: 2,
    },
    optionLabel: {
      fontSize: FontSize.label,
      color: colors.text,
      fontWeight: '600',
    },
    optionLabelSelected: {
      color: colors.primary,
    },
    optionSubtitle: {
      fontSize: FontSize.caption,
      color: colors.textMuted,
    },
    empty: {
      paddingHorizontal: Spacing.lg,
      paddingVertical: Spacing.xl,
      alignItems: 'center',
      gap: Spacing.sm,
    },
    emptyText: {
      fontSize: FontSize.caption,
      color: colors.textMuted,
      textAlign: 'center',
      lineHeight: FontSize.caption * 1.45,
    },
  });
}

export function TimezoneField({
  label,
  labelHint,
  placeholder = 'Выберите часовой пояс',
  value,
  onChange,
  error,
  style,
}: TimezoneFieldProps) {
  const colors = useTheme();
  const isDesktopWeb = useIsDesktopWeb();
  const styles = useThemedStyles((themeColors) => createStyles(themeColors, isDesktopWeb));
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');

  const selectedLabel = formatTimezoneLabel(value || DEFAULT_TIMEZONE);
  const results = useMemo(() => searchTimezones(query), [query]);

  const close = () => {
    setIsOpen(false);
    setQuery('');
  };

  return (
    <View style={[styles.wrapper, style]}>
      <View style={styles.labelRow}>
        <Text style={styles.label}>{label}</Text>
        {labelHint ? <FieldLabelHint text={labelHint} /> : null}
      </View>

      <Pressable
        accessibilityRole="button"
        onPress={() => setIsOpen(true)}
        style={({ pressed }) => [
          styles.trigger,
          error ? styles.triggerError : null,
          pressed && styles.triggerPressed,
        ]}>
        <Text style={[styles.value, !value && styles.placeholder]} numberOfLines={1}>
          {value ? selectedLabel : placeholder}
        </Text>
        <Ionicons name="chevron-down" size={18} color={colors.textMuted} />
      </Pressable>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <Modal
        visible={isOpen}
        transparent
        animationType={isDesktopWeb ? 'fade' : 'slide'}
        onRequestClose={close}>
        <Pressable style={styles.modalBackdrop} onPress={close}>
          <Pressable style={styles.modalSheet} onPress={(event) => event.stopPropagation()}>
            {!isDesktopWeb ? <View style={styles.sheetHandle} /> : null}

            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{label}</Text>
              <Pressable accessibilityRole="button" onPress={close} hitSlop={8}>
                <Ionicons name="close" size={22} color={colors.textMuted} />
              </Pressable>
            </View>

            <View style={styles.searchBlock}>
              <Text style={styles.searchLabel}>Поиск</Text>
              <View style={styles.searchWrap}>
                <Ionicons name="search-outline" size={18} color={colors.primary} />
                <TextInput
                  value={query}
                  onChangeText={setQuery}
                  placeholder="Например: московское, Урал, UTC+5"
                  placeholderTextColor={colors.textMuted}
                  style={styles.searchInput}
                  autoCapitalize="none"
                  autoCorrect={false}
                  clearButtonMode="while-editing"
                />
                {query ? (
                  <Pressable accessibilityRole="button" onPress={() => setQuery('')} hitSlop={8}>
                    <Ionicons name="close-circle" size={18} color={colors.textMuted} />
                  </Pressable>
                ) : null}
              </View>
            </View>

            <ScrollView
              style={styles.list}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}>
              {results.length === 0 ? (
                <View style={styles.empty}>
                  <Ionicons name="globe-outline" size={28} color={colors.primary} />
                  <Text style={styles.emptyText}>
                    Ничего не нашлось. Попробуйте «московское», город или UTC+3.
                  </Text>
                </View>
              ) : (
                results.map((option) => {
                  const isSelected = option.id === value;
                  const offset = formatTimezoneOffset(option.id);

                  return (
                    <Pressable
                      key={option.id}
                      accessibilityRole="button"
                      onPress={() => {
                        onChange(option.id);
                        close();
                      }}
                      style={({ pressed }) => [
                        styles.option,
                        isSelected && styles.optionSelected,
                        pressed && styles.optionPressed,
                      ]}>
                      <View
                        style={[styles.offsetBadge, isSelected && styles.offsetBadgeSelected]}>
                        <Text
                          style={[
                            styles.offsetBadgeText,
                            isSelected && styles.offsetBadgeTextSelected,
                          ]}>
                          {offset}
                        </Text>
                      </View>
                      <View style={styles.optionCopy}>
                        <Text
                          style={[
                            styles.optionLabel,
                            isSelected && styles.optionLabelSelected,
                          ]}
                          numberOfLines={2}>
                          {option.name}
                        </Text>
                        <Text style={styles.optionSubtitle} numberOfLines={1}>
                          {formatTimezoneSubtitle(option.id)}
                        </Text>
                      </View>
                      {isSelected ? (
                        <Ionicons name="checkmark-circle" size={20} color={colors.primary} />
                      ) : null}
                    </Pressable>
                  );
                })
              )}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}
