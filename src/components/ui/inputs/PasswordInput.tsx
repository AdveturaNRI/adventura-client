import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, TextInputProps, View } from 'react-native';

import { FontSize, Radius, Sizes, Spacing, type ThemeColors } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useThemedStyles } from '@/hooks/use-themed-styles';

type PasswordInputProps = Omit<TextInputProps, 'secureTextEntry'> & {
  label: string;
  error?: string;
};

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    wrapper: {
      gap: Spacing.sm,
    },
    label: {
      fontSize: FontSize.label,
      color: colors.textMuted,
      paddingLeft: Spacing.xs,
    },
    field: {
      position: 'relative',
      justifyContent: 'center',
    },
    input: {
      minHeight: Sizes.controlHeight,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: Radius.pill,
      paddingHorizontal: Spacing.md,
      paddingRight: 48,
      fontSize: FontSize.input,
      color: colors.textSecondary,
      backgroundColor: colors.surface,
    },
    inputError: {
      borderColor: colors.destructive,
    },
    error: {
      fontSize: FontSize.caption,
      color: colors.destructive,
      paddingLeft: Spacing.xs,
    },
    toggle: {
      position: 'absolute',
      right: Spacing.md,
      height: Sizes.controlHeight,
      justifyContent: 'center',
      alignItems: 'center',
      width: 32,
    },
  });
}

export function PasswordInput({ label, error, style, ...props }: PasswordInputProps) {
  const [visible, setVisible] = useState(false);
  const colors = useTheme();
  const styles = useThemedStyles(createStyles);

  return (
    <View style={styles.wrapper}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.field}>
        <TextInput
          secureTextEntry={!visible}
          placeholderTextColor={colors.textMuted}
          style={[styles.input, error ? styles.inputError : null, style]}
          {...props}
        />
        <Pressable
          onPress={() => setVisible((v) => !v)}
          style={styles.toggle}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={visible ? 'Скрыть пароль' : 'Показать пароль'}>
          <Ionicons
            name={visible ? 'eye-off-outline' : 'eye-outline'}
            size={22}
            color={colors.textMuted}
          />
        </Pressable>
      </View>
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}
