import { type ReactNode, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  Platform,
  StyleSheet,
  Text,
  View,
  type GestureResponderEvent,
  type LayoutChangeEvent,
  type ViewStyle,
} from 'react-native';
import {
  Gesture,
  GestureDetector,
  MouseButton,
} from 'react-native-gesture-handler';
import Animated, {
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { FontSize, Radius, Spacing, type ThemeColors } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useThemedStyles } from '@/hooks/use-themed-styles';

export type SwipeDismissRequest = {
  direction: 'left' | 'right';
  token: number;
};

export type SwipeAction = {
  label: string;
  backgroundColor?: string;
  textColor?: string;
  onPress?: () => void;
};

export type SwipeBlockVariant = 'strip' | 'corner';

type SwipeBlockProps = {
  children: ReactNode;
  leftAction?: SwipeAction;
  rightAction?: SwipeAction;
  actionWidth?: number;
  style?: ViewStyle;
  variant?: SwipeBlockVariant;
  dismissible?: boolean;
  resetKey?: string | number;
  /** Shared native scroll gesture so horizontal swipes coexist with vertical ScrollView. */
  nativeScrollGesture?: ReturnType<typeof Gesture.Native>;
  /** Keep false for deck cards with outer FX (dragon / oak rim). */
  clipContent?: boolean;
  onDismiss?: (direction: 'left' | 'right') => void;
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
  dismissRequest?: SwipeDismissRequest | null;
};

const SPRING = {
  damping: 22,
  stiffness: 240,
  mass: 0.8,
};

const DISMISS_SPRING = {
  damping: 18,
  stiffness: 170,
  mass: 0.85,
};

const ENTER_SPRING = {
  damping: 20,
  stiffness: 260,
  mass: 0.75,
};

const BLOCK_RADIUS = 16;
const MAX_TILT = 7;
const PAN_ACTIVATE_X = 18;
const PAN_FAIL_Y = 8;
const PAN_HORIZONTAL_RATIO = 1.25;

type WebPanState = {
  startX: number;
  startY: number;
  originTranslate: number;
  axis: 'undecided' | 'horizontal' | 'vertical';
};

const webDragStyle = (dragging: boolean): ViewStyle =>
  Platform.OS === 'web'
    ? ({
        cursor: dragging ? 'grabbing' : 'grab',
        userSelect: 'none',
        WebkitUserSelect: 'none',
        WebkitTouchCallout: 'none',
        touchAction: 'none',
        WebkitUserDrag: 'none',
        userDrag: 'none',
      } as unknown as ViewStyle)
    : {};

function readPagePoint(event: GestureResponderEvent): { x: number; y: number } {
  const native = event.nativeEvent as GestureResponderEvent['nativeEvent'] & {
    touches?: Array<{ pageX?: number; pageY?: number }>;
    pageX?: number;
    pageY?: number;
    clientX?: number;
    clientY?: number;
  };
  const touch = native.touches?.[0];
  return {
    x: touch?.pageX ?? native.pageX ?? native.clientX ?? native.locationX ?? 0,
    y: touch?.pageY ?? native.pageY ?? native.clientY ?? native.locationY ?? 0,
  };
}

function getStripLimits(leftWidth: number, rightWidth: number) {
  const restX = -leftWidth;
  const minX = -leftWidth - rightWidth;
  const maxX = 0;
  return { restX, minX, maxX };
}

function getCornerLimits(leftWidth: number, rightWidth: number) {
  return {
    restX: 0,
    minX: rightWidth > 0 ? -rightWidth : 0,
    maxX: leftWidth > 0 ? leftWidth : 0,
  };
}

type CornerSwipeBlockProps = Omit<SwipeBlockProps, 'variant'> & {
  actionWidth: number;
};

