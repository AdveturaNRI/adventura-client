import { useEffect } from 'react';
import { Platform } from 'react-native';

const DICE_CDN = 'https://cdn.jsdelivr.net/npm/@3d-dice/dice-box@1.1.4/dist';

const PRELOADS: { rel: string; href: string; as?: string; crossOrigin?: string }[] = [
  { rel: 'preconnect', href: 'https://cdn.jsdelivr.net', crossOrigin: 'anonymous' },
  { rel: 'dns-prefetch', href: 'https://cdn.jsdelivr.net' },
  {
    rel: 'modulepreload',
    href: `${DICE_CDN}/dice-box.es.min.js`,
    as: 'script',
    crossOrigin: 'anonymous',
  },
  {
    rel: 'modulepreload',
    href: `${DICE_CDN}/world.onscreen.min.js`,
    as: 'script',
    crossOrigin: 'anonymous',
  },
  {
    rel: 'preload',
    href: `${DICE_CDN}/assets/ammo/ammo.wasm.wasm`,
    as: 'fetch',
    crossOrigin: 'anonymous',
  },
];

/**
 * Warm CDN cache while user is elsewhere in the app —
 * first open of Дайсы then hits disk/memory instead of cold network.
 */
export function useDiceBoxPrefetch(enabled = true) {
  useEffect(() => {
    if (!enabled || Platform.OS !== 'web' || typeof document === 'undefined') {
      return;
    }

    const created: HTMLLinkElement[] = [];
    for (const item of PRELOADS) {
      const exists = document.head.querySelector(
        `link[rel="${item.rel}"][href="${item.href}"]`,
      );
      if (exists) {
        continue;
      }
      const link = document.createElement('link');
      link.rel = item.rel;
      link.href = item.href;
      if (item.as) {
        link.as = item.as;
      }
      if (item.crossOrigin) {
        link.crossOrigin = item.crossOrigin;
      }
      document.head.appendChild(link);
      created.push(link);
    }

    // Also kick a fetch so ammo/wasm is in HTTP cache.
    void fetch(`${DICE_CDN}/assets/ammo/ammo.wasm.wasm`, {
      mode: 'cors',
      credentials: 'omit',
    }).catch(() => undefined);

    return () => {
      // keep links — useful across tab switches
      void created;
    };
  }, [enabled]);
}
