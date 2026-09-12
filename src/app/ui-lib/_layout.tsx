import { Stack } from 'expo-router';

import { stackScreenOptions } from '@/constants/navigation.config';

export default function UiLibLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        ...stackScreenOptions,
      }}>
      <Stack.Screen name="components" />
    </Stack>
  );
}
