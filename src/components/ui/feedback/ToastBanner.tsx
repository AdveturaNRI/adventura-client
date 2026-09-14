import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Toast, { type ToastConfigParams } from 'react-native-toast-message';

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
      alignItems: 'center',
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
    cardShrink: {
      width: 'auto',
      minWidth: 280,
    },
    content: {
      flex: 1,
      gap: 2,
      minWidth: 0,
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
    actionButton: {
      flexShrink: 0,
      paddingVertical: 6,
      paddingHorizontal: 10,
      borderRadius: 999,
      backgroundColor: 'rgba(21, 122, 254, 0.12)',
    },
    actionButtonPressed: {
      opacity: 0.85,
    },
    actionLabel: {
      fontSize: FontSize.caption,
      fontWeight: '700',
      color: colors.primary,
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
  const actionLabel = typeof props?.actionLabel === 'string' ? props.actionLabel : undefined;
  const onAction = typeof props?.onAction === 'function' ? (props.onAction as () => void) : undefined;
  const message = typeof text2 === 'string' && text2.trim() ? text2 : null;

  const body = (
    <>
      <Ionicons name={spec.icon} size={22} color={spec.accentColor} />
      <View style={styles.content}>
        {text1 ? <Text style={styles.title}>{text1}</Text> : null}
        {message ? <Text style={styles.message}>{message}</Text> : null}
      </View>
      {actionLabel && onAction ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={actionLabel}
          hitSlop={8}
          onPress={() => {
            onAction();
            Toast.hide();
          }}
          style={({ pressed }) => [
            styles.actionButton,
            pressed && styles.actionButtonPressed,
          ]}>
          <Text style={styles.actionLabel}>{actionLabel}</Text>
        </Pressable>
      ) : null}
    </>
  );

  const cardStyle = [styles.card, alignment !== 'center' ? styles.cardShrink : null];

  return (
    <View pointerEvents="box-none" style={[styles.outer, getAlignmentStyle(alignment, styles)]}>
      {onPress && !onAction ? (
        <Pressable onPress={onPress} style={cardStyle}>
          {body}
        </Pressable>
      ) : (
        <View style={cardStyle}>{body}</View>
      )}
    </View>
  );
}
