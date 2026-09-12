import { Pressable, StyleSheet, Text, View, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { NavbarIcon } from './NavbarIcon';
import { type NavbarItem } from './navbar.config';
import { FontSize, Spacing, type ThemeColors } from '@/constants/theme';
import { useThemedStyles } from '@/hooks/use-themed-styles';

export type NavbarProps = {
  items: NavbarItem[];
  value: string;
  onChange: (key: string) => void;
  style?: ViewStyle;
};

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: {
      flexDirection: 'row',
      alignItems: 'stretch',
      borderTopWidth: 1,
      borderTopColor: colors.border,
      backgroundColor: colors.surface,
      paddingTop: Spacing.sm,
      paddingHorizontal: Spacing.xs,
    },
    item: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      gap: Spacing.xs,
      paddingVertical: Spacing.xs,
    },
    itemPressed: {
      opacity: 0.75,
    },
    label: {
      fontSize: FontSize.caption,
      fontWeight: '500',
      color: colors.textMuted,
    },
    labelActive: {
      color: colors.primary,
      fontWeight: '600',
    },
  });
}

export function Navbar({ items, value, onChange, style }: NavbarProps) {
  const insets = useSafeAreaInsets();
  const styles = useThemedStyles(createStyles);

  return (
    <View style={[styles.container, { paddingBottom: Math.max(insets.bottom, Spacing.sm) }, style]}>
      {items.map((item) => {
        const isActive = item.key === value;

        return (
          <Pressable
            key={item.key}
            onPress={() => onChange(item.key)}
            style={({ pressed }) => [styles.item, pressed && styles.itemPressed]}
            accessibilityRole="tab"
            accessibilityState={{ selected: isActive }}
            accessibilityLabel={item.label}>
            <NavbarIcon name={item.icon} active={isActive} />
            <Text style={[styles.label, isActive && styles.labelActive]}>{item.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}
