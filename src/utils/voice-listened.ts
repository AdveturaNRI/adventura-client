import AsyncStorage from '@react-native-async-storage/async-storage';

const VOICE_LISTENED_KEY = '@adventura/voice-listened-v1';

const listened = new Set<string>();
const listeners = new Set<(keys: ReadonlySet<string>) => void>();
let hydrate: Promise<void> | null = null;

function publish() {
  const snapshot = new Set(listened);
  listeners.forEach((listener) => listener(snapshot));
}

async function ensureHydrated() {
  if (!hydrate) {
    hydrate = (async () => {
      try {
        const raw = await AsyncStorage.getItem(VOICE_LISTENED_KEY);
        if (!raw) return;
        const parsed = JSON.parse(raw) as unknown;
        if (!Array.isArray(parsed)) return;
        for (const key of parsed) {
          if (typeof key === 'string' && key) listened.add(key);
        }
      } catch {
        // ignore corrupt storage
      }
    })();
  }
  await hydrate;
}

export function subscribeVoiceListened(listener: (keys: ReadonlySet<string>) => void) {
  listeners.add(listener);
  void ensureHydrated().then(() => listener(new Set(listened)));
  return () => {
    listeners.delete(listener);
  };
}

export function isVoiceListened(key: string) {
  return listened.has(key);
}

export async function markVoiceListened(key: string) {
  await ensureHydrated();
  if (listened.has(key)) return;
  listened.add(key);
  publish();
  try {
    await AsyncStorage.setItem(VOICE_LISTENED_KEY, JSON.stringify([...listened]));
  } catch {
    // ignore write failures
  }
}
