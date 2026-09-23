import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import { useGlobalSearchParams, usePathname } from 'expo-router';

import { hitVkPixel, initVkPixel } from '@/services/analytics/vk-pixel';

const SAFE_QUERY_PARAMS = new Set([
  'utm_source',
  'utm_medium',
  'utm_campaign',
  'utm_content',
  'utm_term',
  'utm_id',
  'yclid',
  'adv_variant',
]);

function safeCurrentUrl(pathname: string, params: Record<string, unknown>): string {
  const search = new URLSearchParams();
  const source = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;

  if (source) {
    for (const [key, value] of source.entries()) {
      if (SAFE_QUERY_PARAMS.has(key) && value) search.append(key, value);
    }
  } else {
    for (const [key, raw] of Object.entries(params)) {
      if (!SAFE_QUERY_PARAMS.has(key) || raw == null) continue;
      const values = Array.isArray(raw) ? raw : [raw];
      values.forEach((value) => {
        if (value) search.append(key, String(value));
      });
    }
  }

  const query = search.toString();
  return `${pathname}${query ? `?${query}` : ''}`;
}

/** Sends exactly one safe virtual pageview for each Expo Router URL. */
export function VkPixelTracker() {
  const pathname = usePathname();
  const params = useGlobalSearchParams();
  const lastUrlRef = useRef<string | null>(null);

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const url = safeCurrentUrl(pathname, params);
    if (lastUrlRef.current === url) return;
    lastUrlRef.current = url;
    void initVkPixel().finally(() => hitVkPixel(url));
  }, [pathname, params]);

  return null;
}
