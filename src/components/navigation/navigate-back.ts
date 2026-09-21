import { type Href, type Router } from 'expo-router';
import { Platform } from 'react-native';

import { MAIN_APP_ENTRY } from '@/components/ui/navigation/navbar.config';

/** Внутренний путь приложения — без open-redirect. */
export function isSafeAppHref(value: string): boolean {
  return value.startsWith('/') && !value.startsWith('//') && !value.includes('://');
}

/** Собрать backHref из returnTo (+ optional id) после кросс-флоу в чат. */
export function resolveChatReturnHref(
  returnTo: string | string[] | undefined,
  returnToId?: string | string[] | undefined,
): Href | undefined {
  const path = Array.isArray(returnTo) ? returnTo[0] : returnTo;
  const id = Array.isArray(returnToId) ? returnToId[0] : returnToId;

  if (typeof path !== 'string' || !isSafeAppHref(path)) {
    return undefined;
  }

  if (typeof id === 'string' && id.length > 0) {
    const base = path.split('?')[0] ?? path;
    return `${base}?id=${encodeURIComponent(id)}` as Href;
  }

  return path as Href;
}

type NavigateBackOptions = {
  router: Pick<Router, 'back' | 'canGoBack' | 'replace'>;
  /** Явный fallback, если истории нет. */
  fallbackHref?: Href;
  /** Текущий pathname — чтобы подобрать осмысленный fallback. */
  pathname?: string | null;
  /** canGoBack только у stack-навигатора (не tab — иначе firstRoute → странники). */
  navigationCanGoBack?: boolean;
  navigationGoBack?: () => void;
};

function fallbackForPath(pathname: string | null | undefined): Href {
  if (!pathname) {
    return MAIN_APP_ENTRY;
  }

  if (pathname.startsWith('/chats/')) {
    return '/chats';
  }
  if (pathname.startsWith('/games/') || pathname.startsWith('/games-')) {
    return '/games';
  }
  if (pathname.startsWith('/clubs/') || pathname === '/clubs-create') {
    return '/clubs';
  }
  if (pathname.startsWith('/users/')) {
    return '/wanderers';
  }
  if (
    pathname === '/notifications' ||
    pathname === '/master-room' ||
    pathname === '/my-games' ||
    pathname === '/my-clubs' ||
    pathname === '/settings' ||
    pathname === '/questionnaire' ||
    pathname === '/profile-appearance'
  ) {
    return '/profile';
  }

  return MAIN_APP_ENTRY;
}

function canUseBrowserHistoryBack(): boolean {
  if (Platform.OS !== 'web' || typeof window === 'undefined') {
    return false;
  }

  try {
    // SPA-переходы через Expo увеличивают history.length.
    // На холодном заходе обычно 1–2 — тогда лучше не выкидывать из приложения.
    return window.history.length > 1;
  } catch {
    return false;
  }
}

/**
 * Шаг назад по реальной истории. Fallback — только если идти некуда.
 *
 * Сначала router.back(): он знает кросс-навигаторные переходы
 * (games-manage → /chats/id). navigation.goBack() на табах с
 * backBehavior=firstRoute уводит на первый таб (странники) — это не «назад».
 */
export function navigateBack({
  router,
  fallbackHref,
  pathname,
  navigationCanGoBack,
  navigationGoBack,
}: NavigateBackOptions) {
  if (router.canGoBack()) {
    router.back();
    return;
  }

  if (navigationCanGoBack && navigationGoBack) {
    navigationGoBack();
    return;
  }

  if (canUseBrowserHistoryBack()) {
    window.history.back();
    return;
  }

  router.replace(fallbackHref ?? fallbackForPath(pathname));
}
