import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

/** Обычная / ускоренная / без 3D. */
export type DiceAnimationSpeed = 'normal' | 'fast' | 'off';

const SPEED_KEY = '@adventura/dice-animation-speed';
/** Старый ключ (вкл/выкл) — читаем для миграции. */
const LEGACY_ENABLED_KEY = '@adventura/dice-animations-enabled';

const SPEEDS: DiceAnimationSpeed[] = ['normal', 'fast', 'off'];

type SpeedListener = (speed: DiceAnimationSpeed) => void;
const listeners = new Set<SpeedListener>();

/** Кеш для sync-чтения (натив без localStorage + мгновенно после save). */
let memorySpeed: DiceAnimationSpeed | null = null;

function parseSpeed(value: string | null | undefined): DiceAnimationSpeed | null {
  if (value === 'normal' || value === 'fast' || value === 'off') {
    return value;
  }
  if (value === '0' || value === 'false') {
    return 'off';
  }
  if (value === '1' || value === 'true') {
    return 'normal';
  }
  return null;
}

function readWebSpeed(): DiceAnimationSpeed | null {
  if (Platform.OS !== 'web' || typeof localStorage === 'undefined') {
    return null;
  }
  const fromSpeed = parseSpeed(localStorage.getItem(SPEED_KEY));
  if (fromSpeed) {
    return fromSpeed;
  }
  return parseSpeed(localStorage.getItem(LEGACY_ENABLED_KEY));
}

function notifyListeners(speed: DiceAnimationSpeed) {
  for (const listener of listeners) {
    try {
      listener(speed);
    } catch {
      // ignore
    }
  }
}

export function getDiceAnimationSpeedSync(): DiceAnimationSpeed {
  if (memorySpeed) {
    return memorySpeed;
  }
  const fromWeb = readWebSpeed();
  if (fromWeb) {
    memorySpeed = fromWeb;
    return fromWeb;
  }
  return 'normal';
}

/** Совместимость: анимация включена, если не `off`. */
export function getDiceAnimationsEnabledSync(): boolean {
  return getDiceAnimationSpeedSync() !== 'off';
}

export function subscribeDiceAnimationSpeed(listener: SpeedListener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export async function loadDiceAnimationSpeed(): Promise<DiceAnimationSpeed> {
  const stored = parseSpeed(await AsyncStorage.getItem(SPEED_KEY));
  if (stored) {
    memorySpeed = stored;
    return stored;
  }
  const legacy = parseSpeed(await AsyncStorage.getItem(LEGACY_ENABLED_KEY));
  const resolved = legacy ?? 'normal';
  memorySpeed = resolved;
  return resolved;
}

export async function loadDiceAnimationsEnabled(): Promise<boolean> {
  return (await loadDiceAnimationSpeed()) !== 'off';
}

export async function saveDiceAnimationSpeed(speed: DiceAnimationSpeed): Promise<void> {
  const next = SPEEDS.includes(speed) ? speed : 'normal';
  memorySpeed = next;
  if (Platform.OS === 'web' && typeof localStorage !== 'undefined') {
    localStorage.setItem(SPEED_KEY, next);
    localStorage.setItem(LEGACY_ENABLED_KEY, next === 'off' ? '0' : '1');
  }
  notifyListeners(next);
  await AsyncStorage.setItem(SPEED_KEY, next);
  await AsyncStorage.setItem(LEGACY_ENABLED_KEY, next === 'off' ? '0' : '1');
}

export async function saveDiceAnimationsEnabled(enabled: boolean): Promise<void> {
  await saveDiceAnimationSpeed(enabled ? 'normal' : 'off');
}

export function cycleDiceAnimationSpeed(current: DiceAnimationSpeed): DiceAnimationSpeed {
  const index = SPEEDS.indexOf(current);
  return SPEEDS[(index + 1) % SPEEDS.length] ?? 'normal';
}
