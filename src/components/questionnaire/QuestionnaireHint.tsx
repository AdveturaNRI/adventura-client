import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { FontSize, Spacing, type ThemeColors } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useThemedStyles } from '@/hooks/use-themed-styles';

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: Spacing.sm,
      padding: Spacing.md,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.primaryLight,
      backgroundColor: colors.surfaceMuted,
      width: '100%',
      maxWidth: '100%',
      minWidth: 0,
      overflow: 'hidden',
      alignSelf: 'stretch',
    },
    text: {
      flex: 1,
      minWidth: 0,
      flexShrink: 1,
      fontSize: FontSize.label,
      color: colors.textSecondary,
      lineHeight: FontSize.label * 1.5,
    },
  });
}

type QuestionnaireHintProps = {
  children: string;
};

export function QuestionnaireHint({ children }: QuestionnaireHintProps) {
  const colors = useTheme();
  const styles = useThemedStyles(createStyles);

  return (
    <View style={styles.container} accessibilityRole="text">
      <Ionicons name="bulb-outline" size={20} color={colors.primary} />
      <Text style={styles.text}>{children}</Text>
    </View>
  );
}
