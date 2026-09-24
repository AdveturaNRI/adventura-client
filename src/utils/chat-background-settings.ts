import AsyncStorage from '@react-native-async-storage/async-storage';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import { Platform } from 'react-native';

/** Общий фон чатов (настройки). */
const GLOBAL_KEY = '@adventura/chat-background-v1';
/** Per-chat overrides: Record<conversationId, ChatBackgroundSetting> */
const PER_CHAT_KEY = '@adventura/chat-background-by-chat-v1';
const HISTORY_KEY = '@adventura/chat-background-history-v1';
const MAX_CUSTOM_BYTES = 8 * 1024 * 1024;
const MAX_CUSTOM_EDGE = 1600;
const WEBP_QUALITY = 0.72;
/** Сколько прошлых своих фонов держим (data URI тяжёлые). */
export const CHAT_BG_HISTORY_MAX = 8;

export const CHAT_BG_MAX_UPLOAD_MB = 8;
export const CHAT_BG_ACCEPT = ['image/jpeg', 'image/png', 'image/webp'] as const;

export type ChatBackgroundPreset = {
  id: string;
  label: string;
  /** Верх / низ градиента (светлая тема). */
  colors: [string, string];
  /**
   * Вариант для тёмной темы. Без него светлый пресет в dark mode
   * даёт «глухой» серый фон мимо палитры приложения.
   */
  darkColors?: [string, string];
  dimmer: number;
  darkDimmer?: number;
};

export type ChatBackgroundSetting =
  | { kind: 'default' }
  | { kind: 'preset'; presetId: string }
  | { kind: 'custom'; uri: string };

export type ChatBackgroundHistoryItem = {
  id: string;
  uri: string;
  createdAt: number;
};

export const CHAT_BACKGROUND_PRESETS: ChatBackgroundPreset[] = [
  {
    id: 'mist',
    label: 'Туман',
    colors: ['#D7DEE8', '#B8C4D4'],
    // Близко к surface/background приложения, не к светло-серому «Туман»у из light.
    darkColors: ['#1C2229', '#0E1216'],
    dimmer: 0.28,
    darkDimmer: 0.18,
  },
  {
    id: 'parchment',
    label: 'Пергамент',
    colors: ['#E8DCC8', '#C9B896'],
    darkColors: ['#2A241C', '#14110C'],
    dimmer: 0.22,
    darkDimmer: 0.2,
  },
  {
    id: 'forest',
    label: 'Хвойный',
    colors: ['#1F3A2E', '#0F241C'],
    dimmer: 0.42,
  },
  {
    id: 'dusk',
    label: 'Сумерки',
    colors: ['#3A2F55', '#1A1528'],
    dimmer: 0.4,
  },
  {
    id: 'ocean',
    label: 'Глубина',
    colors: ['#1B3A4B', '#0D1F2A'],
    dimmer: 0.4,
  },
  {
    id: 'ember',
    label: 'Угли',
    colors: ['#4A2A22', '#1E1210'],
    dimmer: 0.42,
  },
  {
    id: 'slate',
    label: 'Сланец',
    colors: ['#4A5560', '#2A3138'],
    dimmer: 0.38,
  },
  {
    id: 'aurora',
    label: 'Север',
    colors: ['#1A3A3A', '#24305A'],
    dimmer: 0.4,
  },
];

/** Цвета пресета под текущую тему. */
export function resolvePresetColors(
  preset: ChatBackgroundPreset,
  isDark: boolean,
): [string, string] {
  if (isDark && preset.darkColors) {
    return preset.darkColors;
  }
  return preset.colors;
}

const DEFAULT_SETTING: ChatBackgroundSetting = { kind: 'default' };

let cachedGlobal: ChatBackgroundSetting = { ...DEFAULT_SETTING };
let globalHydrated = false;
const globalListeners = new Set<(next: ChatBackgroundSetting) => void>();

let cachedPerChat: Record<string, ChatBackgroundSetting> = {};
let perChatHydrated = false;
const perChatListeners = new Set<(conversationId: string) => void>();

