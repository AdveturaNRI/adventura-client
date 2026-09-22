import { StyleSheet, View } from 'react-native';

import { Button } from '@/components/ui';
import { Spacing, type ThemeColors } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';
import { useThemedStyles } from '@/hooks/use-themed-styles';
import {
  isOauthWebAvailable,
  useOauthPublicConfig,
} from '@/services/auth/oauth-web';

function createStyles(_colors: ThemeColors) {
  return StyleSheet.create({
    root: {
      gap: Spacing.sm,
    },
  });
}

type OauthButtonsProps = {
  disabled?: boolean;
  onSuccess?: () => void;
};

export function OauthButtons({ disabled, onSuccess }: OauthButtonsProps) {
  const { signInWithVk, signInWithYandex } = useAuth();
  const styles = useThemedStyles(createStyles);
  const { vkAppId, yandexClientId, loaded } = useOauthPublicConfig();
  const web = isOauthWebAvailable();
  const showVk = web && Boolean(vkAppId);
  const showYandex = web && Boolean(yandexClientId);

  if (!loaded || (!showVk && !showYandex)) {
    return null;
  }

  return (
    <View style={styles.root}>
      {showVk ? (
        <Button
          variant="outline"
          label="Войти через VK ID"
          disabled={disabled}
          onPress={async () => {
            const ok = await signInWithVk();
            if (ok) onSuccess?.();
          }}
        />
      ) : null}
      {showYandex ? (
        <Button
          variant="outline"
          label="Войти через Яндекс ID"
          disabled={disabled}
          onPress={async () => {
            const ok = await signInWithYandex();
            if (ok) onSuccess?.();
          }}
        />
      ) : null}
    </View>
  );
}
