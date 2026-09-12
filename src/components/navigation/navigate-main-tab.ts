import { type Href, type Router } from 'expo-router';

import type { NavbarIconKey } from '@/components/ui/navigation/navbar-icon-assets';

/** Переключение главных вкладок без dismissTo — он ломается на вложенных стеках (чаты и т.п.). */
export function navigateMainTab(router: Router, tabKey: NavbarIconKey | string) {
  router.navigate(`/${tabKey}` as Href);
}
