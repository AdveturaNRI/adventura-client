import { createElement, useLayoutEffect, useRef, type ComponentProps } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
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

const TOAST_THEME = {
  dark: {
    bg: '#1C1C1E',
    fg: '#FFFFFF',
    muted: '#C7C7CC',
    border: '#38383A',
    actionBg: 'rgba(21, 122, 254, 0.28)',
    actionFg: '#84B9FF',
  },
  light: {
    bg: '#FFFFFF',
    fg: '#000000',
    muted: '#4C4C4C',
    border: '#E8E8E8',
    actionBg: 'rgba(21, 122, 254, 0.12)',
    actionFg: '#157AFE',
  },
} as const;

function createStyles(colors: ThemeColors) {
  const isDark = colors.background === '#000000';

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
      borderRadius: 16,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      shadowColor: colors.shadow,
      shadowOffset: { width: 0, height: 10 },
      shadowOpacity: isDark ? 0.55 : 0.14,
      shadowRadius: 22,
      elevation: 8,
      overflow: 'hidden',
      pointerEvents: 'auto',
    },
    cardInner: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.sm + 2,
      paddingVertical: 12,
      paddingHorizontal: Spacing.md,
      backgroundColor: 'transparent',
    },
    cardAlert: {
      borderColor: isDark ? 'rgba(75, 153, 255, 0.45)' : 'rgba(21, 122, 254, 0.28)',
    },
    cardChat: {
      borderColor: isDark ? 'rgba(75, 153, 255, 0.45)' : 'rgba(21, 122, 254, 0.28)',
    },
    cardWarningEmphasis: {
      borderColor: isDark ? 'rgba(255, 159, 10, 0.5)' : 'rgba(255, 159, 10, 0.35)',
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
      borderColor: colors.surface,
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
      color: colors.text,
      letterSpacing: -0.1,
    },
    titleEmphasis: {
      fontWeight: '700',
    },
    message: {
      fontSize: FontSize.caption,
      color: colors.textSecondary,
      lineHeight: 17,
    },
    actionButton: {
      flexShrink: 0,
      paddingVertical: 7,
      paddingHorizontal: 12,
      borderRadius: 999,
      backgroundColor: isDark ? 'rgba(21, 122, 254, 0.22)' : 'rgba(21, 122, 254, 0.12)',
    },
    actionLabel: {
      fontSize: FontSize.caption,
      fontWeight: '700',
      color: isDark ? colors.primaryLight : colors.primary,
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

function getIconWellBackground(variant: ToastVariant, isDark: boolean) {
  switch (variant) {
    case 'success':
      return isDark ? 'rgba(52, 199, 89, 0.22)' : 'rgba(52, 199, 89, 0.14)';
    case 'error':
      return isDark ? 'rgba(255, 69, 58, 0.22)' : 'rgba(255, 59, 48, 0.14)';
    case 'warning':
      return isDark ? 'rgba(255, 159, 10, 0.24)' : 'rgba(255, 159, 10, 0.16)';
    default:
      return isDark ? 'rgba(21, 122, 254, 0.22)' : 'rgba(21, 122, 254, 0.12)';
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

function paintToastNode(node: HTMLElement | null, isDark: boolean) {
  if (!node?.style) {
    return;
  }
  const theme = isDark ? TOAST_THEME.dark : TOAST_THEME.light;
  node.style.setProperty('background', theme.bg, 'important');
  node.style.setProperty('background-color', theme.bg, 'important');
  node.style.setProperty('border-color', theme.border, 'important');
  node.style.setProperty('color', theme.fg, 'important');
}

export function ToastBanner({ text1, text2, variant, props }: ToastBannerProps) {
  const colors = useTheme();
  const { colorScheme } = useThemePreference();
  const isDark = colorScheme === 'dark';
  const theme = isDark ? TOAST_THEME.dark : TOAST_THEME.light;
  const styles = useThemedStyles(createStyles);
  const cardRef = useRef<HTMLDivElement | null>(null);
  const titleRef = useRef<HTMLElement | null>(null);
  const messageRef = useRef<HTMLElement | null>(null);
  const actionRef = useRef<HTMLElement | null>(null);
  const actionLabelRef = useRef<HTMLElement | null>(null);

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
  const isInteractive = Boolean(actionLabel && onAction);

  const handleAction = () => {
    onAction?.();
    Toast.hide();
  };

  useLayoutEffect(() => {
    if (Platform.OS !== 'web') {
      return;
    }
    // Keep <html data-theme> in sync before paint — stale "light" used to win
    // over .adventura-toast--dark and force a white card with white text.
    if (typeof document !== 'undefined') {
      document.documentElement.dataset.theme = colorScheme;
    }
    paintToastNode(cardRef.current, isDark);
    if (titleRef.current?.style) {
      titleRef.current.style.setProperty('color', theme.fg, 'important');
    }
    if (messageRef.current?.style) {
      messageRef.current.style.setProperty('color', theme.muted, 'important');
    }
    if (actionRef.current?.style) {
      actionRef.current.style.setProperty('background', theme.actionBg, 'important');
      actionRef.current.style.setProperty('background-color', theme.actionBg, 'important');
    }
    if (actionLabelRef.current?.style) {
      actionLabelRef.current.style.setProperty('color', theme.actionFg, 'important');
    }
  }, [colorScheme, isDark, theme]);

  const leading = showAvatar ? (
    <View style={styles.leading}>
      <UserAvatar nickname={avatarName!} avatarUrl={avatarUrl} size={40} />
      <View
        style={[
          styles.avatarSeal,
          { borderColor: theme.bg },
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
        { backgroundColor: getIconWellBackground(variant, isDark) },
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
            ref={
              Platform.OS === 'web'
                ? (node) => {
                    titleRef.current = node as unknown as HTMLElement | null;
                  }
                : undefined
            }
            {...(Platform.OS === 'web' ? ({ className: 'adventura-toast-title' } as object) : null)}
            style={[
              styles.title,
              { color: theme.fg },
              emphasis !== 'default' ? styles.titleEmphasis : null,
            ]}
            numberOfLines={2}>
            {text1}
          </Text>
        ) : null}
        {message ? (
          <Text
            ref={
              Platform.OS === 'web'
                ? (node) => {
                    messageRef.current = node as unknown as HTMLElement | null;
                  }
                : undefined
            }
            {...(Platform.OS === 'web'
              ? ({ className: 'adventura-toast-message' } as object)
              : null)}
            style={[styles.message, { color: theme.muted }]}
            numberOfLines={4}>
            {message}
          </Text>
        ) : null}
      </View>
      {actionLabel && onAction ? (
        <View
          ref={
            Platform.OS === 'web'
              ? (node) => {
                  actionRef.current = node as unknown as HTMLElement | null;
                }
              : undefined
          }
          {...(Platform.OS === 'web' ? ({ className: 'adventura-toast-action' } as object) : null)}
          style={[styles.actionButton, { backgroundColor: theme.actionBg }]}
          pointerEvents="none">
          <Text
            ref={
              Platform.OS === 'web'
                ? (node) => {
                    actionLabelRef.current = node as unknown as HTMLElement | null;
                  }
                : undefined
            }
            {...(Platform.OS === 'web'
              ? ({ className: 'adventura-toast-action-label' } as object)
              : null)}
            style={[styles.actionLabel, { color: theme.actionFg }]}>
            {actionLabel}
          </Text>
        </View>
      ) : null}
    </>
  );

  const borderColor =
    emphasis !== 'default' && variant === 'warning'
      ? isDark
        ? 'rgba(255, 159, 10, 0.5)'
        : 'rgba(255, 159, 10, 0.35)'
      : emphasis === 'alert' || emphasis === 'chat'
        ? isDark
          ? 'rgba(75, 153, 255, 0.45)'
          : 'rgba(21, 122, 254, 0.28)'
        : theme.border;

  // Web: plain <div> — RN View/Pressable keep getting UA white fills in Safari.
  if (Platform.OS === 'web') {
    const toastClassName = isDark
      ? 'adventura-toast adventura-toast--dark'
      : 'adventura-toast adventura-toast--light';

    return (
      <View pointerEvents="box-none" style={[styles.outer, getAlignmentStyle(alignment, styles)]}>
        {createElement(
          'div',
          {
            ref: cardRef,
            className: toastClassName,
            'aria-label': isInteractive ? (actionLabel ?? text1 ?? 'Уведомление') : undefined,
            tabIndex: isInteractive ? 0 : undefined,
            onClick: isInteractive ? handleAction : undefined,
            onKeyDown: isInteractive
              ? (event: { key: string; preventDefault: () => void }) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    handleAction();
                  }
                }
              : undefined,
            style: {
              width: alignment === 'center' ? '100%' : 'auto',
              minWidth: alignment === 'center' ? undefined : 300,
              maxWidth: Layout.maxContentWidth,
              boxSizing: 'border-box',
              borderRadius: 16,
              borderWidth: 1,
              borderStyle: 'solid',
              borderColor,
              backgroundColor: theme.bg,
              background: theme.bg,
              color: theme.fg,
              overflow: 'hidden',
              cursor: isInteractive ? 'pointer' : 'default',
              boxShadow: isDark
                ? '0 10px 22px rgba(0,0,0,0.55)'
                : '0 10px 22px rgba(0,0,0,0.14)',
              display: 'flex',
              flexDirection: 'row',
              alignItems: 'center',
              gap: Spacing.sm + 2,
              paddingTop: 12,
              paddingBottom: 12,
              paddingLeft: Spacing.md,
              paddingRight: Spacing.md,
            },
          },
          body,
        )}
      </View>
    );
  }

  const cardStyle = [
    styles.card,
    {
      backgroundColor: theme.bg,
      borderColor,
    },
    alignment !== 'center' ? styles.cardShrink : null,
  ];

  return (
    <View pointerEvents="box-none" style={[styles.outer, getAlignmentStyle(alignment, styles)]}>
      <View style={cardStyle}>
        {isInteractive ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={actionLabel ?? text1 ?? 'Уведомление'}
            onPress={handleAction}
            style={({ pressed }) => [styles.cardInner, pressed && styles.cardPressed]}>
            {body}
          </Pressable>
        ) : (
          <View style={styles.cardInner}>{body}</View>
        )}
      </View>
    </View>
  );
}
