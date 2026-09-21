import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { isDiceSkinId } from '@/data/rewards/catalog';
const KEY = '@adventura/dice-skin-id';
export function getDiceSkinIdSync() {
    if (Platform.OS !== 'web' || typeof localStorage === 'undefined') {
        return 'standard';
    }
    const raw = localStorage.getItem(KEY);
    return isDiceSkinId(raw) ? raw : 'standard';
}
export async function loadDiceSkinId() {
    const raw = await AsyncStorage.getItem(KEY);
    return isDiceSkinId(raw) ? raw : 'standard';
}
export async function saveDiceSkinId(id) {
    const next = isDiceSkinId(id) ? id : 'standard';
    await AsyncStorage.setItem(KEY, next);
    if (Platform.OS === 'web' && typeof localStorage !== 'undefined') {
        localStorage.setItem(KEY, next);
    }
}
