import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';

import { FontSize, Spacing, type ThemeColors } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useThemedStyles } from '@/hooks/use-themed-styles';

type QuestionnaireRequiredCalloutProps = {
  message?: string;
};

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    callout: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.sm,
      paddingVertical: Spacing.sm,
      paddingHorizontal: Spacing.md,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: 'rgba(255, 59, 48, 0.28)',
      backgroundColor: 'rgba(255, 59, 48, 0.07)',
    },
    text: {
      flex: 1,
      minWidth: 0,
      fontSize: FontSize.caption,
      fontWeight: '600',
      color: colors.destructive,
      lineHeight: FontSize.caption * 1.35,
    },
  });
}

/** Compact inline notice for missing required block/fields in questionnaire panels. */
export function QuestionnaireRequiredCallout({
  message = 'Обязательное поле',
}: QuestionnaireRequiredCalloutProps) {
  const colors = useTheme();
  const styles = useThemedStyles(createStyles);

  return (
    <View style={styles.callout} accessibilityRole="alert">
      <Ionicons name="alert-circle" size={16} color={colors.destructive} />
      <Text style={styles.text}>{message}</Text>
    </View>
  );
}

export const QUESTIONNAIRE_PANEL_ERROR_STYLE = {
  borderColor: 'rgba(255, 59, 48, 0.35)',
  backgroundColor: 'rgba(255, 59, 48, 0.04)',
} as const;
