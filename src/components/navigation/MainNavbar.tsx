import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { useRouter } from 'expo-router';

import { navigateMainTab } from '@/components/navigation/navigate-main-tab';
import { Navbar } from '@/components/ui';
import { MAIN_NAVBAR_ITEMS } from '@/components/ui/navigation/navbar.config';
import { useAuth } from '@/context/AuthContext';

export function MainNavbar({ state }: BottomTabBarProps) {
  const router = useRouter();
  const { isAuthenticated } = useAuth();
  const activeKey = state.routes[state.index]?.name ?? MAIN_NAVBAR_ITEMS[0].key;

  return (
    <Navbar
      items={MAIN_NAVBAR_ITEMS}
      value={activeKey}
      onChange={(key) => {
        if (key === activeKey) {
          return;
        }

        navigateMainTab(router, key, { isAuthenticated });
      }}
    />
  );
}
