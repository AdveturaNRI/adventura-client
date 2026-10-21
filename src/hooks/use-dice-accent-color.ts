import { useCallback, useEffect, useRef, useState } from 'react';
import { DeviceEventEmitter } from 'react-native';

import {
  coerceDiceAccent,
  getDiceAccentColorSync,
  loadDiceAccentColor,
  saveDiceAccentColor,
} from '@/utils/dice-color-storage';
import { canUseDomWindow } from '@/utils/dom-window';

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

    const applyDetail = (detail: unknown) => {
      if (typeof detail === 'string') {
        setAccentState(coerceDiceAccent(detail));
      }
    };

    if (canUseDomWindow()) {
      const onAccentChanged = (event: Event) => {
        applyDetail((event as CustomEvent<string>).detail);
      };
      window.addEventListener(ACCENT_CHANGED_EVENT, onAccentChanged);
      return () => {
        cancelled = true;
        window.removeEventListener(ACCENT_CHANGED_EVENT, onAccentChanged);
      };
    }

    const sub = DeviceEventEmitter.addListener(ACCENT_CHANGED_EVENT, applyDetail);
    return () => {
      cancelled = true;
      sub.remove();
    };
  }, []);

  const setAccent = useCallback(async (hex: string) => {
    const next = coerceDiceAccent(hex);
    userSetRef.current = true;
    setAccentState(next);
    await saveDiceAccentColor(next);
    if (canUseDomWindow()) {
      window.dispatchEvent(new CustomEvent(ACCENT_CHANGED_EVENT, { detail: next }));
      return;
    }
    DeviceEventEmitter.emit(ACCENT_CHANGED_EVENT, next);
  }, []);

  return { accent, setAccent };
}
