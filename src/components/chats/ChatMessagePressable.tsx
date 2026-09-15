import { type ReactNode, useMemo } from 'react';
import {
  Platform,
  Pressable,
  type GestureResponderEvent,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
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
const PAN_ACTIVATE_X = 16;
const PAN_FAIL_Y = 10;
const PAN_HORIZONTAL_RATIO = 1.2;
const OPEN_DRAG_DISTANCE = 52;
const MAX_DRAG_X = 72;

const SPRING = {
  damping: 20,
  stiffness: 260,
  mass: 0.75,
};

/**
 * Как в Telegram:
 * - long press → контекстное меню
 * - web: правый клик → меню
 * - свайп по горизонтали → меню
 * - режим выбора: обычный тап переключает выделение
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

  const composed = useMemo(() => {
    if (selectionMode) {
      return Gesture.Tap();
    }

    const longPress = Gesture.LongPress()
      .minDuration(LONG_PRESS_MS)
      .maxDistance(12)
      .onStart(() => {
        runOnJS(onOpenActions)();
      });

    const pan = Gesture.Pan()
      .manualActivation(true)
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
      })
      .onUpdate((event) => {
        'worklet';
        const next = Math.max(-MAX_DRAG_X, Math.min(MAX_DRAG_X, event.translationX));
        translateX.value = next;
      })
      .onEnd((event) => {
        'worklet';
        const shouldOpen = Math.abs(event.translationX) >= OPEN_DRAG_DISTANCE;
        translateX.value = withSpring(0, SPRING);
        if (shouldOpen) {
          runOnJS(onOpenActions)();
        }
      })
      .onFinalize((_event, success) => {
        'worklet';
        if (!success) {
          translateX.value = withSpring(0, SPRING);
        }
      });

    // Long press приоритетнее: как в TG удерживание открывает меню, свайп — запасной жест.
    return Gesture.Exclusive(longPress, pan);
  }, [isPanActivated, onOpenActions, selectionMode, touchStartX, touchStartY, translateX]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

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
    onOpenActions();
  };

  if (selectionMode) {
    return (
      <Pressable
        onPress={onOpenActions}
        style={[
          style,
          Platform.OS === 'web' ? ({ cursor: 'pointer' } as ViewStyle) : null,
        ]}>
        {children}
      </Pressable>
    );
  }

  return (
    <GestureDetector gesture={composed}>
      <Animated.View
        style={[style, animatedStyle]}
        // @ts-expect-error RN Web: native context menu
        onContextMenu={handleContextMenu}>
        {children}
      </Animated.View>
    </GestureDetector>
  );
}
