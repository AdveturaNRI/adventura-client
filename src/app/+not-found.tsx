import { Stack } from 'expo-router';

import NotFoundScreen from '@/screens/errors/NotFoundScreen';

export default function NotFoundRoute() {
  return (
    <>
      <Stack.Screen options={{ title: 'Страница не найдена', headerShown: false }} />
      <NotFoundScreen />
    </>
  );
}
