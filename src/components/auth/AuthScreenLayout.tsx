import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  View,
  type LayoutChangeEvent,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AuthScreenBackground } from './AuthBackgroundSlideshow';
import {
  createAuthScreenLayoutStyles,
  type AuthScreenLayoutProps,
} from './auth-screen-layout.styles';
import { AppLogo } from '@/components/navigation/AppLogo';
import { ScreenTransition } from '@/components/navigation/ScreenTransition';
import { Spacing } from '@/constants/theme';
import { useThemedStyles } from '@/hooks/use-themed-styles';

const VERTICAL_PADDING = 0;

export function AuthScreenLayout({ children, contentStyle }: AuthScreenLayoutProps) {
  const styles = useThemedStyles(createAuthScreenLayoutStyles);
  const [viewportHeight, setViewportHeight] = useState(0);
  const [contentHeight, setContentHeight] = useState(0);

  const fitsOnScreen =
    viewportHeight > 0 &&
    contentHeight > 0 &&
    contentHeight + VERTICAL_PADDING * 2 + Spacing.md <= viewportHeight;

  const edgePadding = fitsOnScreen
    ? Math.max(VERTICAL_PADDING, (viewportHeight - contentHeight) / 2)
    : VERTICAL_PADDING;
  const bottomPadding = fitsOnScreen ? edgePadding : 0;

  const handleViewportLayout = (event: LayoutChangeEvent) => {
    setViewportHeight(event.nativeEvent.layout.height);
  };

  const handleContentLayout = (event: LayoutChangeEvent) => {
    setContentHeight(event.nativeEvent.layout.height);
  };

  const card = (
    <View style={[styles.card, contentStyle]}>
      <View style={styles.logoWrap}>
        <AppLogo align="center" height={48} href={null} />
      </View>
      {children}
    </View>
  );

  return (
    <AuthScreenBackground>
      <ScreenTransition>
        <SafeAreaView style={styles.content} edges={['top', 'left', 'right']}>
          <KeyboardAvoidingView
            style={styles.content}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
            <ScrollView
              style={styles.scrollView}
              onLayout={handleViewportLayout}
              contentContainerStyle={[
                styles.scrollContent,
                {
                  paddingHorizontal: Spacing.md,
                  paddingTop: edgePadding,
                  paddingBottom: bottomPadding,
                },
              ]}
              contentInsetAdjustmentBehavior="never"
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
              alwaysBounceVertical={!fitsOnScreen}
              bounces={!fitsOnScreen}>
              <View style={styles.cardShell} onLayout={handleContentLayout}>
                {card}
              </View>
            </ScrollView>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </ScreenTransition>
    </AuthScreenBackground>
  );
}