function CornerSwipeBlock({
  children,
  leftAction,
  rightAction,
  actionWidth,
  style,
  dismissible = false,
  resetKey,
  nativeScrollGesture,
  clipContent = true,
  onDismiss,
  onSwipeLeft,
  onSwipeRight,
  dismissRequest,
}: CornerSwipeBlockProps) {
  const colors = useTheme();
  const styles = useThemedStyles(createSwipeStyles);
  const leftWidth = leftAction ? actionWidth : 0;
  const rightWidth = rightAction ? actionWidth : 0;
  const { restX, minX, maxX } = getCornerLimits(leftWidth, rightWidth);

  const [dragging, setDragging] = useState(false);
  const [gesturesEnabled, setGesturesEnabled] = useState(true);
  const [outgoingCard, setOutgoingCard] = useState<ReactNode | null>(null);
  const [containerWidth, setContainerWidth] = useState(0);

  const childrenRef = useRef(children);
  childrenRef.current = children;

  const translateX = useSharedValue(restX);
  const startX = useSharedValue(restX);
  const exitTranslateX = useSharedValue(0);
  const exitOpacity = useSharedValue(0);
  const enterOpacity = useSharedValue(1);
  const enterScale = useSharedValue(1);
  const enterTranslateY = useSharedValue(0);
  const touchStartX = useSharedValue(0);
  const touchStartY = useSharedValue(0);
  const isPanActivated = useSharedValue(false);
  const isExiting = useSharedValue(false);

  const startDrag = useCallback(() => setDragging(true), []);
  const endDrag = useCallback(() => setDragging(false), []);

  const flyOutDistance = containerWidth > 0 ? containerWidth * 1.15 : 420;

  const resetCardState = useCallback(() => {
    translateX.value = restX;
    startX.value = restX;
  }, [restX, startX, translateX]);

  const playEnterAnimation = useCallback(() => {
    enterOpacity.value = withTiming(1, { duration: 220 });
    enterScale.value = withSpring(1, ENTER_SPRING);
    enterTranslateY.value = withSpring(0, ENTER_SPRING);
  }, [enterOpacity, enterScale, enterTranslateY]);

  const clearOutgoing = useCallback(() => {
    isExiting.value = false;
    enterOpacity.value = 1;
    enterScale.value = 1;
    enterTranslateY.value = 0;
    setOutgoingCard(null);
    setGesturesEnabled(true);
  }, [enterOpacity, enterScale, enterTranslateY, isExiting]);

  const isFirstMount = useRef(true);
  const shouldPlayEnter = useRef(false);
  const pendingDismiss = useRef<{
    direction: 'left' | 'right';
    triggeredLeft: boolean;
    triggeredRight: boolean;
    currentX: number;
  } | null>(null);
  const lastDismissToken = useRef<number | null>(null);

  const fireDismissCallbacks = useCallback(
    (direction: 'left' | 'right', triggeredLeft: boolean, triggeredRight: boolean) => {
      if (triggeredLeft && leftAction?.onPress) {
        leftAction.onPress();
      }
      if (triggeredRight && rightAction?.onPress) {
        rightAction.onPress();
      }
      if (direction === 'right' && onSwipeRight) {
        onSwipeRight();
      }
      if (direction === 'left' && onSwipeLeft) {
        onSwipeLeft();
      }
      onDismiss?.(direction);
    },
    [leftAction, onDismiss, onSwipeLeft, onSwipeRight, rightAction],
  );

  useEffect(() => {
    if (isFirstMount.current) {
      isFirstMount.current = false;
      resetCardState();
      return;
    }

    if (shouldPlayEnter.current) {
      shouldPlayEnter.current = false;
      playEnterAnimation();
      return;
    }

    // Soft enter when the next card is swapped in without a dismiss handoff
    // (e.g. undo) so the deck never hard-cuts.
    enterOpacity.value = 0;
    enterScale.value = 0.97;
    enterTranslateY.value = 6;
    playEnterAnimation();
  }, [
    enterOpacity,
    enterScale,
    enterTranslateY,
    playEnterAnimation,
    resetCardState,
    resetKey,
  ]);

  useLayoutEffect(() => {
    if (!outgoingCard || !pendingDismiss.current) {
      return;
    }

    const { direction, triggeredLeft, triggeredRight, currentX } = pendingDismiss.current;
    pendingDismiss.current = null;

    const targetX = direction === 'left' ? -flyOutDistance : flyOutDistance;

    isExiting.value = true;
    exitTranslateX.value = currentX;
    exitOpacity.value = 1;

    enterOpacity.value = 0;
    enterScale.value = 0.96;
    enterTranslateY.value = 8;
    translateX.value = restX;
    startX.value = restX;
    shouldPlayEnter.current = true;

    fireDismissCallbacks(direction, triggeredLeft, triggeredRight);

    exitTranslateX.value = withSpring(targetX, DISMISS_SPRING, (finished) => {
      if (finished) {
        runOnJS(clearOutgoing)();
      }
    });
    exitOpacity.value = withTiming(0, { duration: 240 });
  }, [
    clearOutgoing,
    enterOpacity,
    enterScale,
    enterTranslateY,
    exitOpacity,
    exitTranslateX,
    fireDismissCallbacks,
    flyOutDistance,
    isExiting,
    outgoingCard,
    restX,
    startX,
    translateX,
  ]);

  const startDismiss = useCallback(
    (
      direction: 'left' | 'right',
      triggeredLeft: boolean,
      triggeredRight: boolean,
      currentX: number,
    ) => {
      if (pendingDismiss.current || outgoingCard) {
        return;
      }

      setGesturesEnabled(false);
      pendingDismiss.current = { direction, triggeredLeft, triggeredRight, currentX };
      setOutgoingCard(childrenRef.current);
    },
    [outgoingCard],
  );

  useEffect(() => {
    if (!dismissRequest || dismissRequest.token === lastDismissToken.current) {
      return;
    }

    if (outgoingCard || pendingDismiss.current) {
      return;
    }

    lastDismissToken.current = dismissRequest.token;
    const direction = dismissRequest.direction;
    startDismiss(
      direction,
      direction === 'right',
      direction === 'left',
      restX,
    );
  }, [dismissRequest, outgoingCard, restX, startDismiss]);

  const onContainerLayout = useCallback((event: LayoutChangeEvent) => {
    setContainerWidth(event.nativeEvent.layout.width);
  }, []);

  const leftBg = leftAction?.backgroundColor ?? colors.primary;
  const rightBg = rightAction?.backgroundColor ?? colors.destructive;
  const leftText = leftAction?.textColor ?? colors.onPrimary;
  const rightText = rightAction?.textColor ?? colors.onPrimary;

  const webPanRef = useRef<WebPanState | null>(null);
  const webMouseCleanupRef = useRef<(() => void) | null>(null);
  const webSawTouchRef = useRef(false);

  const finishWebPan = useCallback(
    (velocityX = 0) => {
      const state = webPanRef.current;
      webPanRef.current = null;
      webMouseCleanupRef.current?.();
      webMouseCleanupRef.current = null;
      endDrag();

      if (!state || state.axis !== 'horizontal') {
        translateX.value = withSpring(restX, SPRING);
        return;
      }

      const projectedX = translateX.value + velocityX * 0.08;

      if (leftAction && projectedX >= leftWidth * 0.4) {
        if (dismissible) {
          startDismiss('right', true, false, translateX.value);
          return;
        }
        translateX.value = withSpring(restX, SPRING);
        leftAction.onPress?.();
        onSwipeRight?.();
        return;
      }

      if (rightAction && projectedX <= -rightWidth * 0.4) {
        if (dismissible) {
          startDismiss('left', false, true, translateX.value);
          return;
        }
        translateX.value = withSpring(restX, SPRING);
        rightAction.onPress?.();
        onSwipeLeft?.();
        return;
      }

      translateX.value = withSpring(restX, SPRING);
    },
    [
      dismissible,
      endDrag,
      leftAction,
      leftWidth,
      onSwipeLeft,
      onSwipeRight,
      restX,
      rightAction,
      rightWidth,
      startDismiss,
      translateX,
    ],
  );

  const onWebPanStart = useCallback(
    (x: number, y: number) => {
      if (!gesturesEnabled || isExiting.value) {
        return;
      }
      webPanRef.current = {
        startX: x,
        startY: y,
        originTranslate: translateX.value,
        axis: 'undecided',
      };
      startX.value = translateX.value;
      startDrag();
    },
    [gesturesEnabled, isExiting, startDrag, startX, translateX],
  );

  const onWebPanMove = useCallback(
    (x: number, y: number) => {
      const state = webPanRef.current;
      if (!state) {
        return;
      }

      const dx = x - state.startX;
      const dy = y - state.startY;
      const absDx = Math.abs(dx);
      const absDy = Math.abs(dy);

      if (state.axis === 'undecided') {
        if (absDy > PAN_FAIL_Y && absDy > absDx) {
          state.axis = 'vertical';
          translateX.value = restX;
          endDrag();
          return;
        }
        if (absDx > PAN_ACTIVATE_X && absDx > absDy * PAN_HORIZONTAL_RATIO) {
          state.axis = 'horizontal';
        } else {
          return;
        }
      }

      if (state.axis === 'vertical') {
        return;
      }

      translateX.value = Math.min(maxX, Math.max(minX, state.originTranslate + dx));
    },
    [endDrag, maxX, minX, restX, translateX],
  );

  const onWebTouchStart = useCallback(
    (event: GestureResponderEvent) => {
      webSawTouchRef.current = true;
      const point = readPagePoint(event);
      onWebPanStart(point.x, point.y);
    },
    [onWebPanStart],
  );

  const onWebTouchMove = useCallback(
    (event: GestureResponderEvent) => {
      const state = webPanRef.current;
      if (!state || state.axis === 'vertical') {
        return;
      }
      if (state.axis === 'horizontal') {
        event.preventDefault?.();
      }
      const point = readPagePoint(event);
      onWebPanMove(point.x, point.y);
    },
    [onWebPanMove],
  );

  const onWebTouchEnd = useCallback(() => {
    finishWebPan(0);
    setTimeout(() => {
      webSawTouchRef.current = false;
    }, 400);
  }, [finishWebPan]);

  const onWebTouchCancel = useCallback(() => {
    webPanRef.current = null;
    webMouseCleanupRef.current?.();
    webMouseCleanupRef.current = null;
    translateX.value = withSpring(restX, SPRING);
    endDrag();
    setTimeout(() => {
      webSawTouchRef.current = false;
    }, 400);
  }, [endDrag, restX, translateX]);

  const onWebMouseDown = useCallback(
    (event: GestureResponderEvent) => {
      if (webSawTouchRef.current || typeof window === 'undefined') {
        return;
      }
      const native = event.nativeEvent as unknown as {
        button?: number;
        pageX?: number;
        pageY?: number;
        clientX?: number;
        clientY?: number;
        preventDefault?: () => void;
      };
      if (native.button != null && native.button !== 0) {
        return;
      }
      native.preventDefault?.();
      const startPoint = {
        x: native.pageX ?? native.clientX ?? 0,
        y: native.pageY ?? native.clientY ?? 0,
      };
      onWebPanStart(startPoint.x, startPoint.y);

      const onMove = (ev: MouseEvent) => {
        onWebPanMove(ev.pageX, ev.pageY);
      };
      const onUp = (ev: MouseEvent) => {
        finishWebPan(ev.movementX ?? 0);
      };
      window.addEventListener('mousemove', onMove);
      window.addEventListener('mouseup', onUp);
      webMouseCleanupRef.current = () => {
        window.removeEventListener('mousemove', onMove);
        window.removeEventListener('mouseup', onUp);
      };
    },
    [finishWebPan, onWebPanMove, onWebPanStart],
  );

  useEffect(
    () => () => {
      webMouseCleanupRef.current?.();
      webMouseCleanupRef.current = null;
    },
    [],
  );

  const pan = useMemo(() => {
    const base = Gesture.Pan()
      .enabled(gesturesEnabled)
      .manualActivation(true)
      .mouseButton(MouseButton.LEFT)
      .onTouchesDown((event) => {
        'worklet';
        const touch = event.allTouches[0];
        if (touch) {
          touchStartX.value = touch.x;
          touchStartY.value = touch.y;
        }
        isPanActivated.value = false;
      })
      .onTouchesMove((_event, state) => {
        'worklet';
        if (isPanActivated.value) {
          return;
        }

        const touch = _event.allTouches[0];
        if (!touch) {
          return;
        }

        const dx = touch.x - touchStartX.value;
        const dy = touch.y - touchStartY.value;
        const absDx = Math.abs(dx);
        const absDy = Math.abs(dy);

        if (absDy > PAN_FAIL_Y && absDy > absDx) {
          state.fail();
          return;
        }

        if (absDx > PAN_ACTIVATE_X && absDx > absDy * PAN_HORIZONTAL_RATIO) {
          isPanActivated.value = true;
          state.activate();
        }
      })
      .onTouchesUp((_event, state) => {
        'worklet';
        if (!isPanActivated.value) {
          state.fail();
        }
      });

    const withScroll = nativeScrollGesture
      ? base.simultaneousWithExternalGesture(nativeScrollGesture)
      : base;

    return withScroll
      .onStart(() => {
        if (!isExiting.value) {
          enterOpacity.value = 1;
          enterScale.value = 1;
          enterTranslateY.value = 0;
        }
        startX.value = translateX.value;
        runOnJS(startDrag)();
      })
      .onUpdate((event) => {
        const nextX = startX.value + event.translationX;
        translateX.value = Math.min(maxX, Math.max(minX, nextX));
      })
      .onEnd((event) => {
        const projectedX = translateX.value + event.velocityX * 0.08;

        if (leftAction && projectedX >= leftWidth * 0.4) {
          if (dismissible) {
            runOnJS(startDismiss)('right', true, false, translateX.value);
            return;
          }
          translateX.value = withSpring(restX, SPRING);
          if (leftAction.onPress) {
            runOnJS(leftAction.onPress)();
          }
          if (onSwipeRight) {
            runOnJS(onSwipeRight)();
          }
          return;
        }

        if (rightAction && projectedX <= -rightWidth * 0.4) {
          if (dismissible) {
            runOnJS(startDismiss)('left', false, true, translateX.value);
            return;
          }
          translateX.value = withSpring(restX, SPRING);
          if (rightAction.onPress) {
            runOnJS(rightAction.onPress)();
          }
          if (onSwipeLeft) {
            runOnJS(onSwipeLeft)();
          }
          return;
        }

        translateX.value = withSpring(restX, SPRING);
      })
      .onFinalize((_event, success) => {
        isPanActivated.value = false;
        runOnJS(endDrag)();
        if (!success && !isExiting.value) {
          translateX.value = withSpring(restX, SPRING);
        }
      });
  }, [
    dismissible,
    endDrag,
    enterOpacity,
    enterScale,
    enterTranslateY,
    gesturesEnabled,
    isExiting,
    isPanActivated,
    leftAction,
    leftWidth,
    maxX,
    minX,
    onSwipeLeft,
    onSwipeRight,
    restX,
    rightAction,
    rightWidth,
    startDismiss,
    startDrag,
    startX,
    nativeScrollGesture,
    touchStartX,
    touchStartY,
    translateX,
  ]);

  const cardStyle = useAnimatedStyle(() => {
    const tilt = Math.max(-MAX_TILT, Math.min(MAX_TILT, translateX.value * 0.07));
    const visible = isExiting.value ? enterOpacity.value : 1;

    return {
      opacity: visible,
      transform: [
        { translateX: translateX.value },
        { translateY: isExiting.value ? enterTranslateY.value : 0 },
        { scale: isExiting.value ? enterScale.value : 1 },
        { rotate: `${tilt}deg` },
      ],
    };
  });

  const exitCardStyle = useAnimatedStyle(() => {
    const tilt = exitTranslateX.value * 0.045;

    return {
      opacity: exitOpacity.value,
      transform: [{ translateX: exitTranslateX.value }, { rotate: `${tilt}deg` }],
    };
  });

  const leftCornerStyle = useAnimatedStyle(() => ({
    opacity:
      !isExiting.value && leftAction
        ? interpolate(translateX.value, [0, leftWidth * 0.85], [0, 1], 'clamp')
        : 0,
    transform: [
      {
        scale: leftAction
          ? interpolate(translateX.value, [0, leftWidth * 0.85], [0.82, 1], 'clamp')
          : 0.82,
      },
    ],
  }));

  const rightCornerStyle = useAnimatedStyle(() => ({
    opacity:
      !isExiting.value && rightAction
        ? interpolate(translateX.value, [-rightWidth * 0.85, 0], [1, 0], 'clamp')
        : 0,
    transform: [
      {
        scale: rightAction
          ? interpolate(translateX.value, [-rightWidth * 0.85, 0], [1, 0.82], 'clamp')
          : 0.82,
      },
    ],
  }));

  const fillsContainer = (() => {
    if (style == null) {
      return false;
    }

    const flat = StyleSheet.flatten(style);
    return (
      flat.flex === 1 ||
      flat.maxHeight === '100%' ||
      flat.height === '100%' ||
      typeof flat.height === 'number'
    );
  })();

  const cardShellStyle = [
    styles.cornerCard,
    !clipContent && styles.cornerCardOpen,
    styles.cornerCardFront,
    fillsContainer && styles.cornerCardFill,
    webDragStyle(dragging),
    cardStyle,
  ];

  const cardNode =
    Platform.OS === 'web' ? (
      <Animated.View
        style={cardShellStyle}
        onTouchStart={onWebTouchStart}
        onTouchMove={onWebTouchMove}
        onTouchEnd={onWebTouchEnd}
        onTouchCancel={onWebTouchCancel}
        // @ts-expect-error RN Web mouse drag
        onMouseDown={onWebMouseDown}
        {...({ dataSet: { advSwipeDeck: '1' } } as object)}>
        {children}
      </Animated.View>
    ) : (
      <GestureDetector gesture={pan}>
        <Animated.View style={cardShellStyle}>{children}</Animated.View>
      </GestureDetector>
    );

  return (
    <View
      style={[styles.cornerWrap, style]}
      onLayout={onContainerLayout}
      {...(Platform.OS === 'web' ? ({ dataSet: { advSwipeDeck: '1' } } as object) : null)}>
      {leftAction ? (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.cornerAction,
            styles.cornerLeft,
            { backgroundColor: leftBg },
            leftCornerStyle,
          ]}>
          <Text style={[styles.cornerActionText, { color: leftText }]}>{leftAction.label}</Text>
        </Animated.View>
      ) : null}

      {rightAction ? (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.cornerAction,
            styles.cornerRight,
            { backgroundColor: rightBg },
            rightCornerStyle,
          ]}>
          <Text style={[styles.cornerActionText, { color: rightText }]}>{rightAction.label}</Text>
        </Animated.View>
      ) : null}

      {cardNode}

      {outgoingCard ? (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.cornerCard,
            !clipContent && styles.cornerCardOpen,
            styles.cornerCardExit,
            exitCardStyle,
          ]}>
          {outgoingCard}
        </Animated.View>
      ) : null}
    </View>
  );
}

