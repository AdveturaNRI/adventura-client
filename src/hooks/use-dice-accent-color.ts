import { useCallback, useEffect, useRef, useState } from 'react';

import {
  coerceDiceAccent,
  getDiceAccentColorSync,
  loadDiceAccentColor,
  saveDiceAccentColor,
} from '@/utils/dice-color-storage';

const ACCENT_CHANGED_EVENT = 'adventura:dice-accent-changed';

export function useDiceAccentColor() {
  const [accent, setAccentState] = useState(getDiceAccentColorSync);
  const userSetRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    void loadDiceAccentColor().then((value) => {
      // Не затираем цвет, который пользователь уже выбрал в этом сеансе.
      if (!cancelled && !userSetRef.current) {
        setAccentState(value);
      }
    });

    const onAccentChanged = (event: Event) => {
      const detail = (event as CustomEvent<string>).detail;
      if (typeof detail === 'string') {
        setAccentState(coerceDiceAccent(detail));
      }
    };

    if (typeof window !== 'undefined') {
      window.addEventListener(ACCENT_CHANGED_EVENT, onAccentChanged);
    }

    return () => {
      cancelled = true;
      if (typeof window !== 'undefined') {
        window.removeEventListener(ACCENT_CHANGED_EVENT, onAccentChanged);
      }
    };
  }, []);

  const setAccent = useCallback(async (hex: string) => {
    const next = coerceDiceAccent(hex);
    userSetRef.current = true;
    setAccentState(next);
    await saveDiceAccentColor(next);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent(ACCENT_CHANGED_EVENT, { detail: next }));
    }
  }, []);

  return { accent, setAccent };
}
