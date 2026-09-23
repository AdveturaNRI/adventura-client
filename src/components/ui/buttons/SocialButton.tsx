import { Pressable, StyleSheet, Text, View, type ViewStyle } from 'react-native';

import {
  VkBrandIcon,
  YandexBrandIcon,
  VK_BRAND,
  YANDEX_BRAND,
} from '@/components/auth/OauthBrandIcons';
import { FontSize, Radius, Sizes, Spacing, type ThemeColors } from '@/constants/theme';
import { useThemedStyles } from '@/hooks/use-themed-styles';

type SocialProvider = 'vk' | 'yandex';

type SocialButtonProps = {
  provider: SocialProvider;
  onPress?: () => void;
  disabled?: boolean;
  style?: ViewStyle;
  label?: string;
};

function createStyles(_colors: ThemeColors) {
  return StyleSheet.create({
    base: {
      minHeight: Sizes.controlHeight,
      borderRadius: Radius.pill,
      borderWidth: 1.5,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: Spacing.lg,
      paddingVertical: Spacing.sm,
    },
    vk: {
      borderColor: VK_BRAND,
      backgroundColor: 'rgba(0, 119, 255, 0.1)',
    },
    yandex: {
      borderColor: YANDEX_BRAND,
      backgroundColor: 'rgba(252, 63, 29, 0.1)',
    },
    pressed: {
      opacity: 0.85,
    },
    disabled: {
      opacity: 0.5,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    label: {
      fontSize: FontSize.button,
      fontWeight: '600',
    },
    vkLabel: {
      color: VK_BRAND,
    },
    yandexLabel: {
      color: YANDEX_BRAND,
    },
  });
}

export function SocialButton({
  provider,
  onPress,
  disabled = false,
  style,
  label,
}: SocialButtonProps) {
  const styles = useThemedStyles(createStyles);
  const isVk = provider === 'vk';

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label ?? (isVk ? 'Войти через VK ID' : 'Войти через Яндекс ID')}
      style={({ pressed }) => [
        styles.base,
        isVk ? styles.vk : styles.yandex,
        pressed && !disabled && styles.pressed,
        disabled && styles.disabled,
        style,
      ]}>
      <View style={styles.row}>
        {isVk ? <VkBrandIcon size={28} /> : <YandexBrandIcon size={28} />}
        <Text style={[styles.label, isVk ? styles.vkLabel : styles.yandexLabel]}>
          {label ?? (isVk ? 'Войти через VK ID' : 'Войти через Яндекс ID')}
        </Text>
      </View>
    </Pressable>
  );
}