type StripSwipeBlockProps = Omit<SwipeBlockProps, 'variant'> & {
  actionWidth: number;
};

function StripSwipeBlock({
  children,
  leftAction,
  rightAction,
  actionWidth,
  style,
  onSwipeLeft,
  onSwipeRight,
}: StripSwipeBlockProps) {
  const colors = useTheme();
  const styles = useThemedStyles(createSwipeStyles);
  const leftWidth = leftAction ? actionWidth : 0;
  const rightWidth = rightAction ? actionWidth : 0;
  const { restX, minX, maxX } = getStripLimits(leftWidth, rightWidth);

  const [dragging, setDragging] = useState(false);
  const [containerWidth, setContainerWidth] = useState(0);

  const translateX = useSharedValue(restX);
  const startX = useSharedValue(restX);

  const startDrag = useCallback(() => setDragging(true), []);
  const endDrag = useCallback(() => setDragging(false), []);

  useEffect(() => {
    translateX.value = restX;
    startX.value = restX;
  }, [restX, startX, translateX]);

  const leftBg = leftAction?.backgroundColor ?? colors.primary;
  const rightBg = rightAction?.backgroundColor ?? colors.destructive;
  const leftText = leftAction?.textColor ?? colors.onPrimary;
  const rightText = rightAction?.textColor ?? colors.onPrimary;

  const onContainerLayout = useCallback((event: LayoutChangeEvent) => {
    setContainerWidth(event.nativeEvent.layout.width);
  }, []);

  const pan = useMemo(
    () =>
      Gesture.Pan()
        .mouseButton(MouseButton.LEFT)
        .activeOffsetX([-12, 12])
        .failOffsetY([-10, 10])
        .onStart(() => {
          startX.value = translateX.value;
          runOnJS(startDrag)();
        })
        .onUpdate((event) => {
          const next = startX.value + event.translationX;
          translateX.value = Math.min(maxX, Math.max(minX, next));
        })
        .onEnd((event) => {
          const projected = translateX.value + event.velocityX * 0.08;

          if (leftAction && projected >= restX + leftWidth * 0.45) {
            translateX.value = withSpring(restX, SPRING);
            if (leftAction.onPress) {
              runOnJS(leftAction.onPress)();
            }
            if (onSwipeRight) {
              runOnJS(onSwipeRight)();
            }
            return;
          }

          if (rightAction && projected <= restX - rightWidth * 0.45) {
            translateX.value = withSpring(restX, SPRING);
            if (rightAction.onPress) {
              runOnJS(rightAction.onPress)();
            }
            if (onSwipeLeft) {
              runOnJS(onSwipeLeft)();
            }
            return;
          }

          translateX.value = withSpring(restX, SPRING);
        })
        .onFinalize((_event, success) => {
          runOnJS(endDrag)();
          if (!success) {
            translateX.value = withSpring(restX, SPRING);
          }
        }),
    [
      leftAction,
      leftWidth,
      maxX,
      minX,
      onSwipeLeft,
      onSwipeRight,
      restX,
      rightAction,
      rightWidth,
      endDrag,
      startDrag,
      startX,
      translateX,
    ],
  );

  const rowStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  const rowWidth = leftWidth + containerWidth + rightWidth;

  return (
    <View
      style={[styles.stripContainer, webDragStyle(dragging), style]}
      onLayout={onContainerLayout}>
      <GestureDetector gesture={pan}>
        <Animated.View
          style={[
            styles.row,
            webDragStyle(dragging),
            containerWidth > 0 ? { width: rowWidth } : styles.rowMeasured,
            rowStyle,
          ]}>
          {leftAction ? (
            <View style={[styles.stripAction, { width: leftWidth, backgroundColor: leftBg }]}>
              <Text style={[styles.stripActionText, { color: leftText }]}>{leftAction.label}</Text>
            </View>
          ) : null}

          <View style={[styles.stripContent, containerWidth > 0 && { width: containerWidth }]}>
            {children}
          </View>

          {rightAction ? (
            <View style={[styles.stripAction, { width: rightWidth, backgroundColor: rightBg }]}>
              <Text style={[styles.stripActionText, { color: rightText }]}>{rightAction.label}</Text>
            </View>
          ) : null}
        </Animated.View>
      </GestureDetector>
    </View>
  );
}

