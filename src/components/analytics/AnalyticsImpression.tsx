import {
  useCallback,
  useEffect,
  useRef,
  type ReactNode,
  type RefObject,
} from 'react';
import {
  Platform,
  View,
  Dimensions,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import {
  IMPRESSION_DWELL_MS,
  trackEntityView,
  type AnalyticsEntityKind,
} from '@/services/analytics/analytics';

type Props = {
  entity: AnalyticsEntityKind;
  id: string;
  enabled?: boolean;
  dwellMs?: number;
  style?: StyleProp<ViewStyle>;
  children: ReactNode;
};

function isMostlyVisible(
  top: number,
  height: number,
  windowHeight: number,
): boolean {
  if (height <= 0) {
    return false;
  }
  const visibleTop = Math.max(0, top);
  const visibleBottom = Math.min(windowHeight, top + height);
  const visible = Math.max(0, visibleBottom - visibleTop);
  return visible / height >= 0.5;
}

/**
 * Fires a view once the wrapped content stays mostly on-screen for `dwellMs`.
 */
export function AnalyticsImpression({
  entity,
  id,
  enabled = true,
  dwellMs = IMPRESSION_DWELL_MS,
  style,
  children,
}: Props) {
  const ref = useRef<View>(null);
  const firedRef = useRef(false);
  const visibleSinceRef = useRef<number | null>(null);
  const entityRef = useRef(entity);
  const idRef = useRef(id);
  entityRef.current = entity;
  idRef.current = id;

  useEffect(() => {
    firedRef.current = false;
    visibleSinceRef.current = null;
  }, [entity, id]);

  const markVisible = useCallback(
    (visible: boolean) => {
      if (!enabled || firedRef.current) {
        return;
      }

      if (!visible) {
        visibleSinceRef.current = null;
        return;
      }

      const now = Date.now();
      if (visibleSinceRef.current == null) {
        visibleSinceRef.current = now;
      }

      if (now - (visibleSinceRef.current ?? now) >= dwellMs) {
        firedRef.current = true;
        trackEntityView(entityRef.current, idRef.current);
      }
    },
    [dwellMs, enabled],
  );

  useEffect(() => {
    if (!enabled || !id) {
      return;
    }

    if (Platform.OS === 'web' && typeof IntersectionObserver !== 'undefined') {
      const node = ref.current as unknown as Element | null;
      if (!node) {
        return;
      }

      let visibleSince: number | null = null;
      let fired = false;
      let tick: ReturnType<typeof setInterval> | null = null;

      const observer = new IntersectionObserver(
        (entries) => {
          const entry = entries[0];
          const visible = Boolean(entry?.isIntersecting && entry.intersectionRatio >= 0.5);
          if (!visible) {
            visibleSince = null;
            return;
          }
          if (visibleSince == null) {
            visibleSince = Date.now();
          }
        },
        { threshold: [0, 0.5, 1] },
      );

      observer.observe(node);
      tick = setInterval(() => {
        if (fired || visibleSince == null) {
          return;
        }
        if (Date.now() - visibleSince >= dwellMs) {
          fired = true;
          trackEntityView(entityRef.current, idRef.current);
        }
      }, 400);

      return () => {
        observer.disconnect();
        if (tick) {
          clearInterval(tick);
        }
      };
    }

    const tick = setInterval(() => {
      const view = ref.current;
      if (!view) {
        return;
      }

      view.measureInWindow((_x, y, _w, height) => {
        const windowHeight = Dimensions.get('window').height;
        markVisible(isMostlyVisible(y, height, windowHeight));
      });
    }, 400);

    return () => clearInterval(tick);
  }, [dwellMs, enabled, id, markVisible]);

  return (
    <View ref={ref} collapsable={false} style={style}>
      {children}
    </View>
  );
}

/** For deck-style UI where the active card fills the viewport. */
export function useActiveCardImpression(
  entity: AnalyticsEntityKind,
  id: string | null | undefined,
  enabled = true,
  dwellMs = IMPRESSION_DWELL_MS,
) {
  useEffect(() => {
    if (!enabled || !id) {
      return;
    }

    const timer = setTimeout(() => {
      trackEntityView(entity, id);
    }, dwellMs);

    return () => clearTimeout(timer);
  }, [dwellMs, enabled, entity, id]);
}

export type ImpressionViewRef = RefObject<View | null>;
