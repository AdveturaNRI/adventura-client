import { StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useIsDesktopWeb } from '@/components/navigation/DesktopThemeToggle';
import { FontSize, Spacing, type ThemeColors } from '@/constants/theme';
import { useThemedStyles } from '@/hooks/use-themed-styles';

export function createMainScreenStyles(colors: ThemeColors, topPadding: number) {
  return StyleSheet.create({
    scroll: {
      flex: 1,
      backgroundColor: colors.background,
    },
    container: {
      flex: 1,
      backgroundColor: colors.background,
      paddingHorizontal: Spacing.lg,
      paddingTop: topPadding,
      gap: Spacing.md,
    },
    content: {
      paddingHorizontal: Spacing.lg,
      paddingTop: topPadding,
      paddingBottom: Spacing.xl,
      gap: Spacing.md,
    },
    title: {
      fontSize: FontSize.h1,
      fontWeight: '600',
      color: colors.text,
    },
    subtitle: {
      fontSize: FontSize.label,
      color: colors.textMuted,
    },
    list: {
      gap: Spacing.lg,
      paddingTop: Spacing.sm,
    },
    stateWrap: {
      paddingVertical: Spacing.xl,
      alignItems: 'center',
    },
    stateText: {
      fontSize: FontSize.label,
      color: colors.textMuted,
      lineHeight: FontSize.label * 1.5,
    },
  });
}

export function useMainScreenStyles() {
  const insets = useSafeAreaInsets();
  const isDesktopWeb = useIsDesktopWeb();
  const topPadding = isDesktopWeb ? Spacing.lg : insets.top + Spacing.md;

  return useThemedStyles((colors) => createMainScreenStyles(colors, topPadding));
}
