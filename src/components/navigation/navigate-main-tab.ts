import type { Href, Router } from 'expo-router';

import type { NavbarIconKey } from '@/components/ui/navigation/navbar-icon-assets';
import { buildLoginHref, isPublicTabKey } from '@/constants/auth-routes';

/** Переключение главных вкладок без dismissTo — он ломается на вложенных стеках (чаты и т.п.). */
export function navigateMainTab(
  router: Router,
  tabKey: NavbarIconKey | string,
  options?: { isAuthenticated?: boolean },
) {
  if (options?.isAuthenticated === false && !isPublicTabKey(tabKey)) {
    router.push(buildLoginHref(`/${tabKey}`));
    return;
  }

  router.navigate(`/${tabKey}` as Href);
}
