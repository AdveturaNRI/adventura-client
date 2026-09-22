import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Platform, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  Easing,
  FadeIn,
  FadeInDown,
  FadeInLeft,
  FadeInRight,
  FadeInUp,
  ZoomIn,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';

import type { MarketingLandingBlock } from '@/components/marketing/types';

export type LandingMotionPreset =
  | 'hero'
  | 'rise'
  | 'riseSoft'
  | 'slideLeft'
  | 'slideRight'
  | 'zoom'
  | 'fade';

const PRESET_BY_TYPE: Record<MarketingLandingBlock['type'], LandingMotionPreset> = {
  hero: 'hero',
  features: 'rise',
  appShowcase: 'slideLeft',
  steps: 'riseSoft',
  gameFeed: 'rise',
  testimonials: 'fade',
  clubFeed: 'rise',
  cta: 'zoom',
  faq: 'riseSoft',
  stats: 'rise',
  contact: 'slideRight',
  footer: 'fade',
  quote: 'fade',
  media: 'zoom',
};

function enteringForPreset(preset: LandingMotionPreset, delayMs: number) {
  const base = { duration: 620 };
  switch (preset) {
    case 'hero':
      return FadeIn.delay(delayMs).duration(700).easing(Easing.out(Easing.cubic));
    case 'rise':
      return FadeInUp.delay(delayMs).duration(base.duration).springify().damping(18);
    case 'riseSoft':
      return FadeInUp.delay(delayMs).duration(560).easing(Easing.out(Easing.cubic));
    case 'slideLeft':
      return FadeInRight.delay(delayMs).duration(640).easing(Easing.out(Easing.cubic));
    case 'slideRight':
      return FadeInLeft.delay(delayMs).duration(640).easing(Easing.out(Easing.cubic));
    case 'zoom':
      return ZoomIn.delay(delayMs).duration(520).easing(Easing.out(Easing.cubic));
    case 'fade':
    default:
      return FadeInDown.delay(delayMs).duration(520).easing(Easing.out(Easing.cubic));
  }
}

function motionFromPreset(preset: LandingMotionPreset): {
  fromY: number;
  fromX: number;
  fromScale: number;
  duration: number;
} {
  switch (preset) {
    case 'hero':
      return { fromY: 18, fromX: 0, fromScale: 0.985, duration: 720 };
    case 'rise':
      return { fromY: 36, fromX: 0, fromScale: 1, duration: 620 };
    case 'riseSoft':
      return { fromY: 24, fromX: 0, fromScale: 1, duration: 560 };
    case 'slideLeft':
      return { fromY: 20, fromX: -28, fromScale: 1, duration: 640 };
    case 'slideRight':
      return { fromY: 20, fromX: 28, fromScale: 1, duration: 640 };
    case 'zoom':
      return { fromY: 12, fromX: 0, fromScale: 0.94, duration: 540 };
    case 'fade':
    default:
      return { fromY: 20, fromX: 0, fromScale: 1, duration: 520 };
  }
}

export function motionPresetForBlock(type: MarketingLandingBlock['type']): LandingMotionPreset {
  return PRESET_BY_TYPE[type] ?? 'rise';
}

type LandingBlockRevealProps = {
  children: ReactNode;
  preset?: LandingMotionPreset;
  /** Stagger offset for mount-entering animations (native / first paint). */
  index?: number;
  style?: StyleProp<ViewStyle>;
  /** When true, skip IntersectionObserver and play immediately. */
  eager?: boolean;
};

/**
 * Scroll-reveal for marketing blocks.
 * Web: IntersectionObserver. Native: Reanimated entering with light stagger.
 */
