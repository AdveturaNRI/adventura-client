import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { ToastConfigParams } from 'react-native-toast-message';

import {
  getToastSpecs,
  type ToastAlignment,
  type ToastVariant,
} from '@/components/ui/feedback/toast.config';
import { FontSize, Layout, Spacing, type ThemeColors } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useThemedStyles } from '@/hooks/use-themed-styles';

type ToastBannerProps = ToastConfigParams<Record<string, unknown>> & {
  variant: ToastVariant;
};

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    outer: {
      width: '100%',
      paddingHorizontal: Spacing.md,
      // Let clicks pass through empty space around the banner (e.g. header actions).
      pointerEvents: 'box-none',
    },
    alignLeft: {
      alignItems: 'flex-start',
    },
    alignCenter: {
      alignItems: 'center',
    },
    alignRight: {
      alignItems: 'flex-end',
    },
    card: {
      width: '100%',
      maxWidth: Layout.maxContentWidth,
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: Spacing.sm,
      paddingVertical: Spacing.md,
      paddingHorizontal: Spacing.md,
      borderRadius: 16,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.borderLight,
      shadowColor: colors.shadow,
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.12,
      shadowRadius: 20,
      elevation: 6,
      pointerEvents: 'auto',
    },
    content: {
      flex: 1,
      gap: 2,
    },
    title: {
      fontSize: FontSize.label,
      fontWeight: '600',
      color: colors.text,
    },
    message: {
      fontSize: FontSize.caption,
      color: colors.textSecondary,
      lineHeight: 18,
    },
  });
}

function getAlignmentStyle(
  alignment: ToastAlignment,
  styles: ReturnType<typeof createStyles>,
) {
  switch (alignment) {
    case 'left':
      return styles.alignLeft;
    case 'right':
      return styles.alignRight;
    default:
      return styles.alignCenter;
  }
}

export function ToastBanner({ text1, text2, onPress, variant, props }: ToastBannerProps) {
  const colors = useTheme();
  const styles = useThemedStyles(createStyles);
  const spec = getToastSpecs(colors).find((item) => item.variant === variant)!;
  const alignment = (props?.alignment as ToastAlignment | undefined) ?? 'center';

  return (
    <View pointerEvents="box-none" style={[styles.outer, getAlignmentStyle(alignment, styles)]}>
      <Pressable onPress={onPress} style={styles.card}>
        <Ionicons name={spec.icon} size={22} color={spec.accentColor} />
        <View style={styles.content}>
          {text1 ? <Text style={styles.title}>{text1}</Text> : null}
          {text2 ? <Text style={styles.message}>{text2}</Text> : null}
        </View>
      </Pressable>
    </View>
  );
}
