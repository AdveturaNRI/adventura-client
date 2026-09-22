import { type Href, type Router } from 'expo-router';

import type { NavbarIconKey } from '@/components/ui/navigation/navbar-icon-assets';

/** Корень раздела (`/authors`), без вложенных страниц вроде `/authors/:id/posts/:postId`. */
export function isMainTabRoot(pathname: string | null | undefined, tabKey: string): boolean {
  if (!pathname) {
    return false;
  }

  return pathname === `/${tabKey}` || pathname === `/${tabKey}/`;
}

/** Переключение главных вкладок без dismissTo — он ломается на вложенных стеках (чаты и т.п.). */
export function navigateMainTab(router: Router, tabKey: NavbarIconKey | string) {
  router.navigate(`/${tabKey}` as Href);
}

/**
 * Клик по пункту навигации: с вложенного маршрута всегда уходим в корень раздела,
 * а повторный клик уже на корне — no-op.
 */
export function navigateMainTabFromNav(
  router: Router,
  tabKey: NavbarIconKey | string,
  pathname: string | null | undefined,
) {
  if (isMainTabRoot(pathname, tabKey)) {
    return;
  }

  navigateMainTab(router, tabKey);
}
