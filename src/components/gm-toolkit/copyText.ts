import { Platform, Share } from 'react-native';

export async function copyTextToClipboard(text: string): Promise<void> {
  const value = text.trim();
  if (!value) {
    throw new Error('Нечего копировать');
  }

  if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(value);
    return;
  }

  await Share.share({ message: value });
}