let cachedHistory: ChatBackgroundHistoryItem[] = [];
let historyHydrated = false;
const historyListeners = new Set<(next: ChatBackgroundHistoryItem[]) => void>();

function writeWeb(key: string, value: string) {
  if (Platform.OS === 'web' && typeof localStorage !== 'undefined') {
    localStorage.setItem(key, value);
  }
}

function readWeb(key: string): string | null {
  if (Platform.OS !== 'web' || typeof localStorage === 'undefined') {
    return null;
  }
  return localStorage.getItem(key);
}

function parseSetting(raw: unknown): ChatBackgroundSetting {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return { ...DEFAULT_SETTING };
  }
  const parsed = raw as Partial<ChatBackgroundSetting> & {
    kind?: string;
    presetId?: string;
    uri?: string;
  };
  if (parsed.kind === 'preset' && typeof parsed.presetId === 'string') {
    const exists = CHAT_BACKGROUND_PRESETS.some((p) => p.id === parsed.presetId);
    if (exists) return { kind: 'preset', presetId: parsed.presetId };
  }
  if (parsed.kind === 'custom' && typeof parsed.uri === 'string' && parsed.uri.length > 0) {
    return { kind: 'custom', uri: parsed.uri };
  }
  if (parsed.kind === 'default') {
    return { kind: 'default' };
  }
  return { ...DEFAULT_SETTING };
}

function parseSettingRaw(raw: string | null): ChatBackgroundSetting {
  if (!raw) return { ...DEFAULT_SETTING };
  try {
    return parseSetting(JSON.parse(raw));
  } catch {
    return { ...DEFAULT_SETTING };
  }
}

function parsePerChatMap(raw: string | null): Record<string, ChatBackgroundSetting> {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    const out: Record<string, ChatBackgroundSetting> = {};
    for (const [id, value] of Object.entries(parsed as Record<string, unknown>)) {
      if (!id) continue;
      out[id] = parseSetting(value);
    }
    return out;
  } catch {
    return {};
  }
}

function parseHistory(raw: string | null): ChatBackgroundHistoryItem[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    const items: ChatBackgroundHistoryItem[] = [];
    for (const entry of parsed) {
      if (!entry || typeof entry !== 'object') continue;
      const row = entry as Record<string, unknown>;
      if (typeof row.uri !== 'string' || row.uri.length < 8) continue;
      const id =
        typeof row.id === 'string' && row.id.length > 0
          ? row.id
          : `bg_${row.createdAt ?? items.length}`;
      const createdAt =
        typeof row.createdAt === 'number' && Number.isFinite(row.createdAt)
          ? row.createdAt
          : Date.now();
      items.push({ id, uri: row.uri, createdAt });
      if (items.length >= CHAT_BG_HISTORY_MAX) break;
    }
    return items;
  } catch {
    return [];
  }
}

function notifyHistory(next: ChatBackgroundHistoryItem[]) {
  for (const listener of historyListeners) {
    listener(next);
  }
}

function notifyGlobal(next: ChatBackgroundSetting) {
  for (const listener of globalListeners) {
    listener(next);
  }
}

function notifyPerChat(conversationId: string) {
  for (const listener of perChatListeners) {
    listener(conversationId);
  }
}

async function persistHistory(next: ChatBackgroundHistoryItem[]): Promise<void> {
  cachedHistory = next.slice(0, CHAT_BG_HISTORY_MAX);
  historyHydrated = true;
  const payload = JSON.stringify(cachedHistory);
  writeWeb(HISTORY_KEY, payload);
  await AsyncStorage.setItem(HISTORY_KEY, payload);
  notifyHistory(cachedHistory);
}

