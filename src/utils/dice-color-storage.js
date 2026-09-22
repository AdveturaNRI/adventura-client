import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
const KEY = '@adventura/dice-accent-color';
/** Дефолт — бренд-синий, как раньше у themeColor. */
export const DEFAULT_DICE_ACCENT = '#157AFE';
export const DICE_ACCENT_PALETTE = [
    { id: 'blue', hex: '#157AFE', label: 'Синий' },
    { id: 'red', hex: '#E53935', label: 'Красный' },
    { id: 'green', hex: '#43A047', label: 'Зелёный' },
    { id: 'orange', hex: '#FB8C00', label: 'Оранжевый' },
    { id: 'purple', hex: '#8E24AA', label: 'Фиолетовый' },
    { id: 'cyan', hex: '#00ACC1', label: 'Бирюзовый' },
    { id: 'gold', hex: '#F9A825', label: 'Золотой' },
    { id: 'bone', hex: '#F5F0E6', label: 'Слоновая кость' },
    { id: 'slate', hex: '#455A64', label: 'Грифель' },
    { id: 'black', hex: '#212121', label: 'Чёрный' },
];
function normalizeHex(raw) {
    if (!raw)
        return null;
    const value = raw.trim();
    if (!/^#[0-9A-Fa-f]{6}$/.test(value))
        return null;
    return `#${value.slice(1).toUpperCase()}`;
}
/** Приводит к каноническому #RRGGBB из палитры или валидному hex. */
export function coerceDiceAccent(raw) {
    const normalized = normalizeHex(raw);
    if (!normalized)
        return DEFAULT_DICE_ACCENT;
    const match = DICE_ACCENT_PALETTE.find((item) => item.hex.toLowerCase() === normalized.toLowerCase());
    return match?.hex ?? normalized;
}
export function getDiceAccentColorSync() {
    if (Platform.OS !== 'web' || typeof localStorage === 'undefined') {
        return DEFAULT_DICE_ACCENT;
    }
    return coerceDiceAccent(localStorage.getItem(KEY));
}
export async function loadDiceAccentColor() {
    const value = await AsyncStorage.getItem(KEY);
    return coerceDiceAccent(value);
}
export async function saveDiceAccentColor(hex) {
    const next = coerceDiceAccent(hex);
    await AsyncStorage.setItem(KEY, next);
    if (Platform.OS === 'web' && typeof localStorage !== 'undefined') {
        localStorage.setItem(KEY, next);
    }
}
