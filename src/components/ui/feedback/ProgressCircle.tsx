import { StyleSheet, Text, View } from 'react-native';

import { Sizes, type ThemeColors } from '@/constants/theme';
import { useThemedStyles } from '@/hooks/use-themed-styles';

type ProgressCircleProps = {
  value: number;
};

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    circle: {
      width: Sizes.progressCircle,
      height: Sizes.progressCircle,
      borderRadius: Sizes.progressCircle / 2,
      borderWidth: 2,
      borderColor: colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.surface,
    },
    label: {
      fontSize: 11,
      fontWeight: '600',
      color: colors.primary,
    },
  });
}

export function ProgressCircle({ value }: ProgressCircleProps) {
  const styles = useThemedStyles(createStyles);

  return (
    <View style={styles.circle}>
      <Text style={styles.label}>{value}%</Text>
    </View>
  );
}
