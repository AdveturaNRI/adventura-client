import type { Href } from 'expo-router';

import type { NavbarIconKey } from '@/components/ui/navigation/navbar-icon-assets';

/** Вкладки, доступные без входа. */
export const PUBLIC_TAB_KEYS = [
  'games',
  'authors',
  'handbook',
  'clubs',
  'dice',
  'generators',
] as const satisfies readonly NavbarIconKey[];

export type PublicTabKey = (typeof PUBLIC_TAB_KEYS)[number];

const PUBLIC_TAB_SET = new Set<string>(PUBLIC_TAB_KEYS);

export function isPublicTabKey(key: string): key is PublicTabKey {
  return PUBLIC_TAB_SET.has(key);
}

function normalizePath(pathname: string): string {
  const withoutQuery = pathname.split('?')[0] ?? '/';
  if (withoutQuery.length > 1 && withoutQuery.endsWith('/')) {
    return withoutQuery.slice(0, -1);
  }
  return withoutQuery || '/';
}

/**
 * Маршруты приложения, которые можно открыть анонимно.
 * Детали игры/клуба тоже публичны (просмотр); create/manage/my-* — нет.
 */
export function isPublicAppPath(pathname: string): boolean {
  const path = normalizePath(pathname);

  if (path === '/' || path === '') return true;
  if (path.startsWith('/auth')) return true;
  if (path.startsWith('/l/')) return true;
  if (path.startsWith('/ui-lib')) return true;

  if (
    path === '/games' ||
    path === '/authors' ||
    path === '/handbook' ||
    path === '/clubs' ||
    path === '/dice' ||
    path === '/generators'
  ) {
    return true;
  }

  if (/^\/games\/[^/]+$/.test(path)) return true;
  if (/^\/clubs\/[^/]+$/.test(path)) return true;
  if (/^\/authors\/[^/]+$/.test(path)) return true;
  if (/^\/authors\/[^/]+\/posts\/[^/]+$/.test(path)) return true;
  if (/^\/handbook\/[^/]+$/.test(path)) return true;

  return false;
}

export function buildLoginHref(returnTo?: string | null): Href {
  const next = returnTo?.trim();
  if (!next || next === '/' || next.startsWith('/auth')) {
    return '/auth/login';
  }
  return {
    pathname: '/auth/login',
    params: { next },
  };
}

export function resolvePostLoginHref(next?: string | null): Href {
  const value = next?.trim();
  if (!value || !value.startsWith('/') || value.startsWith('/auth')) {
    return '/games';
  }
  return value as Href;
}
