import { Redirect, Stack, usePathname } from 'expo-router';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { MobileAppMenuProvider } from '@/components/navigation/MobileAppMenuContext';
import { MainDesktopHeader } from '@/components/navigation/MainDesktopHeader';
import { MainDesktopSidebar } from '@/components/navigation/MainDesktopSidebar';
import { useIsDesktopSidebarVisible, useIsDesktopWeb } from '@/components/navigation/DesktopThemeToggle';
import { stackScreenOptions } from '@/constants/navigation.config';
import { buildLoginHref, isPublicAppPath } from '@/constants/auth-routes';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/hooks/use-theme';

function MainStack() {
  const colors = useTheme();

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.background, flex: 1 },
        ...stackScreenOptions,
      }}>
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="notifications" />
      <Stack.Screen name="settings" />
      <Stack.Screen name="questionnaire" />
      <Stack.Screen name="master-room" />
      <Stack.Screen name="my-clubs" />
      <Stack.Screen name="clubs-create" />
      <Stack.Screen name="clubs/[id]" />
      <Stack.Screen name="my-games" />
      <Stack.Screen name="games-create" />
      <Stack.Screen name="games-edit" />
      <Stack.Screen name="games-manage" />
      <Stack.Screen name="games/[id]" />
      <Stack.Screen name="users/[id]" />
      <Stack.Screen name="rewards-lab" />
      <Stack.Screen name="profile-appearance" />
    </Stack>
  );
}

export default function MainLayout() {
  const { isAuthenticated, isLoading } = useAuth();
  const pathname = usePathname();
  const colors = useTheme();
  const isDesktopWeb = useIsDesktopWeb();
  const showDesktopSidebar = useIsDesktopSidebarVisible();

  if (isLoading) {
    return (
      <View style={[styles.loader, { backgroundColor: colors.background }]}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (!isAuthenticated && !isPublicAppPath(pathname)) {
    return <Redirect href={buildLoginHref(pathname)} />;
  }

  if (isDesktopWeb) {
    return (
      <MobileAppMenuProvider>
        <View style={styles.root}>
          <View style={styles.desktopShell}>
            {showDesktopSidebar ? <MainDesktopSidebar /> : null}
            <View style={styles.desktopMain}>
              <MainDesktopHeader />
              <View style={styles.content}>
                <MainStack />
              </View>
            </View>
          </View>
        </View>
      </MobileAppMenuProvider>
    );
  }

  return (
    <MobileAppMenuProvider>
      <View style={styles.root}>
        <View style={styles.content}>
          <MainStack />
        </View>
      </View>
    </MobileAppMenuProvider>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  desktopShell: {
    flex: 1,
    flexDirection: 'row',
  },
  desktopMain: {
    flex: 1,
  },
  content: {
    flex: 1,
  },
  loader: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