export function LandingBlockReveal({
  children,
  preset = 'rise',
  index = 0,
  style,
  eager = false,
}: LandingBlockRevealProps) {
  const delayMs = Math.min(index * 70, 280);

  if (Platform.OS !== 'web') {
    return (
      <Animated.View
        entering={enteringForPreset(preset, delayMs)}
        style={style}>
        {children}
      </Animated.View>
    );
  }

  return (
    <WebScrollReveal preset={preset} delayMs={delayMs} style={style} eager={eager || index === 0}>
      {children}
    </WebScrollReveal>
  );
}

function WebScrollReveal({
  children,
  preset,
  delayMs,
  style,
  eager,
}: {
  children: ReactNode;
  preset: LandingMotionPreset;
  delayMs: number;
  style?: StyleProp<ViewStyle>;
  eager: boolean;
}) {
  const hostRef = useRef<View>(null);
  const [active, setActive] = useState(eager);
  const motion = motionFromPreset(preset);
  const opacity = useSharedValue(eager ? 1 : 0);
  const translateY = useSharedValue(eager ? 0 : motion.fromY);
  const translateX = useSharedValue(eager ? 0 : motion.fromX);
  const scale = useSharedValue(eager ? 1 : motion.fromScale);

  useEffect(() => {
    if (active) {
      return;
    }

    if (eager) {
      setActive(true);
      return;
    }

    if (
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    ) {
      setActive(true);
      return;
    }

    let cancelled = false;
    let framed = 0;

    const checkVisibility = () => {
      if (cancelled || !hostRef.current) return;
      hostRef.current.measureInWindow((_x, y, _w, h) => {
        if (cancelled) return;
        const viewport = typeof window !== 'undefined' ? window.innerHeight : 800;
        const visible = y < viewport * 0.9 && y + h > viewport * 0.05;
        if (visible) {
          setActive(true);
        }
      });
    };

    const onScrollOrResize = () => {
      cancelAnimationFrame(framed);
      framed = requestAnimationFrame(checkVisibility);
    };

    checkVisibility();
    window.addEventListener('scroll', onScrollOrResize, { passive: true, capture: true });
    window.addEventListener('resize', onScrollOrResize, { passive: true });

    return () => {
      cancelled = true;
      cancelAnimationFrame(framed);
      window.removeEventListener('scroll', onScrollOrResize, true);
      window.removeEventListener('resize', onScrollOrResize);
    };
  }, [eager, active]);

  useEffect(() => {
    if (!active) return;

    const reduced =
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

    if (reduced) {
      opacity.value = 1;
      translateY.value = 0;
      translateX.value = 0;
      scale.value = 1;
      return;
    }

    opacity.value = withDelay(
      delayMs,
      withTiming(1, { duration: motion.duration, easing: Easing.out(Easing.cubic) }),
    );
    translateY.value = withDelay(
      delayMs,
      withTiming(0, { duration: motion.duration, easing: Easing.out(Easing.cubic) }),
    );
    translateX.value = withDelay(
      delayMs,
      withTiming(0, { duration: motion.duration, easing: Easing.out(Easing.cubic) }),
    );
    scale.value = withDelay(
      delayMs,
      withTiming(1, { duration: motion.duration, easing: Easing.out(Easing.cubic) }),
    );
  }, [active, delayMs, motion.duration, opacity, scale, translateX, translateY]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [
      { translateY: translateY.value },
      { translateX: translateX.value },
      { scale: scale.value },
    ],
  }));

  return (
    <View ref={hostRef} collapsable={false} style={style}>
      <Animated.View style={animatedStyle}>{children}</Animated.View>
    </View>
  );
}

type StaggerItemProps = {
  children: ReactNode;
  index: number;
  style?: StyleProp<ViewStyle>;
};

/** Lightweight cascade for cards/items inside a block. */
export function LandingStaggerItem({ children, index, style }: StaggerItemProps) {
  const delayMs = Math.min(90 + index * 75, 480);
  return (
    <Animated.View
      entering={FadeInUp.delay(delayMs).duration(480).springify().damping(17)}
      style={style}>
      {children}
    </Animated.View>
  );
}
