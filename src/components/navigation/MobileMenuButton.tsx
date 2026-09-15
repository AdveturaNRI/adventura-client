import { Ionicons } from '@expo/vector-icons';
import { useEffect, useRef, useState } from 'react';
import { Animated, Pressable, StyleSheet, Text } from 'react-native';

import { useMobileAppMenu } from '@/components/navigation/MobileAppMenuContext';
import { createMobileHeaderButtonStyles } from '@/components/navigation/mobile-header-button.styles';
import { type ThemeColors } from '@/constants/theme';
import { useRealtimeOptional } from '@/context/RealtimeContext';
import { useTheme } from '@/hooks/use-theme';
import { useThemedStyles } from '@/hooks/use-themed-styles';
import { formatUnreadBadge } from '@/utils/unread-badge';

type MobileMenuButtonProps = {
  accessibilityLabel?: string;
};

function createBadgeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    badge: {
      position: 'absolute',
      top: 2,
      right: 2,
      minWidth: 15,
      height: 15,
      borderRadius: 8,
      paddingHorizontal: 4,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.destructive,
    },
    badgeText: {
      fontSize: 10,
      fontWeight: '700',
      color: colors.destructive,
    },
  });
}

export function MobileMenuButton({ accessibilityLabel = 'Открыть меню' }: MobileMenuButtonProps) {
  const { toggle } = useMobileAppMenu();
  const colors = useTheme();
  const styles = useThemedStyles(createMobileHeaderButtonStyles);
  const badgeStyles = useThemedStyles(createBadgeStyles);
  const realtime = useRealtimeOptional();
  const unreadChats = realtime?.unreadChats ?? 0;

  const [displayedCount, setDisplayedCount] = useState(unreadChats);
  const badgeOpacity = useRef(new Animated.Value(unreadChats > 0 ? 1 : 0)).current;
  const badgeScale = useRef(new Animated.Value(unreadChats > 0 ? 1 : 0.85)).current;

  useEffect(() => {
    const visible = unreadChats > 0;
    if (visible) {
      setDisplayedCount(unreadChats);
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
  }, [unreadChats, badgeOpacity, badgeScale]);

  const badgeLabel = formatUnreadBadge(displayedCount);
  const label =
    unreadChats > 0
      ? `${accessibilityLabel}, непрочитанных сообщений: ${unreadChats}`
      : accessibilityLabel;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={toggle}
      hitSlop={8}
      style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}>
      <Ionicons name="grid-outline" size={20} color={colors.text} />
      {badgeLabel ? (
        <Animated.View
          pointerEvents="none"
          style={[
            badgeStyles.badge,
            { opacity: badgeOpacity, transform: [{ scale: badgeScale }] },
          ]}>
          <Text style={badgeStyles.badgeText}>{badgeLabel}</Text>
        </Animated.View>
      ) : null}
    </Pressable>
  );
}
