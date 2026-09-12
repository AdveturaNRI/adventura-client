import { StyleSheet, Text, TextProps } from 'react-native';

import { FontSize, Spacing, type ThemeColors } from '@/constants/theme';
import { useThemedStyles } from '@/hooks/use-themed-styles';

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    h1: {
      fontSize: FontSize.h1,
      color: colors.text,
      textAlign: 'center',
      lineHeight: FontSize.h1 * 1.25,
      fontWeight: '600',
      paddingHorizontal: Spacing.md,
    },
    caption: {
      fontSize: FontSize.caption,
      color: colors.textSubtle,
      lineHeight: FontSize.caption * 1.4,
    },
    link: {
      fontSize: FontSize.link,
      color: colors.primary,
      lineHeight: FontSize.link * 1.4,
    },
  });
}

export function H1({ children, style, ...props }: TextProps) {
  const styles = useThemedStyles(createStyles);
  return (
    <Text style={[styles.h1, style]} {...props}>
      {children}
    </Text>
  );
}

export function Caption({ children, style, ...props }: TextProps) {
  const styles = useThemedStyles(createStyles);
  return (
    <Text style={[styles.caption, style]} {...props}>
      {children}
    </Text>
  );
}

export function LinkLabel({ children, style, ...props }: TextProps) {
  const styles = useThemedStyles(createStyles);
  return (
    <Text style={[styles.link, style]} {...props}>
      {children}
    </Text>
  );
}
