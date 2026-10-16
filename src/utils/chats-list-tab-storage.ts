import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

export type ChatsListTab = 'all' | 'favorites' | 'groups' | 'games';

const KEY = '@adventura/chats-list-tab';
const DEFAULT_TAB: ChatsListTab = 'all';

function isChatsListTab(value: string | null): value is ChatsListTab {
  return value === 'all' || value === 'favorites' || value === 'groups' || value === 'games';
}

export function getChatsListTabSync(): ChatsListTab {
  if (Platform.OS !== 'web' || typeof localStorage === 'undefined') {
    return DEFAULT_TAB;
  }
  const raw = localStorage.getItem(KEY);
  return isChatsListTab(raw) ? raw : DEFAULT_TAB;
}

export async function loadChatsListTab(): Promise<ChatsListTab> {
  const raw = await AsyncStorage.getItem(KEY);
  return isChatsListTab(raw) ? raw : DEFAULT_TAB;
}

export async function saveChatsListTab(tab: ChatsListTab): Promise<void> {
  const next = isChatsListTab(tab) ? tab : DEFAULT_TAB;
  await AsyncStorage.setItem(KEY, next);
  if (Platform.OS === 'web' && typeof localStorage !== 'undefined') {
    localStorage.setItem(KEY, next);
  }
}
