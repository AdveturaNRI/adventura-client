import { Redirect, Stack, usePathname } from 'expo-router';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { AuthHeader } from '@/components/navigation/header';
import { MAIN_APP_ENTRY } from '@/components/ui/navigation/navbar.config';
import { stackScreenOptions } from '@/constants/navigation.config';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/hooks/use-theme';
import { QUESTIONNAIRE_ENTRY } from '@/screens/questionnaire/questionnaire.config';

export default function AuthLayout() {
  const pathname = usePathname();
  const { isAuthenticated, isLoading, redirectToQuestionnaire } = useAuth();
  const colors = useTheme();

  if (isLoading) {
    return (
      <View style={[styles.loader, { backgroundColor: colors.background }]}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (isAuthenticated) {
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
      </Stack>
      {pathname.startsWith('/auth') ? <AuthHeader /> : null}
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
