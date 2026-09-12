import { type Href, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Pressable } from 'react-native';

import { createMobileHeaderButtonStyles } from '@/components/navigation/mobile-header-button.styles';
import { MAIN_APP_ENTRY } from '@/components/ui/navigation/navbar.config';
import { useTheme } from '@/hooks/use-theme';
import { useThemedStyles } from '@/hooks/use-themed-styles';

type MobileBackButtonProps = {
  accessibilityLabel?: string;
  onPress?: () => void;
  /** Только если истории нет (deep link). По умолчанию — главный экран приложения. */
  fallbackHref?: Href;
};

export function MobileBackButton({
  accessibilityLabel = 'Назад',
  onPress,
  fallbackHref = MAIN_APP_ENTRY,
}: MobileBackButtonProps) {
  const router = useRouter();
  const colors = useTheme();
  const styles = useThemedStyles(createMobileHeaderButtonStyles);

  const handlePress = () => {
    if (onPress) {
      onPress();
      return;
    }

    if (router.canGoBack()) {
      router.back();
      return;
    }

    router.replace(fallbackHref);
  };

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={handlePress}
      hitSlop={8}
      style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}>
      <Ionicons name="chevron-back" size={22} color={colors.text} />
    </Pressable>
  );
}