export function SwipeBlock({
  variant = 'strip',
  actionWidth = 96,
  ...props
}: SwipeBlockProps) {
  if (variant === 'corner') {
    return <CornerSwipeBlock actionWidth={actionWidth} {...props} />;
  }

  return <StripSwipeBlock actionWidth={actionWidth} {...props} />;
}

function createSwipeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    stripContainer: {
      overflow: 'hidden',
      borderRadius: BLOCK_RADIUS,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'stretch',
    },
    rowMeasured: {
      width: '100%',
    },
    stripContent: {
      flex: 1,
      backgroundColor: colors.surface,
    },
    stripAction: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: Spacing.sm,
    },
    stripActionText: {
      fontSize: FontSize.caption,
      fontWeight: '600',
      textAlign: 'center',
    },
    cornerWrap: {
      position: 'relative',
      overflow: 'visible',
      ...Platform.select({
        web: {
          touchAction: 'none',
        } as object,
        default: {},
      }),
    },
    cornerCard: {
      borderRadius: BLOCK_RADIUS,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      overflow: 'hidden',
      ...Platform.select({
        web: {
          touchAction: 'none',
        } as object,
        default: {},
      }),
    },
    cornerCardOpen: {
      overflow: 'visible',
      backgroundColor: 'transparent',
      borderWidth: 0,
    },
    cornerCardFront: {
      zIndex: 1,
    },
    cornerCardFill: {
      width: '100%',
      height: '100%',
      minHeight: 0,
    },
    cornerCardExit: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      zIndex: 3,
    },
    cornerAction: {
      position: 'absolute',
      top: Spacing.sm,
      zIndex: 2,
      minWidth: 88,
      paddingHorizontal: Spacing.sm,
      paddingVertical: Spacing.xs,
      borderRadius: Radius.pill,
      alignItems: 'center',
      justifyContent: 'center',
      shadowColor: colors.shadow,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.12,
      shadowRadius: 4,
      elevation: 3,
    },
    cornerLeft: {
      left: Spacing.sm,
    },
    cornerRight: {
      right: Spacing.sm,
    },
    cornerActionText: {
      fontSize: FontSize.caption,
      fontWeight: '600',
      textAlign: 'center',
    },
  });
}
