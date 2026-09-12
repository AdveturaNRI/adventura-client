import { type ReactNode } from 'react';
import { StyleSheet, type ViewStyle } from 'react-native';

import { Layout, Spacing, type ThemeColors } from '@/constants/theme';

export type AuthScreenLayoutProps = {
  children: ReactNode;
  contentStyle?: ViewStyle;
};

export function createAuthScreenLayoutStyles(colors: ThemeColors) {
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
      maxWidth: Layout.maxContentWidth,
      flexShrink: 0,
      gap: Spacing.lg,
      padding: Spacing.lg,
      borderRadius: 24,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.borderLight,
      shadowColor: colors.shadow,
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.18,
      shadowRadius: 24,
      elevation: 8,
    },
    logoWrap: {
      alignItems: 'center',
      marginBottom: Spacing.xs,
    },
    scrollView: {
      flex: 1,
    },
    scrollContent: {
      alignItems: 'center',
    },
    cardShell: {
      width: '100%',
      maxWidth: Layout.maxContentWidth,
      alignSelf: 'center',
    },
    webOverlay: {
      flex: 1,
      zIndex: 1,
      width: '100%',
      justifyContent: 'center',
      alignItems: 'center',
      overflow: 'auto',
    },
    webCardShell: {
      width: '100%',
      maxWidth: Layout.maxContentWidth,
      alignSelf: 'center',
    },
  });
}
