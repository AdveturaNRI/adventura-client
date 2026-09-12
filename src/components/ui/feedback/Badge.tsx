import { Ionicons } from '@expo/vector-icons';
import { useMemo, type ComponentProps } from 'react';
import { Pressable, StyleSheet, Text, ViewStyle } from 'react-native';

import { getBadgeSpecs, type BadgeVariant } from './badge.config';
import { Spacing, type ThemeColors } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useThemedStyles } from '@/hooks/use-themed-styles';

type BadgeProps = {
  label: string;
  variant?: BadgeVariant;
  icon?: ComponentProps<typeof Ionicons>['name'];
  onPress?: () => void;
  style?: ViewStyle;
};

function createStyles(_colors: ThemeColors) {
  return StyleSheet.create({
    base: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 5,
      paddingVertical: Spacing.xs,
    },
    pressed: {
      opacity: 0.85,
    },
    label: {
      fontWeight: '500',
    },
  });
}

export function Badge({ label, variant = 'outline', icon, onPress, style }: BadgeProps) {
  const colors = useTheme();
  const styles = useThemedStyles(createStyles);
  const spec = useMemo(
    () => getBadgeSpecs(colors).find((item) => item.variant === variant)!,
    [colors, variant],
  );

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.base,
        {
          minHeight: spec.minHeight,
          borderRadius: spec.borderRadius,
          paddingHorizontal: spec.paddingHorizontal,
          backgroundColor: spec.backgroundColor === 'transparent' ? undefined : spec.backgroundColor,
          borderColor: spec.borderColor === 'transparent' ? undefined : spec.borderColor,
          borderWidth: spec.borderColor === 'transparent' ? 0 : 1,
        },
        pressed && onPress && styles.pressed,
        style,
      ]}>
      {icon ? <Ionicons name={icon} size={13} color={spec.textColor} /> : null}
      <Text
        style={[
          styles.label,
          {
            color: spec.textColor,
            fontSize: spec.fontSize,
          },
        ]}>
        {label}
      </Text>
    </Pressable>
  );
}
