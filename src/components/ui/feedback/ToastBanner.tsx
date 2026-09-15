import type { ComponentProps } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Toast, { type ToastConfigParams } from 'react-native-toast-message';

import { UserAvatar } from '@/components/navigation/UserAvatar';
import {
  getToastSpecs,
  type ToastAlignment,
  type ToastEmphasis,
  type ToastVariant,
} from '@/components/ui/feedback/toast.config';
import { FontSize, Layout, Spacing, type ThemeColors } from '@/constants/theme';
import { useTheme, useThemePreference } from '@/hooks/use-theme';
import { useThemedStyles } from '@/hooks/use-themed-styles';

type ToastBannerProps = ToastConfigParams<Record<string, unknown>> & {
  variant: ToastVariant;
};

type IconName = ComponentProps<typeof Ionicons>['name'];

function createStyles(colors: ThemeColors, isDark: boolean) {
  const cardBg = isDark ? '#2C2C2E' : '#FFFFFF';
  const titleColor = isDark ? '#FFFFFF' : '#000000';
  const messageColor = isDark ? '#E5E5EA' : '#4C4C4C';

  return StyleSheet.create({
    outer: {
      width: '100%',
      paddingHorizontal: Spacing.md,
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
      gap: Spacing.sm + 2,
      paddingVertical: 12,
      paddingHorizontal: Spacing.md,
      borderRadius: 16,
      backgroundColor: cardBg,
      borderWidth: 1,
      borderColor: isDark ? 'rgba(255,255,255,0.14)' : colors.borderLight,
      shadowColor: colors.shadow,
      shadowOffset: { width: 0, height: 10 },
      shadowOpacity: isDark ? 0.45 : 0.14,
      shadowRadius: 22,
      elevation: 8,
      overflow: 'hidden',
      pointerEvents: 'auto',
    },
    cardAlert: {
      borderColor: 'rgba(21, 122, 254, 0.28)',
    },
    cardChat: {
      borderColor: 'rgba(21, 122, 254, 0.28)',
    },
    cardWarningEmphasis: {
      borderColor: 'rgba(255, 159, 10, 0.35)',
    },
    cardPressed: {
      opacity: 0.94,
    },
    cardShrink: {
      width: 'auto',
      minWidth: 300,
      maxWidth: '100%',
    },
    leading: {
      width: 44,
      height: 44,
      flexShrink: 0,
      alignItems: 'center',
      justifyContent: 'center',
    },
    iconWell: {
      width: 44,
      height: 44,
      borderRadius: 14,
      alignItems: 'center',
      justifyContent: 'center',
    },
    avatarSeal: {
      position: 'absolute',
      right: -2,
      bottom: -2,
      width: 18,
      height: 18,
      borderRadius: 9,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.primary,
      borderWidth: 2,
      borderColor: cardBg,
    },
    avatarSealWarning: {
      backgroundColor: '#FF9F0A',
    },
    avatarSealSuccess: {
      backgroundColor: colors.success,
    },
    content: {
      flex: 1,
      gap: 3,
      minWidth: 0,
    },
    title: {
      fontSize: FontSize.label,
      fontWeight: '600',
      color: titleColor,
      letterSpacing: -0.1,
    },
    titleEmphasis: {
      fontWeight: '700',
    },
    message: {
      fontSize: FontSize.caption,
      color: messageColor,
      lineHeight: 17,
    },
    actionButton: {
      flexShrink: 0,
      paddingVertical: 7,
      paddingHorizontal: 12,
      borderRadius: 999,
      backgroundColor: 'rgba(21, 122, 254, 0.12)',
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

function getIconWellBackground(variant: ToastVariant) {
  switch (variant) {
    case 'success':
      return 'rgba(52, 199, 89, 0.14)';
    case 'error':
      return 'rgba(255, 59, 48, 0.14)';
    case 'warning':
      return 'rgba(255, 159, 10, 0.16)';
    default:
      return 'rgba(21, 122, 254, 0.12)';
  }
}

function resolveIconName(emphasis: ToastEmphasis, specIcon: IconName): IconName {
  if (emphasis === 'chat') {
    return 'chatbubbles';
  }
  return specIcon;
}

function resolveSealIcon(emphasis: ToastEmphasis, variant: ToastVariant): IconName {
  if (emphasis === 'chat') {
    return 'chatbubble';
  }
  if (variant === 'success') {
    return 'checkmark';
  }
  if (variant === 'warning' || variant === 'error') {
    return 'close';
  }
  return 'notifications';
}

export function ToastBanner({ text1, text2, onPress, variant, props }: ToastBannerProps) {
  const colors = useTheme();
  const { colorScheme } = useThemePreference();
  const isDark = colorScheme === 'dark';
  const styles = useThemedStyles((themeColors) => createStyles(themeColors, isDark));
  const cardBg = isDark ? '#2C2C2E' : '#FFFFFF';
  const spec = getToastSpecs(colors).find((item) => item.variant === variant)!;
  const alignment = (props?.alignment as ToastAlignment | undefined) ?? 'center';
  const actionLabel = typeof props?.actionLabel === 'string' ? props.actionLabel : undefined;
  const onAction = typeof props?.onAction === 'function' ? (props.onAction as () => void) : undefined;
  const emphasis = (props?.emphasis as ToastEmphasis | undefined) ?? 'default';
  const avatarUrl =
    typeof props?.avatarUrl === 'string' && props.avatarUrl.trim()
      ? props.avatarUrl.trim()
      : null;
  const avatarName =
    typeof props?.avatarName === 'string' && props.avatarName.trim()
      ? props.avatarName.trim()
      : null;
  const message = typeof text2 === 'string' && text2.trim() ? text2 : null;
  const iconName = resolveIconName(emphasis, spec.icon);
  const showAvatar = Boolean(avatarName);
  const sealIcon = resolveSealIcon(emphasis, variant);

  const handleAction = () => {
    onAction?.();
    Toast.hide();
  };

  const leading = showAvatar ? (
    <View style={styles.leading}>
      <UserAvatar nickname={avatarName!} avatarUrl={avatarUrl} size={40} />
      <View
        style={[
          styles.avatarSeal,
          variant === 'warning' ? styles.avatarSealWarning : null,
          variant === 'success' ? styles.avatarSealSuccess : null,
        ]}>
        <Ionicons name={sealIcon} size={9} color={colors.onPrimary} />
      </View>
    </View>
  ) : (
    <View
      style={[
        styles.iconWell,
        { backgroundColor: getIconWellBackground(variant) },
      ]}>
      <Ionicons name={iconName} size={22} color={spec.accentColor} />
    </View>
  );

  const body = (
    <>
      {leading}
      <View style={styles.content}>
        {text1 ? (
          <Text
            style={[styles.title, emphasis !== 'default' ? styles.titleEmphasis : null]}
            numberOfLines={2}>
            {text1}
          </Text>
        ) : null}
        {message ? (
          <Text style={styles.message} numberOfLines={2}>
            {message}
          </Text>
        ) : null}
      </View>
      {actionLabel && onAction ? (
        <View style={styles.actionButton} pointerEvents="none">
          <Text style={styles.actionLabel}>{actionLabel}</Text>
        </View>
      ) : null}
    </>
  );

  const cardStyle = [
    styles.card,
    { backgroundColor: cardBg },
    alignment !== 'center' ? styles.cardShrink : null,
    emphasis === 'alert' ? styles.cardAlert : null,
    emphasis === 'chat' ? styles.cardChat : null,
    emphasis !== 'default' && variant === 'warning' ? styles.cardWarningEmphasis : null,
  ];

  const isInteractive = Boolean(onAction) || Boolean(onPress);

  return (
    <View pointerEvents="box-none" style={[styles.outer, getAlignmentStyle(alignment, styles)]}>
      {isInteractive ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={actionLabel ?? text1 ?? 'Уведомление'}
          onPress={onAction ? handleAction : onPress}
          style={({ pressed }) => [...cardStyle, pressed && styles.cardPressed]}>
          {body}
        </Pressable>
      ) : (
        <View style={cardStyle}>{body}</View>
      )}
    </View>
  );
}
