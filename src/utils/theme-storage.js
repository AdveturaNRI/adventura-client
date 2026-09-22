import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
const THEME_PREFERENCE_KEY = '@adventura/theme-preference';
function isThemePreference(value) {
    return value === 'light' || value === 'dark' || value === 'system';
}
export function getThemePreferenceSync() {
    if (Platform.OS !== 'web' || typeof localStorage === 'undefined') {
        return null;
    }
    const value = localStorage.getItem(THEME_PREFERENCE_KEY);
    return isThemePreference(value) ? value : null;
}
export async function loadThemePreference() {
    const value = await AsyncStorage.getItem(THEME_PREFERENCE_KEY);
    return isThemePreference(value) ? value : null;
}
export async function saveThemePreference(preference) {
    await AsyncStorage.setItem(THEME_PREFERENCE_KEY, preference);
}
