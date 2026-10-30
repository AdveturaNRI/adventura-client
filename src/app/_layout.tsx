import 'react-native-gesture-handler';

import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { FontDisplay, useFonts, type FontSource } from 'expo-font';
import { Stack, usePathname } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Platform, StyleSheet, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { stackScreenOptions } from '@/constants/navigation.config';
import { AppToast } from '@/components/ui';
import { DesktopBridge } from '@/components/desktop/DesktopBridge';
import { GlobalLoadingOverlay } from '@/components/ui/feedback/GlobalLoadingOverlay';
import { YandexMetrikaTracker } from '@/components/analytics/YandexMetrikaTracker';
import { SeoHead } from '@/components/seo/SeoHead';
import { VkPixelTracker } from '@/components/analytics/VkPixelTracker';
import { ThemeProvider } from '@/context/ThemeContext';
import { AnnouncementProvider } from '@/context/AnnouncementContext';
import { AuthProvider } from '@/context/AuthContext';
import { ProfileProvider } from '@/context/ProfileContext';
import { PushPromptProvider } from '@/context/PushPromptContext';
import { RealtimeProvider } from '@/context/RealtimeContext';
import { VoiceCallProvider } from '@/context/VoiceCallContext';
import { MusicPlayerProvider } from '@/context/MusicPlayerContext';
import { AuthorsProvider } from '@/context/AuthorsContext';
import { NewsProvider } from '@/context/NewsContext';
import { useTheme, useThemePreference } from '@/hooks/use-theme';
import { useWelcomeLanding } from '@/hooks/use-welcome-landing';
import { registerLivekitGlobals } from '@/services/livekit/platform';
import { isWelcomeLandingPath } from '@/services/marketing/welcome';

registerLivekitGlobals();

/**
 * Icon fonts registered at the root: the static export inlines @font-face + preload into the HTML,
 * and `block` keeps glyphs invisible (not tofu squares) until the file arrives.
 */
const ICON_FONTS: Record<string, FontSource> = Object.fromEntries(
  Object.entries({ ...Ionicons.font, ...MaterialCommunityIcons.font }).map(([family, asset]) => [
    family,
    { uri: asset, display: FontDisplay.BLOCK },
  ]),
);

function RootNavigator() {
  const colors = useTheme();
  const { colorScheme } = useThemePreference();

  return (
    <>
      <StatusBar style={colorScheme === 'dark' ? 'light' : 'dark'} />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.background, flex: 1 },
          ...stackScreenOptions,
        }}>
        <Stack.Screen name="(main)" />
        <Stack.Screen name="auth" />
        <Stack.Screen name="+not-found" />
      </Stack>
    </>
  );
}

export default function RootLayout() {
  useFonts(ICON_FONTS);

  return (
    <GestureHandlerRootView style={rootStyles.container}>
      <SafeAreaProvider>
        <ThemeProvider>
          <AppRouteProviders />
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

function AppRouteProviders() {
  const pathname = usePathname();
  const welcomeLanding = useWelcomeLanding();
  // Ad landings skip session and realtime; the «О проекте» page is part of the app.
  const isPublicLanding =
    (pathname === '/l' || pathname.startsWith('/l/')) &&
    !isWelcomeLandingPath(welcomeLanding, pathname);
  const navigator = (
    <View style={rootStyles.container}>
      <SeoHead />
      <YandexMetrikaTracker />
      <VkPixelTracker />
      {!isPublicLanding ? <DesktopBridge /> : null}
      <RootNavigator />
      {!isPublicLanding ? <AppToast /> : null}
      {!isPublicLanding ? <GlobalLoadingOverlay /> : null}
    </View>
  );

  return (
    <AuthProvider enabled={!isPublicLanding}>
      {isPublicLanding ? (
        navigator
      ) : (
        <RealtimeProvider>
          <ProfileProvider>
            <AuthorsProvider>
              <NewsProvider>
                <VoiceCallProvider>
                  <MusicPlayerProvider>
                    <PushPromptProvider>
                      <AnnouncementProvider>{navigator}</AnnouncementProvider>
                    </PushPromptProvider>
                  </MusicPlayerProvider>
                </VoiceCallProvider>
              </NewsProvider>
            </AuthorsProvider>
          </ProfileProvider>
        </RealtimeProvider>
      )}
    </AuthProvider>
  );
}

const rootStyles = StyleSheet.create({
  container: {
    flex: 1,
    width: '100%',
    ...(Platform.OS === 'web' ? { height: '100%' } : null),
  },
});
