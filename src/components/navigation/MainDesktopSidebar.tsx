import { usePathname, useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppLogo } from '@/components/navigation/AppLogo';
import { navigateMainTab } from '@/components/navigation/navigate-main-tab';
import {
  MAIN_APP_ENTRY,
  MAIN_NAVBAR_ITEMS,
} from '@/components/ui/navigation/navbar.config';
import { NavbarIcon } from '@/components/ui/navigation/NavbarIcon';
import { FontSize, Spacing, type ThemeColors } from '@/constants/theme';
import { useRealtimeOptional } from '@/context/RealtimeContext';
import { useThemedStyles } from '@/hooks/use-themed-styles';
import { formatUnreadBadge } from '@/utils/unread-badge';

export const DESKTOP_SIDEBAR_WIDTH = 260;

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: {
      width: DESKTOP_SIDEBAR_WIDTH,
      flexShrink: 0,
      borderRightWidth: 1,
      borderRightColor: colors.border,
      backgroundColor: colors.surface,
    },
    inner: {
      flex: 1,
      paddingHorizontal: Spacing.md,
      paddingBottom: Spacing.lg,
      gap: Spacing.lg,
    },
    logoWrap: {
      paddingHorizontal: Spacing.sm,
      paddingVertical: Spacing.xs,
    },
    nav: {
      gap: Spacing.xs,
    },
    navItem: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.md,
      paddingHorizontal: Spacing.md,
      paddingVertical: Spacing.sm + 2,
      borderRadius: 12,
    },
    navItemActive: {
      backgroundColor: colors.surfaceMuted,
    },
    navItemPressed: {
      opacity: 0.85,
    },
    navLabel: {
      flex: 1,
      fontSize: FontSize.button,
      fontWeight: '500',
      color: colors.text,
    },
    navLabelActive: {
      color: colors.primary,
      fontWeight: '600',
    },
    badge: {
      minWidth: 20,
      height: 20,
      borderRadius: 10,
      paddingHorizontal: 6,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.destructive,
    },
    badgeText: {
      fontSize: 11,
      fontWeight: '700',
      color: colors.onPrimary,
    },
  });
}

export function MainDesktopSidebar() {
  const router = useRouter();
  const pathname = usePathname();
  const insets = useSafeAreaInsets();
  const styles = useThemedStyles(createStyles);
  const realtime = useRealtimeOptional();
  const unreadChats = realtime?.unreadChats ?? 0;

  const activeKey = MAIN_NAVBAR_ITEMS.find((item) =>
    pathname.startsWith(`/${item.key}`),
  )?.key;

  return (
    <View style={styles.container}>
      <View style={[styles.inner, { paddingTop: insets.top + Spacing.md }]}>
        <View style={styles.logoWrap}>
          <AppLogo href={MAIN_APP_ENTRY} height={48} align="left" />
        </View>

        <View style={styles.nav}>
          {MAIN_NAVBAR_ITEMS.map((item) => {
            const isActive = item.key === activeKey;
            const showBadge = item.key === 'chats' && unreadChats > 0;

            return (
              <Pressable
                key={item.key}
                accessibilityRole="tab"
                accessibilityState={{ selected: isActive }}
                onPress={() => {
                  if (!isActive) {
                    navigateMainTab(router, item.key);
                  }
                }}
                style={({ pressed }) => [
                  styles.navItem,
                  isActive && styles.navItemActive,
                  pressed && styles.navItemPressed,
                ]}>
                <NavbarIcon name={item.icon} size={24} active={isActive} />
                <Text style={[styles.navLabel, isActive && styles.navLabelActive]}>
                  {item.label}
                </Text>
                {showBadge ? (
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>{formatUnreadBadge(unreadChats)}</Text>
                  </View>
                ) : null}
              </Pressable>
            );
          })}
        </View>
      </View>
    </View>
  );
}
