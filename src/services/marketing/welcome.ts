import AsyncStorage from '@react-native-async-storage/async-storage';
import type { useRouter } from 'expo-router';
import { Linking, Platform } from 'react-native';

import { apiRequest } from '@/services/api/client';

/** Link set in the admin: opens once per device on the home page and behind «О проекте». */
export type WelcomeLanding = {
  url: string;
};

type AppRouter = ReturnType<typeof useRouter>;

const SEEN_KEY_PREFIX = 'adventura.welcome-landing.seen.';
const CONFIG_TIMEOUT_MS = 2500;

let configPromise: Promise<WelcomeLanding | null> | null = null;
let resolvedLanding: WelcomeLanding | null | undefined;

function normalize(value: unknown): WelcomeLanding | null {
  const url = (value as { url?: unknown } | null | undefined)?.url;
  return typeof url === 'string' && url.trim() ? { url: url.trim() } : null;
}

export function isInternalUrl(url: string): boolean {
  return url.startsWith('/') && !url.startsWith('//');
}

function normalizePath(path: string): string {
  const trimmed = path.split(/[?#]/)[0] ?? '';
  return trimmed.length > 1 ? trimmed.replace(/\/+$/, '') : trimmed;
}

function landingPath(url: string): string | null {
  if (isInternalUrl(url)) return normalizePath(url);
  if (Platform.OS !== 'web' || typeof window === 'undefined') return null;
  try {
    const parsed = new URL(url);
    return parsed.origin === window.location.origin ? normalizePath(parsed.pathname) : null;
  } catch {
    return null;
  }
}

/** True when `pathname` is the page behind «О проекте» (it gets the app navigation). */
export function isWelcomeLandingPath(landing: WelcomeLanding | null, pathname: string): boolean {
  if (!landing) return false;
  const target = landingPath(landing.url);
  return target != null && target === normalizePath(pathname);
}

/** Already loaded config, so the first render doesn't wait for the request. */
export function peekWelcomeLanding(): WelcomeLanding | null {
  return resolvedLanding ?? null;
}

function openExternalUrl(url: string, sameTab: boolean): void {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    if (sameTab) window.location.assign(url);
    else window.open(url, '_blank', 'noopener,noreferrer');
    return;
  }
  void Linking.openURL(url);
}

export function getWelcomeLanding(): Promise<WelcomeLanding | null> {
  configPromise ??= apiRequest<{ welcomeLanding?: unknown }>('/config/public', {
    skipAuth: true,
    skipAuthRefresh: true,
    skipLoading: true,
  })
    .then((payload) => {
      resolvedLanding = normalize(payload.welcomeLanding);
      return resolvedLanding;
    })
    .catch(() => {
      configPromise = null;
      return null;
    });
  return configPromise;
}

export function openAboutLanding(router: AppRouter, landing: WelcomeLanding): void {
  if (isInternalUrl(landing.url)) {
    router.push(landing.url as never);
    return;
  }
  openExternalUrl(landing.url, false);
}

async function hasSeen(url: string): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(SEEN_KEY_PREFIX + url)) != null;
  } catch {
    return false;
  }
}

async function markSeen(url: string): Promise<void> {
  try {
    await AsyncStorage.setItem(SEEN_KEY_PREFIX + url, new Date().toISOString());
  } catch {
    // Storage may be unavailable (private mode); worst case the landing shows again.
  }
}

/** A direct visit (ad link with UTM) counts as seen, so the home page won't redirect there again. */
export function markWelcomeLandingSeen(landing: WelcomeLanding): void {
  void markSeen(landing.url);
}

/** Carries `/?utm_source=…` over to the landing: metrics read UTM from its URL. */
function withCurrentQuery(url: string): string {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return url;
  const query = window.location.search.replace(/^\?/, '');
  if (!query) return url;
  const [base = '', hash] = url.split('#');
  const joined = `${base}${base.includes('?') ? '&' : '?'}${query}`;
  return hash != null ? `${joined}#${hash}` : joined;
}

/**
 * Internal href to redirect a first-time visitor to, or null to open the app as usual.
 * External links are opened here directly. Marks the link as seen before
 * leaving so a broken landing can't loop the redirect.
 */
export async function resolveWelcomeRedirect(): Promise<string | null> {
  const landing = await Promise.race([
    getWelcomeLanding(),
    new Promise<null>((resolve) => setTimeout(() => resolve(null), CONFIG_TIMEOUT_MS)),
  ]);
  if (!landing || (await hasSeen(landing.url))) return null;
  await markSeen(landing.url);
  if (isInternalUrl(landing.url)) return withCurrentQuery(landing.url);
  openExternalUrl(landing.url, true);
  return null;
}
