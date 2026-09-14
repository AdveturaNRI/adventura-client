import { Ionicons } from '@expo/vector-icons';
import { type Href, useNavigation, usePathname, useRouter } from 'expo-router';
import { Pressable } from 'react-native';

import { createMobileHeaderButtonStyles } from '@/components/navigation/mobile-header-button.styles';
import { navigateBack } from '@/components/navigation/navigate-back';
import { useTheme } from '@/hooks/use-theme';
import { useThemedStyles } from '@/hooks/use-themed-styles';

type MobileBackButtonProps = {
  accessibilityLabel?: string;
  onPress?: () => void;
  /** Только если истории нет (deep link). Иначе берётся из текущего пути. */
  fallbackHref?: Href;
  /**
   * Явный адрес «назад» для кросс-флоу (например manage → chat).
   * Нужен, потому что уход в таб сбрасывает стек с games-manage,
   * и router.back() восстанавливает нижний таб (часто странники).
   */
  backHref?: Href;
};

export function MobileBackButton({
  accessibilityLabel = 'Назад',
  onPress,
  fallbackHref,
  backHref,
}: MobileBackButtonProps) {
  const router = useRouter();
  const pathname = usePathname();
  const navigation = useNavigation();
  const colors = useTheme();
  const styles = useThemedStyles(createMobileHeaderButtonStyles);

  const handlePress = () => {
    if (onPress) {
      onPress();
      return;
    }

    if (backHref) {
      router.replace(backHref);
      return;
    }

    // Только stack: у tab-навигатора canGoBack() = «не на первом табе»
    // и goBack() прыгает на wanderers, а не по истории перехода.
    const navState = navigation.getState();
    const canPopStack = Boolean(navigation.canGoBack() && navState?.type === 'stack');

    navigateBack({
      router,
      pathname,
      fallbackHref,
      navigationCanGoBack: canPopStack,
      navigationGoBack: () => navigation.goBack(),
    });
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
