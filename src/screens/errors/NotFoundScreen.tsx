import { type Href, useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { NotFoundArt } from '@/components/errors/NotFoundArt';
import { ScreenTransition } from '@/components/navigation/ScreenTransition';
import { navigateBack } from '@/components/navigation/navigate-back';
import { Button } from '@/components/ui';
import { MAIN_APP_ENTRY } from '@/components/ui/navigation/navbar.config';
import { FontSize, Radius, Spacing, type ThemeColors } from '@/constants/theme';
import { useThemedStyles } from '@/hooks/use-themed-styles';

const QUICK_LINKS: { label: string; href: Href }[] = [
  { label: 'Поиск игр', href: '/games' },
  { label: 'Странники', href: '/wanderers' },
  { label: 'Чаты', href: '/chats' },
];

function createStyles(colors: ThemeColors, compact: boolean) {
  return StyleSheet.create({
    safe: {
      flex: 1,
      backgroundColor: colors.background,
    },
    root: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: Spacing.lg,
      paddingVertical: compact ? Spacing.md : Spacing.xl,
    },
    content: {
      width: '100%',
      maxWidth: 420,
      alignItems: 'center',
      gap: compact ? Spacing.md : Spacing.lg,
    },
    code: {
      fontSize: compact ? 56 : 72,
      lineHeight: compact ? 60 : 76,
      fontWeight: '800',
      color: colors.primary,
      letterSpacing: 2,
    },
    title: {
      fontSize: compact ? FontSize.button : FontSize.h1,
      lineHeight: compact ? FontSize.button * 1.35 : FontSize.h1 * 1.25,
      fontWeight: '600',
      color: colors.text,
      textAlign: 'center',
    },
    body: {
      fontSize: FontSize.label,
      lineHeight: FontSize.label * 1.45,
      color: colors.textSecondary,
      textAlign: 'center',
      maxWidth: 360,
    },
    actions: {
      width: '100%',
      gap: Spacing.sm,
      marginTop: Spacing.xs,
    },
    quickLinks: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      justifyContent: 'center',
      gap: Spacing.sm,
      marginTop: Spacing.xs,
    },
    quickLink: {
      paddingHorizontal: Spacing.md,
      paddingVertical: Spacing.sm,
      borderRadius: Radius.pill,
      backgroundColor: `${colors.primary}18`,
    },
    quickLinkPressed: {
      opacity: 0.8,
    },
    quickLinkLabel: {
      fontSize: FontSize.caption,
      fontWeight: '600',
      color: colors.primary,
    },
  });
}

export default function NotFoundScreen() {
  const router = useRouter();
  const { height } = useWindowDimensions();
  const compact = height < 700;
  const styles = useThemedStyles((colors) => createStyles(colors, compact));

  const goHome = () => {
    router.replace(MAIN_APP_ENTRY);
  };

  const goBack = () => {
    navigateBack({ router, fallbackHref: MAIN_APP_ENTRY });
  };

  return (
    <ScreenTransition>
      <SafeAreaView style={styles.safe} edges={['top', 'right', 'bottom', 'left']}>
        <View style={styles.root}>
          <View style={styles.content}>
            <Text style={styles.code} accessibilityRole="header">
              404
            </Text>
            <NotFoundArt size={compact ? 108 : 140} />
            <Text style={styles.title}>Критический провал проверки на Внимательность</Text>
            <Text style={styles.body}>
              Похоже, эта страница была развеяна магией или переместилась на другой план бытия.
            </Text>

            <View style={styles.actions}>
              <Button label="К ленте игр" onPress={goHome} />
              <Button label="Назад" variant="outline" onPress={goBack} />
            </View>

            <View style={styles.quickLinks}>
              {QUICK_LINKS.map((link) => (
                <Pressable
                  key={link.href.toString()}
                  accessibilityRole="link"
                  accessibilityLabel={link.label}
                  onPress={() => router.replace(link.href)}
                  style={({ pressed }) => [styles.quickLink, pressed && styles.quickLinkPressed]}>
                  <Text style={styles.quickLinkLabel}>{link.label}</Text>
                </Pressable>
              ))}
            </View>
          </View>
        </View>
      </SafeAreaView>
    </ScreenTransition>
  );
}
