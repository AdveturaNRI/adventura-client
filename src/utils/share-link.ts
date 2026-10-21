import { Platform, Share } from 'react-native';

import { copyTextToClipboard } from '@/components/gm-toolkit/copyText';
import { toast } from '@/components/ui';

export function buildAppPathUrl(path: string): string {
  const normalized = path.startsWith('/') ? path : `/${path}`;
  if (Platform.OS === 'web' && typeof window !== 'undefined' && window.location?.origin) {
    return `${window.location.origin}${normalized}`;
  }
  return normalized;
}

/** Share sheet on native / Web Share API; on desktop web falls back to clipboard. */
export async function shareAppLink(input: {
  title: string;
  message: string;
  path: string;
}): Promise<void> {
  const url = buildAppPathUrl(input.path);
  const message = input.message.includes(url) ? input.message : `${input.message}\n${url}`;

  try {
    if (
      Platform.OS === 'web' &&
      typeof navigator !== 'undefined' &&
      typeof navigator.share === 'function'
    ) {
      await navigator.share({ title: input.title, text: message, url });
      return;
    }

    if (Platform.OS !== 'web') {
      await Share.share({ message, url, title: input.title });
      return;
    }

    await copyTextToClipboard(url);
    toast.success('Ссылку скопировали');
  } catch (error) {
    if (
      error &&
      typeof error === 'object' &&
      'name' in error &&
      (error as { name?: string }).name === 'AbortError'
    ) {
      return;
    }
    try {
      await copyTextToClipboard(url);
      toast.success('Ссылку скопировали');
    } catch {
      toast.error('Не удалось поделиться');
    }
  }
}
