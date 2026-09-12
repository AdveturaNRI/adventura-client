import { StyleSheet, Text, View } from 'react-native';

import { ThemeToggle, useIsDesktopSidebarVisible } from '@/components/navigation/DesktopThemeToggle';
import { MobileScreenHeader } from '@/components/navigation/MobileScreenHeader';
import { ScreenTransition } from '@/components/navigation/ScreenTransition';
import { FontSize, Spacing, type ThemeColors } from '@/constants/theme';
import { useThemedStyles } from '@/hooks/use-themed-styles';

import { useMainScreenStyles } from './main-screen.styles';

function createSettingsStyles(colors: ThemeColors) {
  return StyleSheet.create({
    section: {
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.borderLight,
      backgroundColor: colors.surface,
      overflow: 'hidden',
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: Spacing.md,
      paddingHorizontal: Spacing.lg,
      paddingVertical: Spacing.md,
    },
    rowText: {
      flex: 1,
      gap: 4,
    },
    rowTitle: {
      fontSize: FontSize.button,
      fontWeight: '600',
      color: colors.text,
    },
    rowSubtitle: {
      fontSize: FontSize.caption,
      color: colors.textMuted,
      lineHeight: FontSize.caption * 1.45,
    },
  });
}

export default function SettingsScreen() {
  const mainStyles = useMainScreenStyles();
  const styles = useThemedStyles(createSettingsStyles);
  const hasDesktopSidebar = useIsDesktopSidebarVisible();
  const showCompactNav = !hasDesktopSidebar;

  return (
    <ScreenTransition animateOnFocus>
      <View style={mainStyles.container}>
        {showCompactNav ? (
          <MobileScreenHeader title="Настройки" showBack />
        ) : (
          <Text style={mainStyles.title}>Настройки</Text>
        )}

        <View style={styles.section}>
          <View style={styles.row}>
            <View style={styles.rowText}>
              <Text style={styles.rowTitle}>Тема оформления</Text>
              <Text style={styles.rowSubtitle}>Светлая или тёмная тема приложения</Text>
            </View>
            <ThemeToggle />
          </View>
        </View>
      </View>
    </ScreenTransition>
  );
}
