import { Ionicons } from '@expo/vector-icons';
import { Pressable } from 'react-native';

import { useMobileAppMenu } from '@/components/navigation/MobileAppMenuContext';
import { createMobileHeaderButtonStyles } from '@/components/navigation/mobile-header-button.styles';
import { useTheme } from '@/hooks/use-theme';
import { useThemedStyles } from '@/hooks/use-themed-styles';

type MobileMenuButtonProps = {
  accessibilityLabel?: string;
};

export function MobileMenuButton({ accessibilityLabel = 'Открыть меню' }: MobileMenuButtonProps) {
  const { toggle } = useMobileAppMenu();
  const colors = useTheme();
  const styles = useThemedStyles(createMobileHeaderButtonStyles);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={toggle}
      hitSlop={8}
      style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}>
      <Ionicons name="grid-outline" size={20} color={colors.text} />
    </Pressable>
  );
}
