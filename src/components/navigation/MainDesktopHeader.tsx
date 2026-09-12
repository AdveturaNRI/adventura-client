import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemeToggle } from '@/components/navigation/DesktopThemeToggle';
import { NotificationButton } from '@/components/navigation/NotificationButton';
import { UserProfileDropdown } from '@/components/navigation/UserProfileDropdown';
import { Spacing, type ThemeColors } from '@/constants/theme';
import { useThemedStyles } from '@/hooks/use-themed-styles';

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: {
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      backgroundColor: colors.surface,
    },
    inner: {
      width: '100%',
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'flex-end',
      minHeight: 56,
      paddingHorizontal: Spacing.lg,
      gap: Spacing.sm,
    },
  });
}

export function MainDesktopHeader() {
  const insets = useSafeAreaInsets();
  const styles = useThemedStyles(createStyles);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.inner}>
        <UserProfileDropdown />
        <NotificationButton />
        <ThemeToggle />
      </View>
    </View>
  );
}
