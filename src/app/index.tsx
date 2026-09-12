import { Redirect } from 'expo-router';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { MAIN_APP_ENTRY } from '@/components/ui/navigation/navbar.config';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/hooks/use-theme';

export default function Index() {
  const { isAuthenticated, isLoading } = useAuth();
  const colors = useTheme();

  if (isLoading) {
    return (
      <View style={[styles.loader, { backgroundColor: colors.background }]}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (isAuthenticated) {
    return <Redirect href={MAIN_APP_ENTRY} />;
  }

  return <Redirect href="/auth/login" />;
}

const styles = StyleSheet.create({
  loader: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
