import { useRouter } from 'expo-router';
import { useEffect } from 'react';
import { Platform } from 'react-native';

import { getElectronBridge } from '@/services/desktop/electronBridge';

/** IPC navigate from Electron OS notification click → expo-router. */
export function DesktopBridge() {
  const router = useRouter();

  useEffect(() => {
    if (Platform.OS !== 'web') {
      return;
    }
    const bridge = getElectronBridge();
    if (!bridge?.onNavigate) {
      return;
    }
    return bridge.onNavigate((url) => {
      if (!url.startsWith('/')) {
        return;
      }
      router.push(url as never);
    });
  }, [router]);

  return null;
}
