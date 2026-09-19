import { Redirect, Stack, usePathname, useRootNavigationState } from 'expo-router';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { AuthHeader } from '@/components/navigation/header';
import { MAIN_APP_ENTRY } from '@/components/ui/navigation/navbar.config';
import { stackScreenOptions } from '@/constants/navigation.config';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/hooks/use-theme';
import { QUESTIONNAIRE_ENTRY } from '@/screens/questionnaire/questionnaire.config';

function isEmailTokenPath(path: string) {
  const normalized = path.split('?')[0].replace(/\/$/, '');
  return (
    normalized.endsWith('/verify-email') ||
    normalized.endsWith('/reset-password') ||
    normalized.includes('/verify-email') ||
    normalized.includes('/reset-password')
  );
}

/** Prefer window path on web — usePathname can lag on first paint / static hydrate. */
function useIsEmailTokenRoute() {
  const pathname = usePathname();
  if (typeof window !== 'undefined' && isEmailTokenPath(window.location.pathname)) {
    return true;
  }
  return isEmailTokenPath(pathname);
}

export default function AuthLayout() {
  const pathname = usePathname();
  const navigationState = useRootNavigationState();
  const isEmailTokenRoute = useIsEmailTokenRoute();
  const { isAuthenticated, isLoading, redirectToQuestionnaire } = useAuth();
  const colors = useTheme();

  const navReady = Boolean(navigationState?.key);

  // Don't unmount token screens while session restores — otherwise verify never runs.
  if ((isLoading || !navReady) && !isEmailTokenRoute) {
    return (
      <View style={[styles.loader, { backgroundColor: colors.background }]}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (navReady && isAuthenticated && !isLoading && !isEmailTokenRoute) {
    return <Redirect href={redirectToQuestionnaire ? QUESTIONNAIRE_ENTRY : MAIN_APP_ENTRY} />;
  }

  return (
    <View style={styles.root}>
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { flex: 1 },
          ...stackScreenOptions,
        }}>
        <Stack.Screen name="login" />
        <Stack.Screen name="register" />
        <Stack.Screen name="forgot-password" />
        <Stack.Screen name="reset-password" />
        <Stack.Screen name="verify-email" />
      </Stack>
      {pathname.startsWith('/auth') || isEmailTokenRoute ? <AuthHeader /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  loader: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
