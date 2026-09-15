import AsyncStorage from '@react-native-async-storage/async-storage';

import type { GeneratorCard, GeneratorCategory, HistoryEntry } from './types';

const STORAGE_KEY = '@adventura/gm-toolkit-history';
const MAX_ENTRIES = 20;

type Listener = (entries: HistoryEntry[]) => void;

let memory: HistoryEntry[] = [];
let loaded = false;
let loadPromise: Promise<void> | null = null;
const listeners = new Set<Listener>();

function isCard(value: unknown): value is GeneratorCard {
  if (!value || typeof value !== 'object') return false;
  const card = value as GeneratorCard;
  return (
    typeof card.category === 'string' &&
    typeof card.name === 'string' &&
    typeof card.summary === 'string'
  );
}

function isEntry(value: unknown): value is HistoryEntry {
  if (!value || typeof value !== 'object') return false;
  const entry = value as HistoryEntry;
  return (
    typeof entry.id === 'string' &&
    typeof entry.at === 'number' &&
    isCard(entry.card)
  );
}

function emit() {
  const snapshot = memory.slice();
  for (const listener of listeners) {
    listener(snapshot);
  }
}

async function persist() {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(memory.slice(0, MAX_ENTRIES)));
  } catch {
    // ignore storage failures
  }
}

export async function loadGmHistory(): Promise<HistoryEntry[]> {
  if (loaded) return memory.slice();
  if (!loadPromise) {
    loadPromise = (async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw) as unknown;
          if (Array.isArray(parsed)) {
            memory = parsed.filter(isEntry).slice(0, MAX_ENTRIES);
          }
        }
      } catch {
        memory = [];
      } finally {
        loaded = true;
        emit();
      }
    })();
  }
  await loadPromise;
  return memory.slice();
}

export function getGmHistorySync(): HistoryEntry[] {
  return memory.slice();
}

export function subscribeGmHistory(listener: Listener): () => void {
  listeners.add(listener);
  listener(memory.slice());
  return () => {
    listeners.delete(listener);
  };
}

export function pushGmHistory(card: GeneratorCard): HistoryEntry {
  const entry: HistoryEntry = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    at: Date.now(),
    card,
  };
  memory = [entry, ...memory.filter((item) => item.id !== entry.id)].slice(0, MAX_ENTRIES);
  emit();
  void persist();
  return entry;
}

export function filterGmHistory(
  entries: HistoryEntry[],
  category?: GeneratorCategory | 'all',
): HistoryEntry[] {
  if (!category || category === 'all') return entries;
  return entries.filter((entry) => entry.card.category === category);
}

export function clearGmHistory(): void {
  memory = [];
  emit();
  void persist();
}
