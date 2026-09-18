import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import { usePathname, useGlobalSearchParams } from 'expo-router';

import {
  bootstrapYandexMetrika,
  hitYandexMetrika,
} from '@/services/analytics/yandex-metrika';

/**
 * Bootstraps Metrika from `/api/config/public` (admin settings)
 * and sends SPA hits on Expo Router navigation (web only).
 */
export function YandexMetrikaTracker() {
  const pathname = usePathname();
  const params = useGlobalSearchParams();
  const lastUrlRef = useRef<string | null>(null);

  useEffect(() => {
    if (Platform.OS !== 'web') {
      return;
    }

    let cancelled = false;

    void (async () => {
      const id = await bootstrapYandexMetrika();
      if (cancelled || !id) {
        return;
      }

      const search = (() => {
        try {
          if (typeof window !== 'undefined' && window.location?.search) {
            return window.location.search;
          }
        } catch {
          // ignore
        }
        const entries = Object.entries(params)
          .filter(([, v]) => v != null && v !== '')
          .flatMap(([k, v]) =>
            Array.isArray(v)
              ? v.map((item) => [k, String(item)] as const)
              : [[k, String(v)] as const],
          );
        if (entries.length === 0) {
          return '';
        }
        return `?${new URLSearchParams(entries).toString()}`;
      })();

      const url = `${pathname}${search}`;
      if (lastUrlRef.current === url) {
        return;
      }
      const referer = lastUrlRef.current ?? undefined;
      lastUrlRef.current = url;

      const title =
        typeof document !== 'undefined' ? document.title : undefined;
      hitYandexMetrika(url, { title, referer });
    })();

    return () => {
      cancelled = true;
    };
  }, [pathname, params]);

  return null;
}
