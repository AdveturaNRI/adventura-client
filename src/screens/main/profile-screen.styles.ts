import { StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useIsDesktopWeb } from '@/components/navigation/DesktopThemeToggle';
import { FontSize, Spacing, type ThemeColors } from '@/constants/theme';
import { useThemedStyles } from '@/hooks/use-themed-styles';

const DESKTOP_CONTENT_MAX_WIDTH = 720;

export function createProfileScreenStyles(colors: ThemeColors, topPadding: number, isDesktopWeb: boolean) {
  return StyleSheet.create({
    scroll: {
      flex: 1,
      backgroundColor: colors.background,
    },
    content: {
      width: '100%',
      maxWidth: isDesktopWeb ? DESKTOP_CONTENT_MAX_WIDTH : undefined,
      alignSelf: isDesktopWeb ? 'center' : undefined,
      paddingHorizontal: Spacing.lg,
      paddingTop: topPadding,
      paddingBottom: Spacing.xl,
      gap: Spacing.lg,
    },
    title: {
      fontSize: FontSize.h1,
      fontWeight: '600',
      color: colors.text,
    },
    logoutButton: {
      flexShrink: 0,
      minHeight: isDesktopWeb ? 40 : 48,
      paddingHorizontal: Spacing.md,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: colors.destructive,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.surface,
    },
    logoutButtonMobile: {
      alignSelf: 'stretch',
      marginTop: Spacing.sm,
    },
    logoutButtonPressed: {
      opacity: 0.85,
      backgroundColor: colors.surfaceMuted,
    },
    logoutLabel: {
      fontSize: FontSize.label,
      fontWeight: '600',
      color: colors.destructive,
    },
    sectionCard: {
      padding: Spacing.lg,
      borderRadius: 24,
      borderWidth: 1,
      borderColor: colors.borderLight,
      backgroundColor: colors.surface,
    },
  });
}

export function useProfileScreenStyles() {
  const insets = useSafeAreaInsets();
  const isDesktopWeb = useIsDesktopWeb();
  const topPadding = isDesktopWeb ? Spacing.lg : insets.top + Spacing.md;

  return useThemedStyles((colors) => createProfileScreenStyles(colors, topPadding, isDesktopWeb));
}
