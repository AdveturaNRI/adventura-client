import { Platform, type ScrollView, type TextInput, type View } from 'react-native';

type DomLike = {
  getBoundingClientRect?: () => DOMRect;
  getScrollableNode?: () => unknown;
  getNode?: () => unknown;
  scrollIntoView?: (options?: ScrollIntoViewOptions) => void;
  focus?: (options?: FocusOptions) => void;
};

const SMOOTH_SCROLL_MS = 420;

/** Cancels an in-flight RAF smooth scroll when a new one starts. */
let activeScrollFrame: number | null = null;

function cancelActiveSmoothScroll(): void {
  if (activeScrollFrame == null) {
    return;
  }

  cancelAnimationFrame(activeScrollFrame);
  activeScrollFrame = null;
}

function resolveDomNode(value: unknown): (HTMLElement & DomLike) | null {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const node = value as DomLike & { _nativeNode?: unknown };

  if (typeof node.getBoundingClientRect === 'function') {
    return node as HTMLElement & DomLike;
  }

  if (typeof node.getScrollableNode === 'function') {
    const nested = resolveDomNode(node.getScrollableNode());
    if (nested) {
      return nested;
    }
  }

  if (typeof node.getNode === 'function') {
    const nested = resolveDomNode(node.getNode());
    if (nested) {
      return nested;
    }
  }

  if (node._nativeNode) {
    return resolveDomNode(node._nativeNode);
  }

  return null;
}

function isLaidOut(rect: DOMRect): boolean {
  return rect.width > 0 || rect.height > 0;
}

function canElementScroll(node: HTMLElement): boolean {
  if (typeof window === 'undefined') {
    return false;
  }

  const style = window.getComputedStyle(node);
  const overflowY = style.overflowY;
  const overflowAllows =
    overflowY === 'auto' || overflowY === 'scroll' || overflowY === 'overlay';

  return overflowAllows && node.scrollHeight > node.clientHeight + 1;
}

/** Walk up from `child` until we find a real overflow scroll container. */
function findScrollParent(child: HTMLElement, preferred?: HTMLElement | null): HTMLElement | null {
  if (preferred && canElementScroll(preferred)) {
    return preferred;
  }

  let node: HTMLElement | null = child.parentElement;
  while (node) {
    if (canElementScroll(node)) {
      return node;
    }
    node = node.parentElement;
  }

  return null;
}

function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

/** Own RAF smooth scroll — CSS `behavior:smooth` is flaky inside RN Web ScrollView. */
function animateScrollTop(scrollNode: HTMLElement, toY: number, durationMs: number): void {
  cancelActiveSmoothScroll();

  const fromY = scrollNode.scrollTop;
  const delta = toY - fromY;

  if (Math.abs(delta) < 1) {
    scrollNode.scrollTop = toY;
    return;
  }

  const start = performance.now();

  const step = (now: number) => {
    const progress = Math.min(1, (now - start) / durationMs);
    scrollNode.scrollTop = fromY + delta * easeInOutCubic(progress);
    if (progress < 1) {
      activeScrollFrame = requestAnimationFrame(step);
      return;
    }

    activeScrollFrame = null;
  };

  activeScrollFrame = requestAnimationFrame(step);
}

function scrollElementTo(scrollNode: HTMLElement, nextY: number, animated: boolean): void {
  const top = Math.max(0, nextY);

  if (!animated) {
    cancelActiveSmoothScroll();
    scrollNode.scrollTop = top;
    return;
  }

  animateScrollTop(scrollNode, top, SMOOTH_SCROLL_MS);
}

