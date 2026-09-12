import { useIsFocused } from 'expo-router';
import { useEffect, type ReactNode } from 'react';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';

import {
  SCREEN_TRANSITION_INITIAL_OPACITY,
  SCREEN_TRANSITION_INITIAL_TRANSLATE_Y,
  SCREEN_TRANSITION_MS,
  TAB_TRANSITION_INITIAL_OPACITY,
  TAB_TRANSITION_INITIAL_TRANSLATE_Y,
  TAB_TRANSITION_MS,
} from '@/constants/navigation.config';

type ScreenTransitionProps = {
  children: ReactNode;
  /** Повторять fade при фокусе экрана — для bottom tabs. */
  animateOnFocus?: boolean;
};

const transitionEasing = Easing.bezier(0.22, 1, 0.36, 1);

type EnterAnimationConfig = {
  initialOpacity: number;
  initialTranslateY: number;
  duration: number;
};

function runEnterAnimation(
  opacity: SharedValue<number>,
  translateY: SharedValue<number>,
  { initialOpacity, initialTranslateY, duration }: EnterAnimationConfig,
) {
  cancelAnimation(opacity);
  cancelAnimation(translateY);

  opacity.value = initialOpacity;
  translateY.value = initialTranslateY;

  opacity.value = withTiming(1, { duration, easing: transitionEasing });
  translateY.value = withTiming(0, { duration, easing: transitionEasing });
}

export function ScreenTransition({
  children,
  animateOnFocus = false,
}: ScreenTransitionProps) {
  const isFocused = useIsFocused();
  const opacity = useSharedValue(
    animateOnFocus ? 1 : SCREEN_TRANSITION_INITIAL_OPACITY,
  );
  const translateY = useSharedValue(
    animateOnFocus ? 0 : SCREEN_TRANSITION_INITIAL_TRANSLATE_Y,
  );

  useEffect(() => {
    if (animateOnFocus) {
      return;
    }

    runEnterAnimation(opacity, translateY, {
      initialOpacity: SCREEN_TRANSITION_INITIAL_OPACITY,
      initialTranslateY: SCREEN_TRANSITION_INITIAL_TRANSLATE_Y,
      duration: SCREEN_TRANSITION_MS,
    });
  }, [animateOnFocus, opacity, translateY]);

  useEffect(() => {
    if (!animateOnFocus || !isFocused) {
      return;
    }

    runEnterAnimation(opacity, translateY, {
      initialOpacity: TAB_TRANSITION_INITIAL_OPACITY,
      initialTranslateY: TAB_TRANSITION_INITIAL_TRANSLATE_Y,
      duration: TAB_TRANSITION_MS,
    });
  }, [animateOnFocus, isFocused, opacity, translateY]);

  const animatedStyle = useAnimatedStyle(() => ({
    flex: 1,
    width: '100%',
    minHeight: 0,
    minWidth: 0,
    overflow: 'hidden',
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }],
  }));

  return <Animated.View style={animatedStyle}>{children}</Animated.View>;
}
