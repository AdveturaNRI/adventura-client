import 'react-native-gesture-handler';

import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Platform, StyleSheet, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { stackScreenOptions } from '@/constants/navigation.config';
import { AppToast } from '@/components/ui';
import { GlobalLoadingOverlay } from '@/components/ui/feedback/GlobalLoadingOverlay';
import { YandexMetrikaTracker } from '@/components/analytics/YandexMetrikaTracker';
import { ThemeProvider } from '@/context/ThemeContext';
import { AuthProvider } from '@/context/AuthContext';
import { ProfileProvider } from '@/context/ProfileContext';
import { PushPromptProvider } from '@/context/PushPromptContext';
import { RealtimeProvider } from '@/context/RealtimeContext';
import { VoiceCallProvider } from '@/context/VoiceCallContext';
import { MusicPlayerProvider } from '@/context/MusicPlayerContext';
import { AuthorsProvider } from '@/context/AuthorsContext';
import { useTheme, useThemePreference } from '@/hooks/use-theme';
import { registerLivekitGlobals } from '@/services/livekit/platform';

registerLivekitGlobals();

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
  return (
    <GestureHandlerRootView style={rootStyles.container}>
      <SafeAreaProvider>
        <ThemeProvider>
          <AuthProvider>
            <RealtimeProvider>
              <ProfileProvider>
                <AuthorsProvider>
                  <VoiceCallProvider>
                    <MusicPlayerProvider>
                      <PushPromptProvider>
                        <View style={rootStyles.container}>
                          <YandexMetrikaTracker />
                          <RootNavigator />
                          <AppToast />
                          <GlobalLoadingOverlay />
                        </View>
                      </PushPromptProvider>
                    </MusicPlayerProvider>
                  </VoiceCallProvider>
                </AuthorsProvider>
              </ProfileProvider>
            </RealtimeProvider>
          </AuthProvider>
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const rootStyles = StyleSheet.create({
  container: {
    flex: 1,
    width: '100%',
    ...(Platform.OS === 'web' ? { height: '100%' } : null),
  },
});
