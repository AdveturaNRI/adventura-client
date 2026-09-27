import { forwardRef } from 'react';
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
      backgroundColor: 'rgba(255, 59, 48, 0.04)',
    },
    error: {
      fontSize: FontSize.caption,
      fontWeight: '600',
      color: colors.destructive,
      paddingLeft: Spacing.xs,
      lineHeight: FontSize.caption * 1.35,
    },
  });
}

export const Input = forwardRef<TextInput, InputProps>(function Input(
  { label, error, labelHint, style, ...props },
  ref,
) {
  const colors = useTheme();
  const styles = useThemedStyles(createStyles);

  return (
    <View style={styles.wrapper}>
      <View style={styles.labelRow}>
        <Text style={[styles.label, error ? { color: colors.destructive } : null]}>{label}</Text>
        {labelHint && !error ? <FieldLabelHint text={labelHint} /> : null}
      </View>
      <TextInput
        ref={ref}
        placeholderTextColor={colors.textMuted}
        style={[styles.input, error ? styles.inputError : null, style]}
        {...props}
      />
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
});
