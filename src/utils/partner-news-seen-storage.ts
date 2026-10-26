import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useSyncExternalStore } from 'react';

const KEY = '@adventura/partner-news-seen';
/** Partners keep one live post each; a short tail is enough. */
const MAX_IDS = 50;
const EMPTY: ReadonlySet<string> = new Set();

/** Replaced, never mutated: the Set identity is the snapshot for `useSyncExternalStore`. */
let cache: Set<string> | null = null;
/** One shared read: parallel loads must not overwrite ids marked in between. */
let loading: Promise<Set<string>> | null = null;
const listeners = new Set<() => void>();

function parse(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed)
      ? parsed.filter((id): id is string => typeof id === 'string')
      : [];
  } catch {
    return [];
  }
}

function notify() {
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function loadSeenPartnerNews(): Promise<Set<string>> {
  if (cache) return Promise.resolve(cache);
  loading ??= AsyncStorage.getItem(KEY)
    .catch(() => null)
    .then((raw) => {
      if (!cache) {
        cache = new Set(parse(raw));
        notify();
      }
      return cache;
    });
  return loading;
}

export async function markPartnerNewsSeen(id: string): Promise<void> {
  await loadSeenPartnerNews();
  const seen = cache ?? new Set<string>();
  if (seen.has(id)) return;
  const ids = [...seen, id].slice(-MAX_IDS);
  cache = new Set(ids);
  notify();
  await AsyncStorage.setItem(KEY, JSON.stringify(ids));
}

/** Ids of partner news this device has opened; re-renders on every new mark. */
export function useSeenPartnerNews(): ReadonlySet<string> {
  useEffect(() => {
    void loadSeenPartnerNews();
  }, []);
  return useSyncExternalStore(
    subscribe,
    () => cache ?? EMPTY,
    () => EMPTY,
  );
}
