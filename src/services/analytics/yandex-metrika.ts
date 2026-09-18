import { Platform } from 'react-native';

import { apiRequest } from '@/services/api/client';

type YmFn = (
  counterId: number | string,
  method: string,
  ...args: unknown[]
) => void;

declare global {
  interface Window {
    ym?: YmFn;
  }
}

export type YandexMetrikaRuntimeConfig = {
  counterId: string;
  webvisor: boolean;
  clickmap: boolean;
  trackLinks: boolean;
  accurateTrackBounce: boolean;
};

const ENV_COUNTER_ID = process.env.EXPO_PUBLIC_YANDEX_METRIKA_ID?.trim() ?? '';

let resolvedId: string | null = null;
let bootPromise: Promise<string | null> | null = null;
let initializedId: string | null = null;

function normalizeCounterId(raw: string | null | undefined): string | null {
  const trimmed = raw?.trim() ?? '';
  return /^\d+$/.test(trimmed) ? trimmed : null;
}

export function getYandexMetrikaId(): string | null {
  if (Platform.OS !== 'web') {
    return null;
  }
  return resolvedId ?? normalizeCounterId(ENV_COUNTER_ID);
}

function ym(...args: Parameters<YmFn>): void {
  if (typeof window === 'undefined' || typeof window.ym !== 'function') {
    return;
  }
  try {
    window.ym(...args);
  } catch {
    // ignore Metrika failures
  }
}

function loadTagScript(): Promise<void> {
  if (typeof document === 'undefined') {
    return Promise.resolve();
  }
  if (typeof window.ym === 'function') {
    return Promise.resolve();
  }

  return new Promise((resolve) => {
    const existing = document.querySelector<HTMLScriptElement>(
      'script[src="https://mc.yandex.ru/metrika/tag.js"]',
    );
    if (existing) {
      existing.addEventListener('load', () => resolve(), { once: true });
      existing.addEventListener('error', () => resolve(), { once: true });
      // ym stub may already exist from +html bootstrap
      if (typeof window.ym === 'function') {
        resolve();
      }
      return;
    }

    window.ym =
      window.ym ||
      function (...args: unknown[]) {
        (window.ym as YmFn & { a?: unknown[] }).a =
          (window.ym as YmFn & { a?: unknown[] }).a || [];
        (window.ym as YmFn & { a?: unknown[] }).a!.push(args);
      };

    const script = document.createElement('script');
    script.async = true;
    script.src = 'https://mc.yandex.ru/metrika/tag.js';
    script.onload = () => resolve();
    script.onerror = () => resolve();
    document.head.appendChild(script);
  });
}

function initCounter(config: YandexMetrikaRuntimeConfig): void {
  if (initializedId === config.counterId) {
    return;
  }
  ym(config.counterId, 'init', {
    clickmap: config.clickmap,
    trackLinks: config.trackLinks,
    accurateTrackBounce: config.accurateTrackBounce,
    webvisor: config.webvisor,
  });
  initializedId = config.counterId;
}

async function fetchRuntimeConfig(): Promise<
  | { source: 'api'; config: YandexMetrikaRuntimeConfig | null }
  | { source: 'error' }
> {
  try {
    const payload = await apiRequest<{
      yandexMetrika?: {
        counterId?: string | null;
        webvisor?: boolean;
        clickmap?: boolean;
        trackLinks?: boolean;
        accurateTrackBounce?: boolean;
      };
    }>('/config/public', {
      skipLoading: true,
      skipAuthRefresh: true,
    });

    const counterId = normalizeCounterId(payload.yandexMetrika?.counterId);
    if (!counterId) {
      // Admin explicitly disabled (empty ID) — do not fall back to env.
      return { source: 'api', config: null };
    }

    return {
      source: 'api',
      config: {
        counterId,
        webvisor: payload.yandexMetrika?.webvisor ?? true,
        clickmap: payload.yandexMetrika?.clickmap ?? true,
        trackLinks: payload.yandexMetrika?.trackLinks ?? true,
        accurateTrackBounce:
          payload.yandexMetrika?.accurateTrackBounce ?? true,
      },
    };
  } catch {
    return { source: 'error' };
  }
}

/**
 * Resolve counter from admin API (preferred) or EXPO_PUBLIC_YANDEX_METRIKA_ID,
 * inject tag.js, call ym init. Safe to call multiple times.
 * Empty counter in admin disables Metrika even if env is set.
 */
export async function bootstrapYandexMetrika(): Promise<string | null> {
  if (Platform.OS !== 'web' || typeof window === 'undefined') {
    return null;
  }
  if (bootPromise) {
    return bootPromise;
  }

  bootPromise = (async () => {
    const fetched = await fetchRuntimeConfig();

    let config: YandexMetrikaRuntimeConfig | null = null;
    if (fetched.source === 'api') {
      config = fetched.config;
    } else {
      const envId = normalizeCounterId(ENV_COUNTER_ID);
      if (envId) {
        config = {
          counterId: envId,
          webvisor: true,
          clickmap: true,
          trackLinks: true,
          accurateTrackBounce: true,
        };
      }
    }

    if (!config) {
      resolvedId = null;
      return null;
    }

    await loadTagScript();
    initCounter(config);
    resolvedId = config.counterId;
    return config.counterId;
  })();

  return bootPromise;
}

/** SPA virtual pageview for Expo Router path changes. */
export function hitYandexMetrika(
  url: string,
  options?: { title?: string; referer?: string },
): void {
  const id = getYandexMetrikaId();
  if (!id) {
    return;
  }
  ym(id, 'hit', url, {
    title: options?.title,
    referer: options?.referer,
  });
}

export function reachYandexMetrikaGoal(
  goal: string,
  params?: Record<string, string | number | boolean>,
): void {
  const id = getYandexMetrikaId();
  if (!id || !goal.trim()) {
    return;
  }
  if (params && Object.keys(params).length > 0) {
    ym(id, 'reachGoal', goal, params);
    return;
  }
  ym(id, 'reachGoal', goal);
}

export function setYandexMetrikaUserId(userId: string | null): void {
  const id = getYandexMetrikaId();
  if (!id) {
    return;
  }
  if (userId) {
    ym(id, 'setUserID', userId);
    return;
  }
  ym(id, 'userParams', { UserID: null });
}
