import { Redirect, Stack, usePathname } from 'expo-router';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { AppChrome } from '@/components/navigation/AppChrome';
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
      <Stack.Screen name="author-cabinet" />
      <Stack.Screen name="my-clubs" />
      <Stack.Screen name="music-library" />
      <Stack.Screen name="clubs-create" />
      <Stack.Screen name="clubs/[id]" />
      <Stack.Screen name="my-games" />
      <Stack.Screen name="games-create" />
      <Stack.Screen name="games-edit" />
      <Stack.Screen name="games-manage" />
      <Stack.Screen name="games/[id]" />
      <Stack.Screen name="users/[id]" />
      <Stack.Screen name="authors" />
      <Stack.Screen name="news" />
      <Stack.Screen name="handbook" />
      <Stack.Screen name="rewards-lab" />
      <Stack.Screen name="profile-appearance" />
    </Stack>
  );
}

export default function MainLayout() {
  const { isAuthenticated, isLoading } = useAuth();
  const pathname = usePathname();
  const colors = useTheme();

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

  return (
    <AppChrome>
      <MainStack />
    </AppChrome>
  );
}

const styles = StyleSheet.create({
  loader: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
