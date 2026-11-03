import { useEffect, useRef } from 'react';
import { Platform, type ScrollView } from 'react-native';

type ScrollHost = ScrollView & {
  getScrollableNode?: () => unknown;
  getInnerViewNode?: () => unknown;
};

function resolveScrollElement(host: ScrollHost | null): HTMLElement | null {
  if (!host || typeof document === 'undefined') {
    return null;
  }
  const candidates = [
    host.getScrollableNode?.(),
    (host as unknown as { _component?: { getScrollableNode?: () => unknown } })._component
      ?.getScrollableNode?.(),
    host,
  ];
  for (const candidate of candidates) {
    if (candidate instanceof HTMLElement) {
      return candidate;
    }
  }
  return null;
}

/** Vertical mouse wheel → horizontal scroll for web horizontal ScrollViews. */
export function useHorizontalWheelScroll(enabled = true) {
  const ref = useRef<ScrollView>(null);

  useEffect(() => {
    if (Platform.OS !== 'web' || !enabled) {
      return;
    }

    let node: HTMLElement | null = null;
    let frame = 0;

    const attach = () => {
      node = resolveScrollElement(ref.current as ScrollHost | null);
      if (!node) {
        frame = requestAnimationFrame(attach);
        return;
      }

      const onWheel = (event: WheelEvent) => {
        if (Math.abs(event.deltaY) <= Math.abs(event.deltaX)) {
          return;
        }
        if (node!.scrollWidth <= node!.clientWidth + 1) {
          return;
        }
        event.preventDefault();
        node!.scrollLeft += event.deltaY;
      };

      node.addEventListener('wheel', onWheel, { passive: false });
      cleanup = () => node?.removeEventListener('wheel', onWheel);
    };

    let cleanup: (() => void) | undefined;
    attach();

    return () => {
      cancelAnimationFrame(frame);
      cleanup?.();
    };
  }, [enabled]);

  return ref;
}
