import { type ReactNode, useCallback, useMemo, useRef } from 'react';
import {
  Platform,
  Pressable,
  type GestureResponderEvent,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { Gesture, GestureDetector, MouseButton } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';

type ChatMessagePressableProps = {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  selectionMode: boolean;
  onOpenActions: () => void;
};

const LONG_PRESS_MS = 350;
const LONG_PRESS_MAX_DISTANCE = 12;
const PAN_ACTIVATE_X = 24;
const PAN_FAIL_Y = 14;
const PAN_HORIZONTAL_RATIO = 1.2;
const OPEN_DRAG_DISTANCE = 52;
const MAX_DRAG_X = 72;

const SPRING = {
  damping: 20,
  stiffness: 260,
  mass: 0.75,
};

const NO_SELECT_WEB =
  Platform.OS === 'web'
    ? ({
        userSelect: 'none',
        WebkitUserSelect: 'none',
        WebkitTouchCallout: 'none',
        cursor: 'pointer',
        // Критично: вертикаль остаётся у FlatList/браузера. RNGH Pan на web её съедает.
        touchAction: 'pan-y',
      } as ViewStyle)
    : null;

function clearDocumentSelection() {
  if (Platform.OS !== 'web' || typeof window === 'undefined') {
    return;
  }
  window.getSelection()?.removeAllRanges();
}

type WebSwipeState = {
  startX: number;
  startY: number;
  dx: number;
  axis: 'undecided' | 'horizontal' | 'vertical';
};

/**
 * Web: без GestureDetector — иначе скролл чата мёртв.
 * Long press / ПКМ / горизонтальный свайп через Pressable + touch (touchAction: pan-y).
 * Native: Pan + LongPress из RNGH, как SwipeBlock.
 */
export function ChatMessagePressable({
  children,
  style,
  selectionMode,
  onOpenActions,
}: ChatMessagePressableProps) {
  const translateX = useSharedValue(0);
  const touchStartX = useSharedValue(0);
  const touchStartY = useSharedValue(0);
  const isPanActivated = useSharedValue(false);
  const webSwipeRef = useRef<WebSwipeState | null>(null);
  const webLongPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const openActions = useCallback(() => {
    clearDocumentSelection();
    onOpenActions();
  }, [onOpenActions]);

  const clearWebLongPress = useCallback(() => {
    if (webLongPressTimerRef.current != null) {
      clearTimeout(webLongPressTimerRef.current);
      webLongPressTimerRef.current = null;
    }
  }, []);

  const resetWebSwipe = useCallback(() => {
    clearWebLongPress();
    webSwipeRef.current = null;
    translateX.value = withSpring(0, SPRING);
  }, [clearWebLongPress, translateX]);

  const handleContextMenu = (event: GestureResponderEvent) => {
    if (Platform.OS !== 'web' || selectionMode) {
      return;
    }
    const native = event.nativeEvent as unknown as {
      preventDefault?: () => void;
      stopPropagation?: () => void;
    };
    native.preventDefault?.();
    native.stopPropagation?.();
    openActions();
  };

  const onWebTouchStart = useCallback(
    (event: GestureResponderEvent) => {
      const touch = event.nativeEvent.touches?.[0] ?? event.nativeEvent;
      const x = touch.pageX ?? touch.locationX ?? 0;
      const y = touch.pageY ?? touch.locationY ?? 0;
      webSwipeRef.current = { startX: x, startY: y, dx: 0, axis: 'undecided' };
      clearWebLongPress();
      webLongPressTimerRef.current = setTimeout(() => {
        webLongPressTimerRef.current = null;
        const state = webSwipeRef.current;
        if (state && state.axis !== 'vertical') {
          openActions();
        }
      }, LONG_PRESS_MS);
    },
    [clearWebLongPress, openActions],
  );

  const onWebTouchMove = useCallback(
    (event: GestureResponderEvent) => {
      const state = webSwipeRef.current;
      if (!state) {
        return;
      }
      const touch = event.nativeEvent.touches?.[0] ?? event.nativeEvent;
      const x = touch.pageX ?? touch.locationX ?? 0;
      const y = touch.pageY ?? touch.locationY ?? 0;
      const dx = x - state.startX;
      const dy = y - state.startY;
      const absDx = Math.abs(dx);
      const absDy = Math.abs(dy);

      if (state.axis === 'undecided') {
        if (absDy > PAN_FAIL_Y && absDy > absDx) {
          state.axis = 'vertical';
          clearWebLongPress();
          translateX.value = 0;
          return;
        }
        if (absDx > PAN_ACTIVATE_X && absDx > absDy * PAN_HORIZONTAL_RATIO) {
          state.axis = 'horizontal';
          clearWebLongPress();
        } else {
          if (absDx > LONG_PRESS_MAX_DISTANCE || absDy > LONG_PRESS_MAX_DISTANCE) {
            clearWebLongPress();
          }
          return;
        }
      }

      if (state.axis === 'vertical') {
        return;
      }

      // Горизонталь: лёгкий сдвиг бабла, скролл не трогаем (touchAction: pan-y).
      state.dx = dx;
      translateX.value = Math.max(-MAX_DRAG_X, Math.min(MAX_DRAG_X, dx));
    },
    [clearWebLongPress, translateX],
  );

  const onWebTouchEnd = useCallback(() => {
    const state = webSwipeRef.current;
    const dragged = state?.dx ?? 0;
    clearWebLongPress();
    webSwipeRef.current = null;
    translateX.value = withSpring(0, SPRING);
    if (state?.axis === 'horizontal' && Math.abs(dragged) >= OPEN_DRAG_DISTANCE) {
      openActions();
    }
  }, [clearWebLongPress, openActions, translateX]);

  const longPress = useMemo(
    () =>
      Gesture.LongPress()
        .minDuration(LONG_PRESS_MS)
        .maxDistance(LONG_PRESS_MAX_DISTANCE)
        .onStart(() => {
          'worklet';
          runOnJS(openActions)();
        }),
    [openActions],
  );

  const pan = useMemo(
    () =>
      Gesture.Pan()
        .manualActivation(true)
        .simultaneousWithExternalGesture(Gesture.Native())
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
        .onTouchesMove((event, gestureState) => {
          'worklet';
          if (isPanActivated.value) {
            return;
          }
          const touch = event.allTouches[0];
          if (!touch) {
            return;
          }
          const dx = touch.x - touchStartX.value;
          const dy = touch.y - touchStartY.value;
          const absDx = Math.abs(dx);
          const absDy = Math.abs(dy);
          if (absDy > PAN_FAIL_Y && absDy > absDx) {
            gestureState.fail();
            return;
          }
          if (absDx > PAN_ACTIVATE_X && absDx > absDy * PAN_HORIZONTAL_RATIO) {
            isPanActivated.value = true;
            gestureState.activate();
          }
        })
        .onTouchesUp((_event, gestureState) => {
          'worklet';
          if (!isPanActivated.value) {
            gestureState.fail();
          }
        })
        .onUpdate((event) => {
          'worklet';
          translateX.value = Math.max(-MAX_DRAG_X, Math.min(MAX_DRAG_X, event.translationX));
        })
        .onEnd((event) => {
          'worklet';
          const shouldOpen = Math.abs(event.translationX) >= OPEN_DRAG_DISTANCE;
          translateX.value = withSpring(0, SPRING);
          if (shouldOpen) {
            runOnJS(openActions)();
          }
        })
        .onFinalize((_event, success) => {
          'worklet';
          if (!success) {
            translateX.value = withSpring(0, SPRING);
          }
        }),
    [isPanActivated, openActions, touchStartX, touchStartY, translateX],
  );

  const nativeComposed = useMemo(() => Gesture.Race(longPress, pan), [longPress, pan]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  if (selectionMode) {
    return (
      <Pressable onPress={openActions} style={[style, NO_SELECT_WEB]}>
        {children}
      </Pressable>
    );
  }

  // Web: никаких RNGH-жестов — только pan-y + свой long press / свайп.
  if (Platform.OS === 'web') {
    return (
      <Animated.View
        style={[style, animatedStyle, NO_SELECT_WEB]}
        onTouchStart={onWebTouchStart}
        onTouchMove={onWebTouchMove}
        onTouchEnd={onWebTouchEnd}
        onTouchCancel={resetWebSwipe}
        // @ts-expect-error RN Web: native context menu
        onContextMenu={handleContextMenu}>
        {children}
      </Animated.View>
    );
  }

  return (
    <GestureDetector gesture={nativeComposed}>
      <Animated.View style={[style, animatedStyle]}>{children}</Animated.View>
    </GestureDetector>
  );
}
