import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

const KEY = '@adventura/announcements-soft-close';

export type AnnouncementsSoftCloseState = {
  userId: string;
  waiting: boolean;
  knownKeys: string[];
};

function parseState(raw: string | null): AnnouncementsSoftCloseState | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<AnnouncementsSoftCloseState>;
    if (
      typeof parsed.userId !== 'string' ||
      typeof parsed.waiting !== 'boolean' ||
      !Array.isArray(parsed.knownKeys)
    ) {
      return null;
    }
    return {
      userId: parsed.userId,
      waiting: parsed.waiting,
      knownKeys: parsed.knownKeys.filter((key): key is string => typeof key === 'string'),
    };
  } catch {
    return null;
  }
}

function writeSync(raw: string | null) {
  if (Platform.OS !== 'web' || typeof localStorage === 'undefined') return;
  if (raw == null) localStorage.removeItem(KEY);
  else localStorage.setItem(KEY, raw);
}

export async function loadAnnouncementsSoftClose(
  userId: string,
): Promise<AnnouncementsSoftCloseState | null> {
  const fromAsync = parseState(await AsyncStorage.getItem(KEY));
  if (fromAsync?.userId === userId) return fromAsync;

  if (Platform.OS === 'web' && typeof localStorage !== 'undefined') {
    const fromLocal = parseState(localStorage.getItem(KEY));
    if (fromLocal?.userId === userId) return fromLocal;
  }

  return null;
}

export async function saveAnnouncementsSoftClose(
  state: AnnouncementsSoftCloseState,
): Promise<void> {
  const raw = JSON.stringify(state);
  await AsyncStorage.setItem(KEY, raw);
  writeSync(raw);
}

export async function clearAnnouncementsSoftClose(userId: string): Promise<void> {
  const current = await loadAnnouncementsSoftClose(userId);
  if (!current) return;
  await AsyncStorage.removeItem(KEY);
  writeSync(null);
}
