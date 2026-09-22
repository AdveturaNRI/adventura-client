import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useProfile } from '@/context/ProfileContext';
import { EMPTY_PERKS, diceSkinIdsFromPerks, isDiceSkinId, } from '@/data/rewards/catalog';
import { getDiceSkinIdSync, loadDiceSkinId, saveDiceSkinId, } from '@/utils/dice-skin-storage';
const SKIN_CHANGED_EVENT = 'adventura:dice-skin-changed';
export function useDiceSkin() {
    const { profile } = useProfile();
    const unlockedIds = useMemo(() => diceSkinIdsFromPerks(profile?.perks), [profile?.perks]);
    const [skinId, setSkinState] = useState(getDiceSkinIdSync);
    const userSetRef = useRef(false);
    useEffect(() => {
        let cancelled = false;
        void loadDiceSkinId().then((value) => {
            if (!cancelled && !userSetRef.current) {
                setSkinState(value);
            }
        });
        const onChanged = (event) => {
            const detail = event.detail;
            if (isDiceSkinId(detail)) {
                setSkinState(detail);
            }
        };
        if (typeof window !== 'undefined') {
            window.addEventListener(SKIN_CHANGED_EVENT, onChanged);
        }
        return () => {
            cancelled = true;
            if (typeof window !== 'undefined') {
                window.removeEventListener(SKIN_CHANGED_EVENT, onChanged);
            }
        };
    }, []);
    const resolvedSkinId = unlockedIds.includes(skinId) ? skinId : 'standard';
    const setSkinId = useCallback(async (id) => {
        const next = isDiceSkinId(id) ? id : 'standard';
        userSetRef.current = true;
        setSkinState(next);
        await saveDiceSkinId(next);
        if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent(SKIN_CHANGED_EVENT, { detail: next }));
        }
    }, []);
    return {
        skinId: resolvedSkinId,
        unlockedIds,
        setSkinId,
        perks: profile?.perks ?? EMPTY_PERKS,
    };
}
