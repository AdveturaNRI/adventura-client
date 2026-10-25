import { Redirect } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { MAIN_APP_ENTRY } from '@/components/ui/navigation/navbar.config';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/hooks/use-theme';
import { resolveWelcomeRedirect } from '@/services/marketing/welcome';

export default function Index() {
  const { isLoading, isAuthenticated } = useAuth();
  const colors = useTheme();
  /** undefined — still resolving, null — nothing to show. */
  const [welcomeHref, setWelcomeHref] = useState<string | null | undefined>(undefined);
  const isGuest = !isLoading && !isAuthenticated;

  useEffect(() => {
    if (!isGuest) return;
    let cancelled = false;
    void resolveWelcomeRedirect().then((href) => {
      if (!cancelled) setWelcomeHref(href);
    });
    return () => {
      cancelled = true;
    };
  }, [isGuest]);

  if (isLoading || (isGuest && welcomeHref === undefined)) {
    return (
      <View style={[styles.loader, { backgroundColor: colors.background }]}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (isGuest && welcomeHref) {
    return <Redirect href={welcomeHref as never} />;
  }

  return <Redirect href={MAIN_APP_ENTRY} />;
}

const styles = StyleSheet.create({
  loader: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
