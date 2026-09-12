import { StyleSheet, Text, TextInput, TextInputProps, View } from 'react-native';

import { FieldLabelHint } from '@/components/ui/inputs/FieldLabelHint';
import { FontSize, Radius, Sizes, Spacing, type ThemeColors } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useThemedStyles } from '@/hooks/use-themed-styles';

type InputProps = TextInputProps & {
  label: string;
  error?: string;
  labelHint?: string;
};

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    wrapper: {
      gap: Spacing.sm,
      width: '100%',
      maxWidth: '100%',
    },
    labelRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.xs,
      paddingLeft: Spacing.xs,
      flexWrap: 'wrap',
      maxWidth: '100%',
    },
    label: {
      fontSize: FontSize.label,
      color: colors.textMuted,
      flexShrink: 1,
    },
    input: {
      minHeight: Sizes.controlHeight,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: Radius.pill,
      paddingHorizontal: Spacing.md,
      fontSize: FontSize.input,
      color: colors.textSecondary,
      backgroundColor: colors.surface,
      width: '100%',
      maxWidth: '100%',
    },
    inputError: {
      borderColor: colors.destructive,
    },
    error: {
      fontSize: FontSize.caption,
      color: colors.destructive,
      paddingLeft: Spacing.xs,
    },
  });
}

export function Input({ label, error, labelHint, style, ...props }: InputProps) {
  const colors = useTheme();
  const styles = useThemedStyles(createStyles);

  return (
    <View style={styles.wrapper}>
      <View style={styles.labelRow}>
        <Text style={styles.label}>{label}</Text>
        {labelHint ? <FieldLabelHint text={labelHint} /> : null}
      </View>
      <TextInput
        placeholderTextColor={colors.textMuted}
        style={[styles.input, error ? styles.inputError : null, style]}
        {...props}
      />
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}