function makeHistoryId(): string {
  return `bg_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

/** Добавить/поднять свой фон в историю (без смены активного). */
export async function rememberCustomChatBackground(uri: string): Promise<void> {
  if (!uri) return;
  const current = await loadChatBackgroundHistory();
  const without = current.filter((item) => item.uri !== uri);
  const next: ChatBackgroundHistoryItem[] = [
    { id: makeHistoryId(), uri, createdAt: Date.now() },
    ...without,
  ].slice(0, CHAT_BG_HISTORY_MAX);
  await persistHistory(next);
}

export function getChatBackgroundHistorySync(): ChatBackgroundHistoryItem[] {
  if (historyHydrated) return cachedHistory;
  if (Platform.OS === 'web') {
    cachedHistory = parseHistory(readWeb(HISTORY_KEY));
    historyHydrated = true;
  }
  return cachedHistory;
}

export async function loadChatBackgroundHistory(): Promise<ChatBackgroundHistoryItem[]> {
  if (!historyHydrated) {
    const fromWeb = readWeb(HISTORY_KEY);
    if (fromWeb != null) {
      cachedHistory = parseHistory(fromWeb);
    } else {
      const raw = await AsyncStorage.getItem(HISTORY_KEY);
      cachedHistory = parseHistory(raw);
    }
    historyHydrated = true;
  }

  if (cachedHistory.length === 0) {
    const active = globalHydrated ? cachedGlobal : await loadGlobalChatBackground();
    if (active.kind === 'custom' && active.uri) {
      await persistHistory([
        { id: makeHistoryId(), uri: active.uri, createdAt: Date.now() },
      ]);
    }
  }

  return cachedHistory;
}

export async function removeChatBackgroundHistoryItem(id: string): Promise<void> {
  const current = await loadChatBackgroundHistory();
  await persistHistory(current.filter((item) => item.id !== id));
}

export async function clearChatBackgroundHistory(): Promise<void> {
  await persistHistory([]);
}

export function subscribeChatBackgroundHistory(
  listener: (next: ChatBackgroundHistoryItem[]) => void,
): () => void {
  historyListeners.add(listener);
  return () => {
    historyListeners.delete(listener);
  };
}

export function getChatBackgroundPreset(id: string): ChatBackgroundPreset | undefined {
  return CHAT_BACKGROUND_PRESETS.find((preset) => preset.id === id);
}

/** Общий фон из настроек (sync). */
export function getGlobalChatBackgroundSync(): ChatBackgroundSetting {
  if (globalHydrated) return cachedGlobal;
  if (Platform.OS === 'web') {
    cachedGlobal = parseSettingRaw(readWeb(GLOBAL_KEY));
    globalHydrated = true;
  }
  return cachedGlobal;
}

/** @deprecated use getGlobalChatBackgroundSync */
export function getChatBackgroundSync(): ChatBackgroundSetting {
  return getGlobalChatBackgroundSync();
}

export async function loadGlobalChatBackground(): Promise<ChatBackgroundSetting> {
  const fromWeb = readWeb(GLOBAL_KEY);
  if (fromWeb) {
    cachedGlobal = parseSettingRaw(fromWeb);
    globalHydrated = true;
    return cachedGlobal;
  }
  const raw = await AsyncStorage.getItem(GLOBAL_KEY);
  cachedGlobal = parseSettingRaw(raw);
  globalHydrated = true;
  return cachedGlobal;
}

/** @deprecated use loadGlobalChatBackground */
export async function loadChatBackground(): Promise<ChatBackgroundSetting> {
  return loadGlobalChatBackground();
}

export async function saveGlobalChatBackground(next: ChatBackgroundSetting): Promise<void> {
  cachedGlobal = next;
  globalHydrated = true;
  const payload = JSON.stringify(next);
  writeWeb(GLOBAL_KEY, payload);
  await AsyncStorage.setItem(GLOBAL_KEY, payload);
  if (next.kind === 'custom' && next.uri) {
    await rememberCustomChatBackground(next.uri);
  }
  notifyGlobal(next);
  // Все чаты без оверрайда подхватят новый дефолт
  notifyPerChat('*');
}

/** @deprecated use saveGlobalChatBackground */
export async function saveChatBackground(next: ChatBackgroundSetting): Promise<void> {
  return saveGlobalChatBackground(next);
}

export async function resetGlobalChatBackground(): Promise<void> {
  await saveGlobalChatBackground({ kind: 'default' });
}

/** @deprecated use resetGlobalChatBackground */
export async function resetChatBackground(): Promise<void> {
  return resetGlobalChatBackground();
}

export function subscribeGlobalChatBackground(
  listener: (next: ChatBackgroundSetting) => void,
): () => void {
  globalListeners.add(listener);
  return () => {
    globalListeners.delete(listener);
  };
}

/** @deprecated use subscribeGlobalChatBackground */
export function subscribeChatBackground(
  listener: (next: ChatBackgroundSetting) => void,
): () => void {
  return subscribeGlobalChatBackground(listener);
}

async function hydratePerChat(): Promise<Record<string, ChatBackgroundSetting>> {
  if (perChatHydrated) return cachedPerChat;
  const fromWeb = readWeb(PER_CHAT_KEY);
  if (fromWeb != null) {
    cachedPerChat = parsePerChatMap(fromWeb);
  } else {
    const raw = await AsyncStorage.getItem(PER_CHAT_KEY);
    cachedPerChat = parsePerChatMap(raw);
  }
  perChatHydrated = true;
  return cachedPerChat;
}

async function persistPerChat(): Promise<void> {
  const payload = JSON.stringify(cachedPerChat);
  writeWeb(PER_CHAT_KEY, payload);
  await AsyncStorage.setItem(PER_CHAT_KEY, payload);
}

/** Оверрайд конкретного чата или null (= наследовать общий). */
export async function loadConversationChatBackgroundOverride(
  conversationId: string,
): Promise<ChatBackgroundSetting | null> {
  if (!conversationId) return null;
  const map = await hydratePerChat();
  return map[conversationId] ?? null;
}

export function getConversationChatBackgroundOverrideSync(
  conversationId: string,
): ChatBackgroundSetting | null {
  if (!conversationId) return null;
  if (!perChatHydrated && Platform.OS === 'web') {
    cachedPerChat = parsePerChatMap(readWeb(PER_CHAT_KEY));
    perChatHydrated = true;
  }
  return cachedPerChat[conversationId] ?? null;
}

/** Итоговый фон для чата: оверрайд или общий из настроек. */
export async function resolveChatBackground(
  conversationId?: string | null,
): Promise<ChatBackgroundSetting> {
  const global = await loadGlobalChatBackground();
  if (!conversationId) return global;
  const override = await loadConversationChatBackgroundOverride(conversationId);
  return override ?? global;
}

export function resolveChatBackgroundSync(conversationId?: string | null): ChatBackgroundSetting {
  const global = getGlobalChatBackgroundSync();
  if (!conversationId) return global;
  const override = getConversationChatBackgroundOverrideSync(conversationId);
  return override ?? global;
}

export async function saveConversationChatBackground(
  conversationId: string,
  next: ChatBackgroundSetting,
): Promise<void> {
  if (!conversationId) {
    await saveGlobalChatBackground(next);
    return;
  }
  await hydratePerChat();
  cachedPerChat = { ...cachedPerChat, [conversationId]: next };
  await persistPerChat();
  // Только локальные data URI — CDN-URL от собеседника в «Мои» не кладём.
  if (next.kind === 'custom' && next.uri.startsWith('data:')) {
    await rememberCustomChatBackground(next.uri);
  }
  notifyPerChat(conversationId);
}

/** Убрать оверрайд чата → снова общий фон из настроек. */
export async function clearConversationChatBackground(
  conversationId: string,
): Promise<void> {
  if (!conversationId) {
    await resetGlobalChatBackground();
    return;
  }
  await hydratePerChat();
  if (!(conversationId in cachedPerChat)) return;
  const { [conversationId]: _removed, ...rest } = cachedPerChat;
  cachedPerChat = rest;
  await persistPerChat();
  notifyPerChat(conversationId);
}

export function subscribeConversationChatBackground(
  listener: (conversationId: string) => void,
): () => void {
  perChatListeners.add(listener);
  return () => {
    perChatListeners.delete(listener);
  };
}

export function resolveChatBackgroundDimmer(
  setting: ChatBackgroundSetting,
  isDark: boolean,
): number {
  if (setting.kind === 'default') return 0;
  if (setting.kind === 'preset') {
    const preset = getChatBackgroundPreset(setting.presetId);
    if (!preset) return 0.35;
    if (isDark && preset.darkDimmer != null) return preset.darkDimmer;
    return preset.dimmer;
  }
  return isDark ? 0.48 : 0.36;
}

async function uriToPersistentDataUri(uri: string): Promise<string> {
  if (uri.startsWith('data:')) return uri;
  if (Platform.OS !== 'web' || typeof fetch === 'undefined') {
    return uri;
  }
  const response = await fetch(uri);
  const blob = await response.blob();
  if (blob.size > MAX_CUSTOM_BYTES) {
    throw new Error(`Файл слишком большой (максимум ${CHAT_BG_MAX_UPLOAD_MB} МБ)`);
  }
  return await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('Не удалось прочитать изображение'));
    reader.readAsDataURL(blob);
  });
}

/** Persist editor/upload result (data URI as-is, otherwise convert). */
export async function persistChatBackgroundUri(uri: string): Promise<string> {
  if (uri.startsWith('data:')) {
    if (uri.length > MAX_CUSTOM_BYTES * 1.4) {
      throw new Error(`Файл слишком большой (максимум ${CHAT_BG_MAX_UPLOAD_MB} МБ)`);
    }
    return uri;
  }
  return uriToPersistentDataUri(uri);
}

/** Сжимает в WebP (fallback JPEG) и возвращает URI для локального хранения. */
export async function prepareChatBackgroundImage(uri: string): Promise<string> {
  try {
    const compressed = await manipulateAsync(
      uri,
      [{ resize: { width: MAX_CUSTOM_EDGE } }],
      { compress: WEBP_QUALITY, format: SaveFormat.WEBP },
    );
    return uriToPersistentDataUri(compressed.uri);
  } catch {
    const compressed = await manipulateAsync(
      uri,
      [{ resize: { width: MAX_CUSTOM_EDGE } }],
      { compress: WEBP_QUALITY, format: SaveFormat.JPEG },
    );
    return uriToPersistentDataUri(compressed.uri);
  }
}

export function isAllowedChatBackgroundMime(mime: string | undefined | null): boolean {
  if (!mime) return false;
  const normalized = mime.toLowerCase();
  return (CHAT_BG_ACCEPT as readonly string[]).includes(normalized);
}

export function settingsEqual(
  a: ChatBackgroundSetting,
  b: ChatBackgroundSetting,
): boolean {
  if (a.kind !== b.kind) return false;
  if (a.kind === 'preset' && b.kind === 'preset') return a.presetId === b.presetId;
  if (a.kind === 'custom' && b.kind === 'custom') return a.uri === b.uri;
  return true;
}

/** Map shared conversation wallpaper from API into local setting. */
export function chatBackgroundFromShared(shared: {
  kind: 'default' | 'preset' | 'custom';
  presetId?: string | null;
  url?: string | null;
} | null | undefined): ChatBackgroundSetting | null {
  if (!shared) return null;
  if (shared.kind === 'default') return { kind: 'default' };
  if (shared.kind === 'preset' && shared.presetId) {
    return { kind: 'preset', presetId: shared.presetId };
  }
  if (shared.kind === 'custom' && shared.url) {
    return { kind: 'custom', uri: shared.url };
  }
  return null;
}

/** Apply shared wallpaper from server into local per-chat override. */
export async function applySharedConversationBackground(
  conversationId: string,
  shared: {
    kind: 'default' | 'preset' | 'custom';
    presetId?: string | null;
    url?: string | null;
  } | null | undefined,
): Promise<void> {
  if (!conversationId) return;
  if (shared == null) {
    const current = await loadConversationChatBackgroundOverride(conversationId);
    if (current != null) {
      await clearConversationChatBackground(conversationId);
    }
    return;
  }
  const mapped = chatBackgroundFromShared(shared);
  if (!mapped) return;
  const current = await loadConversationChatBackgroundOverride(conversationId);
  if (current && settingsEqual(current, mapped)) return;
  await saveConversationChatBackground(conversationId, mapped);
}
