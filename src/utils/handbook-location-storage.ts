import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

import type { HandbookCategoryFilter } from '@/data/handbook/types';

const KEY = '@adventura/handbook-location';

export type HandbookLocation = {
  systemId: string | null;
  category: HandbookCategoryFilter;
};

const DEFAULT_LOCATION: HandbookLocation = {
  systemId: null,
  category: 'all',
};

const CATEGORY_SET = new Set<HandbookCategoryFilter>([
  'all',
  'races',
  'classes',
  'spells',
  'equipment',
  'bestiary',
  'rules',
]);

/** Разовый пропуск restore: клик по крошке «Справочник» открывает хаб, а не прошлую систему. */
let skipNextRestore = false;

export function markHandbookHubIntent() {
  skipNextRestore = true;
}

export function consumeHandbookHubIntent(): boolean {
  if (!skipNextRestore) return false;
  skipNextRestore = false;
  return true;
}

function parseLocation(raw: string | null | undefined): HandbookLocation | null {
  if (!raw) return null;
  try {
    const data = JSON.parse(raw) as Partial<HandbookLocation>;
    const systemId =
      typeof data.systemId === 'string' && data.systemId.trim()
        ? data.systemId.trim()
        : null;
    const category =
      typeof data.category === 'string' && CATEGORY_SET.has(data.category as HandbookCategoryFilter)
        ? (data.category as HandbookCategoryFilter)
        : 'all';
    return { systemId, category };
  } catch {
    return null;
  }
}

export function getHandbookLocationSync(): HandbookLocation | null {
  if (Platform.OS !== 'web' || typeof localStorage === 'undefined') {
    return null;
  }
  return parseLocation(localStorage.getItem(KEY));
}

export async function loadHandbookLocation(): Promise<HandbookLocation> {
  const fromStorage = parseLocation(await AsyncStorage.getItem(KEY));
  return fromStorage ?? DEFAULT_LOCATION;
}

export async function saveHandbookLocation(next: HandbookLocation): Promise<void> {
  const payload: HandbookLocation = {
    systemId: next.systemId?.trim() || null,
    category: CATEGORY_SET.has(next.category) ? next.category : 'all',
  };
  const raw = JSON.stringify(payload);
  await AsyncStorage.setItem(KEY, raw);
  if (Platform.OS === 'web' && typeof localStorage !== 'undefined') {
    localStorage.setItem(KEY, raw);
  }
}

export async function clearHandbookSystemLocation(): Promise<void> {
  await saveHandbookLocation({ systemId: null, category: 'all' });
}
