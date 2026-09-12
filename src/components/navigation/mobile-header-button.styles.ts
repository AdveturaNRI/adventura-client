import { StyleSheet } from 'react-native';

import { Radius, type ThemeColors } from '@/constants/theme';

export function createMobileHeaderButtonStyles(colors: ThemeColors) {
  return StyleSheet.create({
    button: {
      width: 40,
      height: 40,
      borderRadius: Radius.pill,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.borderLight,
    },
    buttonPressed: {
      opacity: 0.85,
      backgroundColor: colors.surfaceMuted,
    },
  });
}