/** Focus without the browser jumping the scroll container to the input. */
export function focusWithoutScroll(
  target: TextInput | View | HTMLElement | null | undefined,
): void {
  if (!target) {
    return;
  }

  const tryFocus = (value: unknown): boolean => {
    if (!value || typeof value !== 'object') {
      return false;
    }

    const el = value as { focus?: (options?: FocusOptions) => void };
    if (typeof el.focus !== 'function') {
      return false;
    }

    if (Platform.OS === 'web') {
      try {
        el.focus({ preventScroll: true });
        return true;
      } catch {
        el.focus();
        return true;
      }
    }

    el.focus();
    return true;
  };

  if (tryFocus(resolveDomNode(target))) {
    return;
  }

  if (tryFocus(target)) {
    return;
  }

  const host = target as DomLike & { _nativeNode?: unknown };
  if (tryFocus(host._nativeNode) || tryFocus(host.getNode?.())) {
    return;
  }
}

export function getQuestionnaireSmoothScrollMs(): number {
  return SMOOTH_SCROLL_MS;
}

/**
 * Retries `attempt` until it returns true, then stops.
 * Prevents overlapping smooth scrolls that look like jerks.
 */
export function scheduleScrollAttempts(
  attempt: () => boolean,
  delays?: number[],
): () => void {
  const schedule =
    delays ?? (Platform.OS === 'web' ? [80, 220] : [100, 260]);

  let succeeded = false;
  const timers = schedule.map((ms) =>
    setTimeout(() => {
      if (succeeded) {
        return;
      }

      if (attempt()) {
        succeeded = true;
      }
    }, ms),
  );

  return () => {
    timers.forEach(clearTimeout);
  };
}

/**
 * Scrolls a ScrollView so that `child` is near the top of the visible area.
 * Uses DOM geometry on web (RN ScrollView is overflow:auto), measureLayout on native.
 */
export function scrollScrollViewToChild(
  scrollView: ScrollView | null | undefined,
  child: View | null | undefined,
  paddingTop = 16,
  animated = true,
): boolean {
  if (!scrollView || !child) {
    return false;
  }

  if (Platform.OS === 'web') {
    const preferredScrollNode =
      resolveDomNode(
        (scrollView as unknown as DomLike).getScrollableNode?.() ?? scrollView,
      ) ?? resolveDomNode(scrollView);
    const childNode = resolveDomNode(child);

    if (!childNode) {
      return false;
    }

    if (!isLaidOut(childNode.getBoundingClientRect!())) {
      return false;
    }

    const scrollNode = findScrollParent(childNode, preferredScrollNode);

    if (scrollNode && canElementScroll(scrollNode)) {
      const childRect = childNode.getBoundingClientRect!();
      const scrollRect = scrollNode.getBoundingClientRect!();
      const nextY = scrollNode.scrollTop + (childRect.top - scrollRect.top) - paddingTop;

      scrollElementTo(scrollNode, nextY, animated);
      return true;
    }

    if (typeof childNode.scrollIntoView === 'function') {
      cancelActiveSmoothScroll();
      childNode.scrollIntoView({
        behavior: animated ? 'smooth' : 'auto',
        block: 'start',
        inline: 'nearest',
      });
      return true;
    }

    if (preferredScrollNode && typeof preferredScrollNode.scrollTop === 'number') {
      const childRect = childNode.getBoundingClientRect!();
      const scrollRect = preferredScrollNode.getBoundingClientRect!();
      const nextY = Math.max(
        0,
        preferredScrollNode.scrollTop + (childRect.top - scrollRect.top) - paddingTop,
      );
      scrollElementTo(preferredScrollNode, nextY, animated);
      return true;
    }

    return false;
  }

  const childView = child as View & {
    measureLayout?: (
      relativeToNativeNode: unknown,
      onSuccess: (left: number, top: number, width: number, height: number) => void,
      onFail: () => void,
    ) => void;
  };

  const relativeTo =
    (scrollView as unknown as { getInnerViewNode?: () => unknown }).getInnerViewNode?.() ??
    scrollView;

  if (typeof childView.measureLayout !== 'function') {
    return false;
  }

  childView.measureLayout(
    relativeTo,
    (_left, top) => {
      scrollView.scrollTo({ y: Math.max(0, top - paddingTop), animated });
    },
    () => {},
  );

  return true;
}
