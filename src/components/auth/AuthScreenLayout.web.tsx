import { View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AuthScreenBackground } from './AuthBackgroundSlideshow';
import {
  createAuthScreenLayoutStyles,
  type AuthScreenLayoutProps,
} from './auth-screen-layout.styles';
import { AppLogo } from '@/components/navigation/AppLogo';
import { Spacing } from '@/constants/theme';
import { useThemedStyles } from '@/hooks/use-themed-styles';

export function AuthScreenLayout({ children, contentStyle }: AuthScreenLayoutProps) {
  const styles = useThemedStyles(createAuthScreenLayoutStyles);
  const horizontalPadding = Spacing.md;

  return (
    <AuthScreenBackground>
      <SafeAreaView style={styles.content} edges={['top', 'bottom', 'left', 'right']}>
        <View
          style={[
            styles.webOverlay,
            {
              paddingHorizontal: horizontalPadding,
              paddingVertical: Spacing.xl,
            },
          ]}>
          <View style={styles.webCardShell}>
            <View style={[styles.card, contentStyle]}>
              <View style={styles.logoWrap}>
                <AppLogo align="center" height={48} href={null} />
              </View>
              {children}
            </View>
          </View>
        </View>
      </SafeAreaView>
    </AuthScreenBackground>
  );
}
