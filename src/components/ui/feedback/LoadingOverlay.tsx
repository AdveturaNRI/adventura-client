import { StyleSheet, Text, View, type ViewStyle } from 'react-native';

import { D20Loader } from '../feedback/D20Loader';
import { FontSize, Spacing, type ThemeColors } from '@/constants/theme';
import { useThemedStyles } from '@/hooks/use-themed-styles';

type LoadingOverlayProps = {
  label?: string;
  style?: ViewStyle;
};

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: {
      alignItems: 'center',
      justifyContent: 'center',
      gap: Spacing.md,
      padding: Spacing.lg,
    },
    label: {
      fontSize: FontSize.label,
      color: colors.textMuted,
    },
  });
}

export function LoadingOverlay({ label = 'Загрузка...', style }: LoadingOverlayProps) {
  const styles = useThemedStyles(createStyles);

  return (
    <View style={[styles.container, style]}>
      <D20Loader size={88} />
      <Text style={styles.label}>{label}</Text>
    </View>
  );
}
