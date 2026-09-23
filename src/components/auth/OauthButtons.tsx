import { StyleSheet, View, type ViewStyle } from 'react-native';

import { DividerLabel, SocialButton } from '@/components/ui';
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
  /** Show “или” above the buttons. Default true. */
  withDivider?: boolean;
  buttonStyle?: ViewStyle;
};

export function OauthButtons({
  disabled,
  onSuccess,
  withDivider = true,
  buttonStyle,
}: OauthButtonsProps) {
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
      {withDivider ? <DividerLabel label="или" /> : null}
      {showVk ? (
        <SocialButton
          provider="vk"
          disabled={disabled}
          style={buttonStyle}
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
          style={buttonStyle}
          onPress={async () => {
            const ok = await signInWithYandex();
            if (ok) onSuccess?.();
          }}
        />
      ) : null}
    </View>
  );
}
