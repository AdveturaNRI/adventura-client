import AsyncStorage from '@react-native-async-storage/async-storage';

import type { UserProfile } from '@/services/api/types';

const PROFILE_CACHE_KEY_PREFIX = '@adventura/profile-cache';

function getStorageKey(userId: string) {
  return `${PROFILE_CACHE_KEY_PREFIX}:${userId}`;
}

function isUserProfile(value: unknown): value is UserProfile {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const candidate = value as Partial<UserProfile>;
  return typeof candidate.id === 'string' && typeof candidate.nickname === 'string';
}

export async function loadCachedProfile(userId: string): Promise<UserProfile | null> {
  try {
    const raw = await AsyncStorage.getItem(getStorageKey(userId));
    if (!raw) {
      return null;
    }

    const parsed: unknown = JSON.parse(raw);
    return isUserProfile(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export async function saveCachedProfile(userId: string, profile: UserProfile): Promise<void> {
  try {
    await AsyncStorage.setItem(getStorageKey(userId), JSON.stringify(profile));
  } catch {
    // Cache is best-effort — ignore quota / private mode failures.
  }
}

export async function clearCachedProfile(userId: string): Promise<void> {
  try {
    await AsyncStorage.removeItem(getStorageKey(userId));
  } catch {
    // ignore
  }
}
