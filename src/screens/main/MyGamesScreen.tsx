import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { MobileScreenHeader } from '@/components/navigation/MobileScreenHeader';
import { useIsDesktopSidebarVisible } from '@/components/navigation/DesktopThemeToggle';
import { ScreenTransition } from '@/components/navigation/ScreenTransition';
import { FontSize, Spacing, type ThemeColors } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useThemedStyles } from '@/hooks/use-themed-styles';

import { useMainScreenStyles } from './main-screen.styles';

function createLocalStyles(colors: ThemeColors) {
  return StyleSheet.create({
    empty: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      gap: Spacing.sm,
      paddingHorizontal: Spacing.xl,
      paddingBottom: Spacing.xl,
    },
    emptyTitle: {
      fontSize: FontSize.button,
      fontWeight: '600',
      color: colors.text,
    },
    emptyHint: {
      fontSize: FontSize.caption,
      color: colors.textMuted,
      textAlign: 'center',
      lineHeight: FontSize.caption * 1.45,
    },
  });
}

export default function MyGamesScreen() {
  const mainStyles = useMainScreenStyles();
  const colors = useTheme();
  const hasDesktopSidebar = useIsDesktopSidebarVisible();
  const showCompactNav = !hasDesktopSidebar;
  const styles = useThemedStyles(createLocalStyles);

  return (
    <ScreenTransition animateOnFocus>
      <View style={mainStyles.container}>
        {showCompactNav ? (
          <MobileScreenHeader title="Мои участия" showBack />
        ) : (
          <Text style={mainStyles.title}>Мои участия</Text>
        )}

        <View style={styles.empty}>
          <Ionicons name="people-outline" size={28} color={colors.textMuted} />
          <Text style={styles.emptyTitle}>Пока нет участий</Text>
          <Text style={styles.emptyHint}>
            Здесь появятся столы, куда вас приняли, и игры, на которые вы подали заявку. Новые столы
            ищите во вкладке «Игры».
          </Text>
        </View>
      </View>
    </ScreenTransition>
  );
}
