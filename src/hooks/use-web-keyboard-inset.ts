import { useEffect, useState } from 'react';
import { Platform } from 'react-native';

/**
 * На iOS Safari / Chrome layout viewport (100vh) не сжимается клавиатурой —
 * она просто накрывает низ. RN KeyboardAvoidingView на web тоже no-op.
 * Считаем перекрытие через visualViewport и поднимаем композер паддингом.
 */
export function useWebKeyboardBottomInset(): number {
  const [inset, setInset] = useState(0);

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') {
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
  }, []);

  return inset;
}
