import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';

import { Navbar } from '@/components/ui';
import { MAIN_NAVBAR_ITEMS } from '@/components/ui/navigation/navbar.config';

export function MainNavbar({ state, navigation }: BottomTabBarProps) {
  const activeKey = state.routes[state.index]?.name ?? MAIN_NAVBAR_ITEMS[0].key;

  return (
    <Navbar
      items={MAIN_NAVBAR_ITEMS}
      value={activeKey}
      onChange={(key) => {
        if (key === activeKey) {
          return;
        }

        navigation.navigate(key);
      }}
    />
  );
}
