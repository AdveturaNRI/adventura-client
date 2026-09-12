import { Ionicons } from '@expo/vector-icons';
import { usePathname, useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { type ThemeColors } from '@/constants/theme';
import { useRealtimeOptional } from '@/context/RealtimeContext';
import { useTheme } from '@/hooks/use-theme';
import { useThemedStyles } from '@/hooks/use-themed-styles';

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
    badgeText: {
      fontSize: 10,
      fontWeight: '700',
      color: colors.onPrimary,
    },
  });
}

export function NotificationButton() {
  const router = useRouter();
  const pathname = usePathname();
  const colors = useTheme();
  const styles = useThemedStyles(createStyles);
  const realtime = useRealtimeOptional();
  const unread = realtime?.unreadNotifications ?? 0;

  const isActive = pathname.startsWith('/notifications');

  const handlePress = () => {
    if (!isActive) {
      router.push('/notifications');
    }
  };

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Уведомления"
      accessibilityState={{ selected: isActive }}
      onPress={handlePress}
      style={({ pressed }) => [
        styles.button,
        isActive && styles.buttonActive,
        pressed && styles.pressed,
      ]}>
      <Ionicons
        name={isActive ? 'notifications' : 'notifications-outline'}
        size={22}
        color={isActive ? colors.primary : colors.textMuted}
      />
      {unread > 0 ? (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{unread > 9 ? '9+' : String(unread)}</Text>
        </View>
      ) : null}
    </Pressable>
  );
}
