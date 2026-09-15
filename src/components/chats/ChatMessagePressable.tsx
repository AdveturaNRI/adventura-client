import { type ReactNode } from 'react';
import {
  Platform,
  Pressable,
  type GestureResponderEvent,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

type ChatMessagePressableProps = {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  selectionMode: boolean;
  onOpenActions: () => void;
};

const LONG_PRESS_MS = 350;

/**
 * Long press / правый клик → меню сообщения.
 * Без GestureDetector: Pan/LongPress из RNGH перехватывают вертикальный скролл FlatList на телефоне.
 */
export function ChatMessagePressable({
  children,
  style,
  selectionMode,
  onOpenActions,
}: ChatMessagePressableProps) {
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

  return (
    <Pressable
      onPress={selectionMode ? onOpenActions : undefined}
      onLongPress={selectionMode ? undefined : onOpenActions}
      delayLongPress={LONG_PRESS_MS}
      style={[
        style,
        Platform.OS === 'web' ? ({ cursor: 'pointer' } as ViewStyle) : null,
      ]}
      // @ts-expect-error RN Web: native context menu
      onContextMenu={handleContextMenu}>
      {children}
    </Pressable>
  );
}
