import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

const KEY = '@adventura/dice-animations-enabled';

export function getDiceAnimationsEnabledSync(): boolean {
  if (Platform.OS !== 'web' || typeof localStorage === 'undefined') {
    return true;
  }
  const value = localStorage.getItem(KEY);
  if (value === '0' || value === 'false') {
    return false;
  }
  return true;
}

export async function loadDiceAnimationsEnabled(): Promise<boolean> {
  const value = await AsyncStorage.getItem(KEY);
  if (value === '0' || value === 'false') {
    return false;
  }
  return true;
}

export async function saveDiceAnimationsEnabled(enabled: boolean): Promise<void> {
  const next = enabled ? '1' : '0';
  await AsyncStorage.setItem(KEY, next);
  if (Platform.OS === 'web' && typeof localStorage !== 'undefined') {
    localStorage.setItem(KEY, next);
  }
}
