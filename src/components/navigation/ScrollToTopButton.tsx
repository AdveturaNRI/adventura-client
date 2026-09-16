import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useIsDesktopWeb } from '@/components/navigation/DesktopThemeToggle';
import { Spacing, type ThemeColors } from '@/constants/theme';
import { useThemedStyles } from '@/hooks/use-themed-styles';

const SHOW_AFTER_Y = 320;

type ScrollToTopButtonProps = {
  visible: boolean;
  onPress: () => void;
};

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    wrap: {
      position: 'absolute',
      right: Spacing.md,
      zIndex: 20,
      elevation: 20,
    },
    button: {
      width: 44,
      height: 44,
      borderRadius: 22,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.primary,
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.22)',
      shadowColor: colors.shadow,
      shadowOpacity: 0.22,
      shadowRadius: 10,
      shadowOffset: { width: 0, height: 4 },
    },
  });
}

/** Мобильная кнопка «наверх» — справа снизу, поверх скролла. */
export function ScrollToTopButton({ visible, onPress }: ScrollToTopButtonProps) {
  const isDesktopWeb = useIsDesktopWeb();
  const insets = useSafeAreaInsets();
  const styles = useThemedStyles(createStyles);

  if (isDesktopWeb || !visible) {
    return null;
  }

  return (
    <View
      pointerEvents="box-none"
      style={[styles.wrap, { bottom: Math.max(insets.bottom, Spacing.sm) + Spacing.lg }]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Наверх"
        onPress={onPress}
        style={({ pressed }) => [styles.button, pressed && { opacity: 0.88 }]}>
        <Ionicons name="chevron-up" size={22} color="#FFFFFF" />
      </Pressable>
    </View>
  );
}

export function shouldShowScrollToTop(offsetY: number): boolean {
  return offsetY > SHOW_AFTER_Y;
}
