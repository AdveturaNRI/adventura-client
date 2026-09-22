import { Redirect, Stack, useLocalSearchParams, usePathname, useRootNavigationState } from 'expo-router';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { AuthHeader } from '@/components/navigation/header';
import { stackScreenOptions } from '@/constants/navigation.config';
import { resolvePostLoginHref } from '@/constants/auth-routes';
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

function isOauthCallbackPath(path: string) {
  const normalized = path.split('?')[0].replace(/\/$/, '');
  return (
    normalized.includes('/auth/oauth/') &&
    normalized.endsWith('/callback')
  );
}

/** Prefer window path on web — usePathname can lag on first paint / static hydrate. */
function useIsPassthroughAuthRoute() {
  const pathname = usePathname();
  if (typeof window !== 'undefined') {
    const winPath = window.location.pathname;
    if (isEmailTokenPath(winPath) || isOauthCallbackPath(winPath)) {
      return true;
    }
  }
  return isEmailTokenPath(pathname) || isOauthCallbackPath(pathname);
}

export default function AuthLayout() {
  const pathname = usePathname();
  const params = useLocalSearchParams<{ next?: string | string[] }>();
  const nextParam = Array.isArray(params.next) ? params.next[0] : params.next;
  const navigationState = useRootNavigationState();
  const isPassthroughRoute = useIsPassthroughAuthRoute();
  const { isAuthenticated, isLoading, redirectToQuestionnaire } = useAuth();
  const colors = useTheme();

  const navReady = Boolean(navigationState?.key);

  // Don't unmount token/oauth screens while session restores — otherwise verify never runs.
  if ((isLoading || !navReady) && !isPassthroughRoute) {
    return (
      <View style={[styles.loader, { backgroundColor: colors.background }]}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (navReady && isAuthenticated && !isLoading && !isPassthroughRoute) {
    return (
      <Redirect
        href={
          redirectToQuestionnaire
            ? QUESTIONNAIRE_ENTRY
            : resolvePostLoginHref(nextParam)
        }
      />
    );
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
        <Stack.Screen name="oauth/yandex/callback" />
      </Stack>
      {pathname.startsWith('/auth') || isPassthroughRoute ? <AuthHeader /> : null}
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
