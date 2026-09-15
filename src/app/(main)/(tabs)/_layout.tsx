import { Tabs } from 'expo-router';

import { useDiceBoxPrefetch } from '@/components/dice/use-dice-box-prefetch';
import { stackScreenOptions } from '@/constants/navigation.config';

export default function MainTabsLayout() {
  // Греем CDN заранее — пока пользователь в Играх/Чатах.
  useDiceBoxPrefetch();

  return (
    <Tabs
      initialRouteName="games"
      tabBar={() => null}
      screenOptions={{
        headerShown: false,
        ...stackScreenOptions,
      }}>
      <Tabs.Screen name="wanderers" options={{ title: 'Странники' }} />
      <Tabs.Screen name="games" options={{ title: 'Игры' }} />
      <Tabs.Screen name="clubs" options={{ title: 'Клубы' }} />
      <Tabs.Screen name="dice" options={{ title: 'Дайсы' }} />
      <Tabs.Screen name="generators" options={{ title: 'Генераторы' }} />
      <Tabs.Screen name="chats" options={{ title: 'Чаты' }} />
      <Tabs.Screen name="profile" options={{ title: 'Профиль' }} />
    </Tabs>
  );
}
