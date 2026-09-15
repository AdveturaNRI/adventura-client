import AsyncStorage from '@react-native-async-storage/async-storage';

import type { ArtBuildResult, ArtHistoryEntry } from './types';

const STORAGE_KEY = '@adventura/art-studio-history';
const MAX_ENTRIES = 10;

type Listener = (entries: ArtHistoryEntry[]) => void;

let memory: ArtHistoryEntry[] = [];
let loaded = false;
let loadPromise: Promise<void> | null = null;
const listeners = new Set<Listener>();

function isResult(value: unknown): value is ArtBuildResult {
  if (!value || typeof value !== 'object') return false;
  const result = value as ArtBuildResult;
  return (
    typeof result.prompt === 'string' &&
    typeof result.url === 'string' &&
    typeof result.seed === 'number' &&
    typeof result.entityId === 'string' &&
    typeof result.width === 'number' &&
    typeof result.height === 'number'
  );
}

function isEntry(value: unknown): value is ArtHistoryEntry {
  if (!value || typeof value !== 'object') return false;
  const entry = value as ArtHistoryEntry;
  return (
    typeof entry.id === 'string' &&
    typeof entry.at === 'number' &&
    isResult(entry.result)
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
    // ignore
  }
}

export async function loadArtHistory(): Promise<ArtHistoryEntry[]> {
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

export function subscribeArtHistory(listener: Listener): () => void {
  listeners.add(listener);
  listener(memory.slice());
  return () => {
    listeners.delete(listener);
  };
}

export function pushArtHistory(result: ArtBuildResult): ArtHistoryEntry {
  const entry: ArtHistoryEntry = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    at: Date.now(),
    result,
  };
  memory = [entry, ...memory].slice(0, MAX_ENTRIES);
  emit();
  void persist();
  return entry;
}

export function clearArtHistory(): void {
  memory = [];
  emit();
  void persist();
}
