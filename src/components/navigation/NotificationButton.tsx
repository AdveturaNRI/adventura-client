import { Ionicons } from '@expo/vector-icons';
import { usePathname, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Animated, Pressable, StyleSheet, Text } from 'react-native';

import { createMobileHeaderButtonStyles } from '@/components/navigation/mobile-header-button.styles';
import { buildLoginHref } from '@/constants/auth-routes';
import { type ThemeColors } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';
import { useRealtimeOptional } from '@/context/RealtimeContext';
import { useTheme } from '@/hooks/use-theme';
import { useThemedStyles } from '@/hooks/use-themed-styles';
import { formatUnreadBadge } from '@/utils/unread-badge';

type NotificationButtonVariant = 'default' | 'compact';

type NotificationButtonProps = {
  variant?: NotificationButtonVariant;
};

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    button: {
      width: 44,
      height: 44,
      borderRadius: 22,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.borderLight,
      shadowColor: colors.shadow,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.1,
      shadowRadius: 12,
      elevation: 4,
    },
    buttonActive: {
      borderColor: colors.primary,
      backgroundColor: colors.surfaceMuted,
    },
    pressed: {
      opacity: 0.85,
    },
    badge: {
      position: 'absolute',
      top: 4,
      right: 4,
      minWidth: 16,
      height: 16,
      borderRadius: 8,
      paddingHorizontal: 4,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.destructive,
    },
    badgeCompact: {
      top: 2,
      right: 2,
      minWidth: 15,
      height: 15,
      borderRadius: 8,
    },
    badgeText: {
      fontSize: 10,
      fontWeight: '700',
      color: colors.onPrimary,
    },
  });
}

export function NotificationButton({ variant = 'default' }: NotificationButtonProps) {
  const router = useRouter();
  const pathname = usePathname();
  const colors = useTheme();
  const styles = useThemedStyles(createStyles);
  const compactStyles = useThemedStyles(createMobileHeaderButtonStyles);
  const { isAuthenticated } = useAuth();
  const realtime = useRealtimeOptional();
  const unread = realtime?.unreadNotifications ?? 0;
  const isCompact = variant === 'compact';

  const isActive = pathname.startsWith('/notifications');
  const [displayedCount, setDisplayedCount] = useState(unread);
  const badgeOpacity = useRef(new Animated.Value(unread > 0 ? 1 : 0)).current;
  const badgeScale = useRef(new Animated.Value(unread > 0 ? 1 : 0.85)).current;

  useEffect(() => {
    const visible = unread > 0;
    if (visible) {
      setDisplayedCount(unread);
    }

    Animated.parallel([
      Animated.timing(badgeOpacity, {
        toValue: visible ? 1 : 0,
        duration: 220,
        useNativeDriver: true,
      }),
      Animated.timing(badgeScale, {
        toValue: visible ? 1 : 0.85,
        duration: 220,
        useNativeDriver: true,
      }),
    ]).start(({ finished }) => {
      if (finished && !visible) {
        setDisplayedCount(0);
      }
    });
  }, [unread, badgeOpacity, badgeScale]);

  const handlePress = () => {
    if (!isAuthenticated) {
      router.push(buildLoginHref('/notifications'));
      return;
    }
    if (!isActive) {
      router.push('/notifications');
    }
  };

  const badgeLabel = formatUnreadBadge(displayedCount);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={
        unread > 0 ? `Уведомления, непрочитанных: ${unread}` : 'Уведомления'
      }
      accessibilityState={{ selected: isActive }}
      onPress={handlePress}
      hitSlop={isCompact ? 8 : undefined}
      style={({ pressed }) =>
        isCompact
          ? [compactStyles.button, pressed && compactStyles.buttonPressed]
          : [styles.button, isActive && styles.buttonActive, pressed && styles.pressed]
      }>
      <Ionicons
        name={isActive ? 'notifications' : 'notifications-outline'}
        size={isCompact ? 20 : 22}
        color={isActive ? colors.primary : isCompact ? colors.text : colors.textMuted}
      />
      {badgeLabel ? (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.badge,
            isCompact && styles.badgeCompact,
            { opacity: badgeOpacity, transform: [{ scale: badgeScale }] },
          ]}>
          <Text style={styles.badgeText}>{badgeLabel}</Text>
        </Animated.View>
      ) : null}
    </Pressable>
  );
}
