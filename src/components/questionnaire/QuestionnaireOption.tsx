import type { ComponentProps } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { FontSize, Spacing, type ThemeColors } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useThemedStyles } from '@/hooks/use-themed-styles';

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    option: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.md,
      padding: Spacing.md,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.borderLight,
      backgroundColor: colors.surface,
    },
    optionSelected: {
      borderColor: colors.primary,
      backgroundColor: colors.surfaceMuted,
    },
    optionPressed: {
      opacity: 0.9,
    },
    iconWrap: {
      width: 44,
      height: 44,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.menuIconBg,
    },
    iconWrapSelected: {
      backgroundColor: colors.primary,
    },
    body: {
      flex: 1,
      gap: Spacing.xs,
    },
    label: {
      fontSize: FontSize.button,
      fontWeight: '600',
      color: colors.text,
    },
    labelSelected: {
      color: colors.primary,
    },
    description: {
      fontSize: FontSize.caption,
      color: colors.textMuted,
      lineHeight: FontSize.caption * 1.45,
    },
    check: {
      width: 24,
      alignItems: 'center',
    },
  });
}

type QuestionnaireOptionProps = {
  label: string;
  description: string;
  icon: ComponentProps<typeof Ionicons>['name'];
  selected: boolean;
  onPress: () => void;
};

export function QuestionnaireOption({
  label,
  description,
  icon,
  selected,
  onPress,
}: QuestionnaireOptionProps) {
  const colors = useTheme();
  const styles = useThemedStyles(createStyles);

  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.option,
        selected && styles.optionSelected,
        pressed && styles.optionPressed,
      ]}>
      <View style={[styles.iconWrap, selected && styles.iconWrapSelected]}>
        <Ionicons name={icon} size={22} color={colors.onPrimary} />
      </View>
      <View style={styles.body}>
        <Text style={[styles.label, selected && styles.labelSelected]}>{label}</Text>
        <Text style={styles.description}>{description}</Text>
      </View>
      <View style={styles.check}>
        <Ionicons
          name={selected ? 'radio-button-on' : 'radio-button-off'}
          size={22}
          color={selected ? colors.primary : colors.textSubtle}
        />
      </View>
    </Pressable>
  );
}
