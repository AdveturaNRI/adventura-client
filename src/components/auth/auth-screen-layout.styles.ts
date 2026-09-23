import { type ReactNode } from 'react';
import { Platform, StyleSheet, type ViewStyle } from 'react-native';

import { Spacing, type ThemeColors } from '@/constants/theme';

export type AuthScreenLayoutProps = {
  children: ReactNode;
  contentStyle?: ViewStyle;
};

/** Below this viewport height the auth card uses denser spacing. */
export const AUTH_COMPACT_HEIGHT = 780;

const AUTH_CARD_MAX = 380;
const AUTH_CONTROL_HEIGHT = 44;
const AUTH_CONTROL_RADIUS = 14;

export function createAuthScreenLayoutStyles(
  colors: ThemeColors,
  isDesktop = false,
  compact = false,
) {
  const cardPadding = compact ? 18 : isDesktop ? 28 : 20;
  const cardGap = compact ? 12 : Spacing.md;
  const cardRadius = isDesktop ? 22 : 18;
  const isDark = colors.text === '#FFFFFF';

  return StyleSheet.create({
    root: {
      flex: 1,
      position: 'relative',
    },
    content: {
      flex: 1,
    },
    card: {
      width: '100%',
      maxWidth: AUTH_CARD_MAX,
      flexShrink: 0,
      gap: cardGap,
      padding: cardPadding,
      borderRadius: cardRadius,
      backgroundColor: isDark ? 'rgba(28, 28, 30, 0.86)' : 'rgba(255, 255, 255, 0.9)',
      borderWidth: 1,
      borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(255, 255, 255, 0.65)',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: isDesktop ? 18 : 10 },
      shadowOpacity: isDesktop ? 0.32 : 0.24,
      shadowRadius: isDesktop ? 40 : 28,
      elevation: isDesktop ? 14 : 8,
      ...(Platform.OS === 'web'
        ? ({
            backdropFilter: 'blur(28px) saturate(1.2)',
            WebkitBackdropFilter: 'blur(28px) saturate(1.2)',
            boxShadow: isDesktop
              ? '0 24px 64px rgba(0,0,0,0.38), 0 2px 0 rgba(255,255,255,0.35) inset'
              : '0 16px 40px rgba(0,0,0,0.3), 0 1px 0 rgba(255,255,255,0.3) inset',
          } as object)
        : null),
    },
    logoWrap: {
      alignItems: 'center',
      marginBottom: Spacing.sm,
    },
    scrollView: {
      flex: 1,
    },
    scrollContent: {
      alignItems: 'center',
      flexGrow: 1,
      justifyContent: 'center',
    },
    cardShell: {
      width: '100%',
      maxWidth: AUTH_CARD_MAX,
      alignSelf: 'center',
    },
    webOverlay: {
      flex: 1,
      zIndex: 1,
      width: '100%',
      justifyContent: 'center',
      alignItems: 'center',
    },
    webScrollView: {
      flex: 1,
      width: '100%',
    },
    webScrollContent: {
      flexGrow: 1,
      justifyContent: 'center',
      alignItems: 'center',
      minHeight: '100%',
    },
    webCardShell: {
      width: '100%',
      maxWidth: AUTH_CARD_MAX,
      alignSelf: 'center',
    },
    softField: {
      minHeight: AUTH_CONTROL_HEIGHT,
      borderRadius: AUTH_CONTROL_RADIUS,
      backgroundColor: isDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(21, 122, 254, 0.06)',
      borderColor: isDark ? 'rgba(255, 255, 255, 0.12)' : 'rgba(21, 122, 254, 0.16)',
    },
    authButton: {
      minHeight: AUTH_CONTROL_HEIGHT,
      borderRadius: AUTH_CONTROL_RADIUS,
      paddingVertical: 10,
    },
    authButtonGhost: {
      minHeight: AUTH_CONTROL_HEIGHT,
      borderRadius: AUTH_CONTROL_RADIUS,
      paddingVertical: 10,
      backgroundColor: isDark ? 'rgba(255, 255, 255, 0.04)' : 'rgba(255, 255, 255, 0.45)',
      borderColor: isDark ? 'rgba(255, 255, 255, 0.14)' : 'rgba(21, 122, 254, 0.18)',
    },
  });
}
