import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
const SPEED_KEY = '@adventura/dice-animation-speed';
/** Старый ключ (вкл/выкл) — читаем для миграции. */
const LEGACY_ENABLED_KEY = '@adventura/dice-animations-enabled';
const SPEEDS = ['normal', 'fast', 'off'];
const listeners = new Set();
/** Кеш для sync-чтения (натив без localStorage + мгновенно после save). */
let memorySpeed = null;
function parseSpeed(value) {
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
function readWebSpeed() {
    if (Platform.OS !== 'web' || typeof localStorage === 'undefined') {
        return null;
    }
    const fromSpeed = parseSpeed(localStorage.getItem(SPEED_KEY));
    if (fromSpeed) {
        return fromSpeed;
    }
    return parseSpeed(localStorage.getItem(LEGACY_ENABLED_KEY));
}
function notifyListeners(speed) {
    for (const listener of listeners) {
        try {
            listener(speed);
        }
        catch {
            // ignore
        }
    }
}
export function getDiceAnimationSpeedSync() {
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
export function getDiceAnimationsEnabledSync() {
    return getDiceAnimationSpeedSync() !== 'off';
}
export function subscribeDiceAnimationSpeed(listener) {
    listeners.add(listener);
    return () => {
        listeners.delete(listener);
    };
}
export async function loadDiceAnimationSpeed() {
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
export async function loadDiceAnimationsEnabled() {
    return (await loadDiceAnimationSpeed()) !== 'off';
}
export async function saveDiceAnimationSpeed(speed) {
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
export async function saveDiceAnimationsEnabled(enabled) {
    await saveDiceAnimationSpeed(enabled ? 'normal' : 'off');
}
export function cycleDiceAnimationSpeed(current) {
    const index = SPEEDS.indexOf(current);
    return SPEEDS[(index + 1) % SPEEDS.length] ?? 'normal';
}
