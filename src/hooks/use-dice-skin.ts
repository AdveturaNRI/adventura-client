import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { DeviceEventEmitter } from 'react-native';

import { useProfile } from '@/context/ProfileContext';
import {
  EMPTY_PERKS,
  diceSkinIdsFromPerks,
  isDiceSkinId,
  type DiceSkinId,
} from '@/data/rewards/catalog';
import {
  getDiceSkinIdSync,
  loadDiceSkinId,
  saveDiceSkinId,
} from '@/utils/dice-skin-storage';
import { canUseDomWindow } from '@/utils/dom-window';

const SKIN_CHANGED_EVENT = 'adventura:dice-skin-changed';

export function useDiceSkin() {
  const { profile } = useProfile();
  const unlockedIds = useMemo<DiceSkinId[]>(
    () => diceSkinIdsFromPerks(profile?.perks),
    [profile?.perks],
  );

  const [skinId, setSkinState] = useState<DiceSkinId>(getDiceSkinIdSync);
  const userSetRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    void loadDiceSkinId().then((value) => {
      if (!cancelled && !userSetRef.current) {
        setSkinState(value);
      }
    });

    const applyDetail = (detail: unknown) => {
      if (isDiceSkinId(detail)) {
        setSkinState(detail);
      }
    };

    if (canUseDomWindow()) {
      const onChanged = (event: Event) => {
        applyDetail((event as CustomEvent<string>).detail);
      };
      window.addEventListener(SKIN_CHANGED_EVENT, onChanged);
      return () => {
        cancelled = true;
        window.removeEventListener(SKIN_CHANGED_EVENT, onChanged);
      };
    }

    const sub = DeviceEventEmitter.addListener(SKIN_CHANGED_EVENT, applyDetail);
    return () => {
      cancelled = true;
      sub.remove();
    };
  }, []);

  const resolvedSkinId: DiceSkinId = unlockedIds.includes(skinId) ? skinId : 'standard';

  const setSkinId = useCallback(async (id: DiceSkinId) => {
    const next = isDiceSkinId(id) ? id : 'standard';
    userSetRef.current = true;
    setSkinState(next);
    await saveDiceSkinId(next);
    if (canUseDomWindow()) {
      window.dispatchEvent(new CustomEvent(SKIN_CHANGED_EVENT, { detail: next }));
      return;
    }
    DeviceEventEmitter.emit(SKIN_CHANGED_EVENT, next);
  }, []);

  return {
    skinId: resolvedSkinId,
    unlockedIds,
    setSkinId,
    perks: profile?.perks ?? EMPTY_PERKS,
  };
}
