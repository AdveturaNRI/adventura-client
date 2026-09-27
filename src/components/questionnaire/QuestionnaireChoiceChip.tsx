import type { ComponentProps } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text } from 'react-native';

import { FontSize, Radius, Spacing, type ThemeColors } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useThemedStyles } from '@/hooks/use-themed-styles';

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    chip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      minHeight: 40,
      maxWidth: '100%',
      paddingHorizontal: Spacing.md,
      paddingVertical: 8,
      borderRadius: Radius.pill,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
    },
    chipSelected: {
      borderColor: 'rgba(21, 122, 254, 0.35)',
      backgroundColor: 'rgba(21, 122, 254, 0.12)',
    },
    label: {
      flexShrink: 1,
      fontSize: FontSize.label,
      fontWeight: '600',
      color: colors.textSecondary,
    },
    labelSelected: {
      color: colors.primary,
    },
  });
}

type QuestionnaireChoiceChipProps = {
  label: string;
  selected: boolean;
  onPress: () => void;
  icon?: ComponentProps<typeof Ionicons>['name'];
};

export function QuestionnaireChoiceChip({
  label,
  selected,
  onPress,
  icon,
}: QuestionnaireChoiceChipProps) {
  const colors = useTheme();
  const styles = useThemedStyles(createStyles);
  const iconColor = selected ? colors.primary : colors.textMuted;

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
      {icon ? <Ionicons name={icon} size={16} color={iconColor} /> : null}
      <Text style={[styles.label, selected && styles.labelSelected]}>{label}</Text>
    </Pressable>
  );
}
