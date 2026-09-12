import { Ionicons } from '@expo/vector-icons';
import { Platform, Pressable, StyleSheet, useWindowDimensions } from 'react-native';

import { type ThemeColors } from '@/constants/theme';
import { useThemePreference } from '@/hooks/use-theme';
import { useThemedStyles } from '@/hooks/use-themed-styles';

const DESKTOP_MIN_WIDTH = 768;
const DESKTOP_SIDEBAR_MIN_WIDTH = 1024;

export function useIsDesktopWeb(): boolean {
  const { width } = useWindowDimensions();
  return Platform.OS === 'web' && width >= DESKTOP_MIN_WIDTH;
}

export function useIsDesktopSidebarVisible(): boolean {
  const { width } = useWindowDimensions();
  return Platform.OS === 'web' && width >= DESKTOP_SIDEBAR_MIN_WIDTH;
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    button: {
      width: 44,
      height: 44,
      borderRadius: 22,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.borderLight,
      shadowColor: colors.shadow,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.1,
      shadowRadius: 12,
      elevation: 4,
    },
    pressed: {
      opacity: 0.85,
    },
  });
}

export function ThemeToggle() {
  const { colorScheme, setPreference } = useThemePreference();
  const styles = useThemedStyles(createStyles);

  const isDark = colorScheme === 'dark';

  const handlePress = () => {
    setPreference(isDark ? 'light' : 'dark');
  };

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={isDark ? 'Включить светлую тему' : 'Включить тёмную тему'}
      onPress={handlePress}
      style={({ pressed }) => [styles.button, pressed && styles.pressed]}>
      <Ionicons name={isDark ? 'sunny' : 'moon'} size={22} color={isDark ? '#FF9F0A' : '#8E8E93'} />
    </Pressable>
  );
}

/** @deprecated Используйте ThemeToggle — переключатель доступен на всех платформах. */
export function DesktopThemeToggle() {
  return <ThemeToggle />;
}
