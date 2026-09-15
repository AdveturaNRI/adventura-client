import { useCallback, useEffect, useState } from 'react';

import {
  getDiceAccentColorSync,
  loadDiceAccentColor,
  saveDiceAccentColor,
} from '@/utils/dice-color-storage';

export function useDiceAccentColor() {
  const [accent, setAccentState] = useState(getDiceAccentColorSync);

  useEffect(() => {
    let cancelled = false;
    void loadDiceAccentColor().then((value) => {
      if (!cancelled) setAccentState(value);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const setAccent = useCallback(async (hex: string) => {
    setAccentState(hex);
    await saveDiceAccentColor(hex);
  }, []);

  return { accent, setAccent };
}
