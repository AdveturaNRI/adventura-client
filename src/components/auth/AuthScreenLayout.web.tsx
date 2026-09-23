import { ScrollView, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AuthScreenBackground } from './AuthBackgroundSlideshow';
import {
  AUTH_COMPACT_HEIGHT,
  createAuthScreenLayoutStyles,
  type AuthScreenLayoutProps,
} from './auth-screen-layout.styles';
import { useIsDesktopWeb } from '@/components/navigation/DesktopThemeToggle';
import { AppLogo } from '@/components/navigation/AppLogo';
import { Spacing } from '@/constants/theme';
import { useThemedStyles } from '@/hooks/use-themed-styles';

export function AuthScreenLayout({ children, contentStyle }: AuthScreenLayoutProps) {
  const isDesktop = useIsDesktopWeb();
  const { height } = useWindowDimensions();
  const compact = height < AUTH_COMPACT_HEIGHT;
  const styles = useThemedStyles((colors) =>
    createAuthScreenLayoutStyles(colors, isDesktop, compact),
  );
  const horizontalPadding = isDesktop ? Spacing.xl : Spacing.md;
  const verticalPadding = compact ? Spacing.md : isDesktop ? Spacing.xl : Spacing.md;
  const logoHeight = compact ? 34 : 38;

  return (
    <AuthScreenBackground>
      <SafeAreaView style={styles.content} edges={['top', 'bottom', 'left', 'right']}>
        <ScrollView
          style={styles.webScrollView}
          contentContainerStyle={[
            styles.webScrollContent,
            {
              paddingHorizontal: horizontalPadding,
              paddingVertical: verticalPadding,
            },
          ]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}>
          <View style={styles.webCardShell}>
            <View style={[styles.card, contentStyle]}>
              <View style={styles.logoWrap}>
                <AppLogo align="center" height={logoHeight} href={null} />
              </View>
              {children}
            </View>
          </View>
        </ScrollView>
      </SafeAreaView>
    </AuthScreenBackground>
  );
}
