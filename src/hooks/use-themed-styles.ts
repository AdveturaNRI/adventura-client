import { useMemo } from 'react';
import { StyleSheet } from 'react-native';

import { type ThemeColors } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export function useThemedStyles<T extends StyleSheet.NamedStyles<T>>(
  factory: (colors: ThemeColors) => T,
): T {
  const colors = useTheme();
  return useMemo(() => StyleSheet.create(factory(colors)), [colors, factory]);
}
