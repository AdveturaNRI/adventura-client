import { useEffect } from 'react';
import { Platform, Text, View } from 'react-native';

import { YANDEX_OAUTH_MESSAGE } from '@/services/auth/oauth-web';

/**
 * Popup callback for Yandex OAuth implicit flow.
 * Reads #access_token=... and posts it to opener.
 */
export default function YandexOAuthCallbackScreen() {
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') {
      return;
    }

    const hash = window.location.hash.replace(/^#/, '');
    const params = new URLSearchParams(hash);
    const accessToken = params.get('access_token');
    const error = params.get('error_description') || params.get('error');

    if (window.opener) {
      window.opener.postMessage(
        {
          type: YANDEX_OAUTH_MESSAGE,
          accessToken: accessToken || undefined,
          error: error || (!accessToken ? 'Нет access_token' : undefined),
        },
        window.location.origin,
      );
      window.close();
    }
  }, []);

  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
      <Text>Завершаем вход через Яндекс…</Text>
    </View>
  );
}
