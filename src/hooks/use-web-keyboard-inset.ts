import { useEffect, useState } from 'react';
import { Keyboard, Platform, type KeyboardEvent } from 'react-native';

/**
 * Возвращает перекрытие низа экрана клавиатурой.
 *
 * Web: visualViewport — layout viewport (100vh) не сжимается, клавиатура просто
 * накрывает низ; KeyboardAvoidingView на web — no-op.
 *
 * Native: слушаем Keyboard.* — KeyboardAvoidingView + flex:1 FlatList на iOS
 * часто схлопывает список до нуля (фантомный padding / гонка с safe-area).
 * Поднимаем композер тем же bottomPad, что и на web.
 */
export function useWebKeyboardBottomInset(): number {
  const [inset, setInset] = useState(0);

  useEffect(() => {
    if (Platform.OS === 'web') {
      if (typeof window === 'undefined') {
        return;
      }
      const vv = window.visualViewport;
      if (!vv) {
        return;
      }

      const update = () => {
        const covered = Math.max(0, Math.round(window.innerHeight - vv.height - vv.offsetTop));
        setInset(covered);
      };

      update();
      vv.addEventListener('resize', update);
      vv.addEventListener('scroll', update);
      window.addEventListener('focusin', update);
      window.addEventListener('focusout', update);
      return () => {
        vv.removeEventListener('resize', update);
        vv.removeEventListener('scroll', update);
        window.removeEventListener('focusin', update);
        window.removeEventListener('focusout', update);
      };
    }

    const onShow = (event: KeyboardEvent) => {
      setInset(Math.max(0, Math.round(event.endCoordinates.height)));
    };
    const onHide = () => setInset(0);

    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const showSub = Keyboard.addListener(showEvent, onShow);
    const hideSub = Keyboard.addListener(hideEvent, onHide);
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  return inset;
}
