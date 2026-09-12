import AsyncStorage from '@react-native-async-storage/async-storage';

import type { DiceRollOutcome } from '@/components/dice/dice-stage.types';

const STORAGE_KEY = '@adventura/dice-roll-history';
const MAX_ENTRIES = 40;

export type DiceHistoryEntry = DiceRollOutcome & {
  id: string;
  at: number;
};

function isOutcome(value: unknown): value is DiceRollOutcome {
  if (!value || typeof value !== 'object') return false;
  const o = value as DiceRollOutcome;
  return (
    typeof o.sum === 'number' &&
    typeof o.notation === 'string' &&
    Array.isArray(o.values) &&
    Array.isArray(o.groups)
  );
}

export async function loadDiceHistory(): Promise<DiceHistoryEntry[]> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(
        (item): item is DiceHistoryEntry =>
          !!item &&
          typeof item === 'object' &&
          typeof (item as DiceHistoryEntry).id === 'string' &&
          typeof (item as DiceHistoryEntry).at === 'number' &&
          isOutcome(item),
      )
      .slice(0, MAX_ENTRIES);
  } catch {
    return [];
  }
}

export async function saveDiceHistory(entries: DiceHistoryEntry[]): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(entries.slice(0, MAX_ENTRIES)));
}

export function makeHistoryEntry(outcome: DiceRollOutcome): DiceHistoryEntry {
  return {
    ...outcome,
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    at: Date.now(),
  };
}
