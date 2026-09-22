import { useMemo } from 'react';
import { StyleSheet } from 'react-native';
import { useTheme } from '@/hooks/use-theme';
export function useThemedStyles(factory) {
    const colors = useTheme();
    return useMemo(() => StyleSheet.create(factory(colors)), [colors, factory]);
}
