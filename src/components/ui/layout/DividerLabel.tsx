import { StyleSheet, Text, View } from 'react-native';

import { FontSize, Spacing, type ThemeColors } from '@/constants/theme';
import { useThemedStyles } from '@/hooks/use-themed-styles';

type DividerLabelProps = {
  label: string;
};

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.md,
      paddingVertical: Spacing.xs,
    },
    line: {
      flex: 1,
      height: 1,
      backgroundColor: colors.border,
    },
    label: {
      fontSize: FontSize.caption,
      color: colors.textSubtle,
      textTransform: 'lowercase',
    },
  });
}

export function DividerLabel({ label }: DividerLabelProps) {
  const styles = useThemedStyles(createStyles);

  return (
    <View style={styles.container}>
      <View style={styles.line} />
      <Text style={styles.label}>{label}</Text>
      <View style={styles.line} />
    </View>
  );
}
