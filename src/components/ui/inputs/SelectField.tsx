import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
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

export type SelectOption = {
  id: string;
  label: string;
};

type SelectFieldProps = {
  label: string;
  hint?: string;
  labelHint?: string;
  placeholder?: string;
  value: string | null;
  options: SelectOption[];
  onChange: (value: string | null) => void;
  error?: string;
  style?: ViewStyle;
};

const DESKTOP_SHEET_MAX_WIDTH = 420;

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
      maxWidth: '100%',
    },
    label: {
      fontSize: FontSize.label,
      color: colors.textMuted,
      flexShrink: 1,
    },
    hint: {
      fontSize: FontSize.caption,
      color: colors.textSubtle,
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
    optionsScroll: {
      flexGrow: 0,
    },
    optionsScrollContent: {
      paddingBottom: Spacing.sm,
    },
    option: {
      paddingHorizontal: Spacing.lg,
      paddingVertical: isDesktopWeb ? 14 : Spacing.md,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: Spacing.md,
    },
    optionPressed: {
      backgroundColor: colors.surfaceMuted,
    },
    optionLabel: {
      flex: 1,
      fontSize: FontSize.input,
      color: colors.text,
    },
    optionLabelSelected: {
      color: colors.primary,
      fontWeight: '600',
    },
  });
}

export function SelectField({
  label,
  hint,
  labelHint,
  placeholder = 'Выберите',
  value,
  options,
  onChange,
  error,
  style,
}: SelectFieldProps) {
  const colors = useTheme();
  const isDesktopWeb = useIsDesktopWeb();
  const styles = useThemedStyles((themeColors) => createStyles(themeColors, isDesktopWeb));
  const [isOpen, setIsOpen] = useState(false);

  const selectedLabel = options.find((option) => option.id === value)?.label;
  const close = () => setIsOpen(false);

  return (
    <View style={[styles.wrapper, style]}>
      <View style={styles.labelRow}>
        <Text style={styles.label}>{label}</Text>
        {labelHint ? <FieldLabelHint text={labelHint} /> : null}
        {hint ? <Text style={styles.hint}>{hint}</Text> : null}
      </View>

      <Pressable
        accessibilityRole="button"
        onPress={() => setIsOpen(true)}
        style={({ pressed }) => [
          styles.trigger,
          error ? styles.triggerError : null,
          pressed && styles.triggerPressed,
        ]}>
        <Text style={[styles.value, !selectedLabel && styles.placeholder]} numberOfLines={1}>
          {selectedLabel ?? placeholder}
        </Text>
        <Ionicons name="chevron-down" size={18} color={colors.textMuted} />
      </Pressable>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <Modal
        visible={isOpen}
        transparent
        animationType={isDesktopWeb ? 'fade' : 'slide'}
        onRequestClose={close}>
        <View style={styles.modalBackdrop}>
          <Pressable style={StyleSheet.absoluteFill} onPress={close} accessibilityRole="button" />
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{label}</Text>
              <Pressable accessibilityRole="button" onPress={close} hitSlop={8}>
                <Ionicons name="close" size={22} color={colors.textMuted} />
              </Pressable>
            </View>

            <ScrollView
              keyboardShouldPersistTaps="handled"
              bounces={false}
              style={styles.optionsScroll}
              contentContainerStyle={styles.optionsScrollContent}>
              {options.map((option) => {
                const isSelected = option.id === value;

                return (
                  <Pressable
                    key={option.id}
                    accessibilityRole="button"
                    onPress={() => {
                      onChange(option.id);
                      close();
                    }}
                    style={({ pressed }) => [styles.option, pressed && styles.optionPressed]}>
                    <Text
                      style={[styles.optionLabel, isSelected && styles.optionLabelSelected]}
                      numberOfLines={2}>
                      {option.label}
                    </Text>
                    {isSelected ? (
                      <Ionicons name="checkmark" size={20} color={colors.primary} />
                    ) : null}
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}
