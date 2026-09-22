import { Stack } from 'expo-router';

import { stackScreenOptions } from '@/constants/navigation.config';
import { useTheme } from '@/hooks/use-theme';

export default function AuthorsLayout() {
  const colors = useTheme();

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.background, flex: 1 },
        ...stackScreenOptions,
      }}
    />
  );
}
