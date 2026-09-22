import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = '@adventura/authors-cta-dismissed';

export async function loadAuthorsCtaDismissed(): Promise<boolean> {
  const raw = await AsyncStorage.getItem(KEY);
  return raw === '1';
}

export async function saveAuthorsCtaDismissed(dismissed: boolean): Promise<void> {
  if (dismissed) {
    await AsyncStorage.setItem(KEY, '1');
    return;
  }
  await AsyncStorage.removeItem(KEY);
}
