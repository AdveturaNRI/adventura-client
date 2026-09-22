import { Platform, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useIsDesktopWeb } from '@/components/navigation/DesktopThemeToggle';
import { FontSize, Spacing, type ThemeColors } from '@/constants/theme';
import { useThemedStyles } from '@/hooks/use-themed-styles';

const MOBILE_HEADER_HEIGHT = 44;
export const DESKTOP_CONTENT_MAX_WIDTH = 720;
export const DESKTOP_MAP_RAIL_WIDTH = 200;
const GREETING_BLOCK_HEIGHT = 32;
export const MOBILE_CONTENT_MAX_WIDTH = 520;

export function getQuestionnaireColumnWidth(shellWidth: number, isDesktopWeb: boolean) {
  if (shellWidth <= 0) {
    return null;
  }

  const cap = isDesktopWeb ? DESKTOP_CONTENT_MAX_WIDTH : MOBILE_CONTENT_MAX_WIDTH;
  return Math.min(shellWidth, cap);
}

export function createQuestionnaireScreenStyles(
  colors: ThemeColors,
  topPadding: number,
  bottomPadding: number,
  footerPaddingBottom: number,
) {
  return StyleSheet.create({
    shell: {
      flex: 1,
      minHeight: 0,
      minWidth: 0,
      width: '100%',
      alignItems: 'center',
      overflow: 'hidden',
      position: 'relative',
      backgroundColor: colors.background,
      ...(Platform.OS === 'web' ? ({ overflowX: 'hidden' } as object) : null),
    },
    scroll: {
      flex: 1,
      minHeight: 0,
      minWidth: 0,
      width: '100%',
      alignSelf: 'stretch',
      backgroundColor: colors.background,
      ...(Platform.OS === 'web' ? ({ overflowX: 'hidden' } as object) : null),
    },
    scrollContent: {
      flexGrow: 1,
      width: '100%',
      minWidth: 0,
      paddingTop: topPadding,
      paddingBottom: bottomPadding,
      alignItems: 'center',
    },
    page: {
      width: '100%',
      minWidth: 0,
      alignItems: 'center',
    },
    pageWithMap: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      justifyContent: 'center',
      gap: Spacing.md,
      paddingHorizontal: Spacing.lg,
      maxWidth: DESKTOP_CONTENT_MAX_WIDTH + DESKTOP_MAP_RAIL_WIDTH + Spacing.md + Spacing.lg * 2,
    },
    mapAside: {
      width: DESKTOP_MAP_RAIL_WIDTH,
      flexShrink: 0,
      paddingTop: GREETING_BLOCK_HEIGHT,
    },
    content: {
      minWidth: 0,
      paddingHorizontal: Spacing.lg,
    },
    contentWithMap: {
      flex: 1,
      maxWidth: DESKTOP_CONTENT_MAX_WIDTH,
    },
    greeting: {
      fontSize: FontSize.label,
      color: colors.textMuted,
      marginBottom: Spacing.sm,
    },
    title: {
      fontSize: FontSize.h1,
      fontWeight: '700',
      color: colors.text,
      lineHeight: FontSize.h1 * 1.2,
      maxWidth: '100%',
    },
    subtitle: {
      marginTop: Spacing.sm,
      fontSize: FontSize.label,
      color: colors.textMuted,
      lineHeight: FontSize.label * 1.5,
      maxWidth: '100%',
    },
    stepBody: {
      marginTop: Spacing.lg,
      gap: Spacing.lg,
      width: '100%',
      maxWidth: '100%',
      minWidth: 0,
    },
    options: {
      gap: Spacing.sm,
    },
    footer: {
      marginTop: Spacing.xl,
      gap: Spacing.sm,
    },
    stickyFooter: {
      minWidth: 0,
      paddingHorizontal: Spacing.lg,
      paddingTop: Spacing.md,
      paddingBottom: footerPaddingBottom,
      gap: Spacing.sm,
      borderTopWidth: 1,
      borderTopColor: colors.borderLight,
      backgroundColor: colors.background,
    },
  });
}

export function useQuestionnaireScreenStyles() {
  const insets = useSafeAreaInsets();
  const isDesktopWeb = useIsDesktopWeb();
  const topPadding = isDesktopWeb
    ? Spacing.lg
    : insets.top + Spacing.sm + MOBILE_HEADER_HEIGHT + Spacing.sm;
  const footerPaddingBottom = Math.max(insets.bottom, Spacing.md) + Spacing.sm;
  const bottomPadding = Spacing.lg;

  return useThemedStyles((colors) =>
    createQuestionnaireScreenStyles(colors, topPadding, bottomPadding, footerPaddingBottom),
  );
}
