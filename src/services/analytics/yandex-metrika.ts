import { Platform } from 'react-native';

import { apiRequest } from '@/services/api/client';

type YmFn = (...args: unknown[]) => void;

declare global {
  interface Window {
    ym?: YmFn;
    __ADVENTURA_YM_ID__?: string;
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
  return (
    resolvedId ??
    normalizeCounterId(
      typeof window !== 'undefined' ? window.__ADVENTURA_YM_ID__ : null,
    ) ??
    normalizeCounterId(ENV_COUNTER_ID)
  );
}

function ym(...args: unknown[]): void {
  if (typeof window === 'undefined' || typeof window.ym !== 'function') {
    return;
  }
  try {
    window.ym(...args);
  } catch {
    // ignore Metrika failures
  }
}

function ensureYmStub(): void {
  if (typeof window === 'undefined' || typeof window.ym === 'function') {
    return;
  }
  // Official Metrika queue stub (`arguments`, not a rest-array).
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const stub: any = function () {
    // eslint-disable-next-line prefer-rest-params
    (stub.a = stub.a || []).push(arguments);
  };
  stub.l = Date.now();
  window.ym = stub;
}

function loadTagScript(counterId: string): Promise<void> {
  if (typeof document === 'undefined') {
    return Promise.resolve();
  }

  ensureYmStub();

  const src = `https://mc.yandex.ru/metrika/tag.js?id=${counterId}`;
  const existing = document.querySelector<HTMLScriptElement>(
    'script[src*="mc.yandex.ru/metrika/tag.js"]',
  );

  if (existing) {
    if (existing.dataset.loaded === '1' || existing.dataset.loaded === 'error') {
      return Promise.resolve();
    }
    return new Promise((resolve) => {
      existing.addEventListener(
        'load',
        () => {
          existing.dataset.loaded = '1';
          resolve();
        },
        { once: true },
      );
      existing.addEventListener(
        'error',
        () => {
          existing.dataset.loaded = 'error';
          resolve();
        },
        { once: true },
      );
    });
  }

  return new Promise((resolve) => {
    const script = document.createElement('script');
    script.async = true;
    script.src = src;
    script.onload = () => {
      script.dataset.loaded = '1';
      resolve();
    };
    script.onerror = () => {
      script.dataset.loaded = 'error';
      resolve();
    };
    document.head.appendChild(script);
  });
}

function initCounter(config: YandexMetrikaRuntimeConfig): void {
  if (
    initializedId === config.counterId ||
    window.__ADVENTURA_YM_ID__ === config.counterId
  ) {
    initializedId = config.counterId;
    return;
  }
  // SPA: defer disables automatic pageview; hits go through hitYandexMetrika.
  ym(Number(config.counterId), 'init', {
    defer: true,
    ssr: true,
    clickmap: config.clickmap,
    trackLinks: config.trackLinks,
    accurateTrackBounce: config.accurateTrackBounce,
    webvisor: config.webvisor,
    triggerEvent: true,
    referrer: typeof document !== 'undefined' ? document.referrer : undefined,
    url: typeof location !== 'undefined' ? location.href : undefined,
  });
  initializedId = config.counterId;
  window.__ADVENTURA_YM_ID__ = config.counterId;
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
    const already = normalizeCounterId(window.__ADVENTURA_YM_ID__);
    if (already) {
      resolvedId = already;
      initializedId = already;
      return already;
    }

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

    await loadTagScript(config.counterId);
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
  ym(Number(id), 'hit', url, {
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
    ym(Number(id), 'reachGoal', goal, params);
    return;
  }
  ym(Number(id), 'reachGoal', goal);
}

export function setYandexMetrikaUserId(userId: string | null): void {
  const id = getYandexMetrikaId();
  if (!id) {
    return;
  }
  if (userId) {
    ym(Number(id), 'setUserID', userId);
    return;
  }
  ym(Number(id), 'userParams', { UserID: null });
}
