import { StyleSheet, View } from 'react-native';

import { SocialButton } from '@/components/ui';
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
        <SocialButton
          provider="vk"
          disabled={disabled}
          onPress={async () => {
            const ok = await signInWithVk();
            if (ok) onSuccess?.();
          }}
        />
      ) : null}
      {showYandex ? (
        <SocialButton
          provider="yandex"
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
