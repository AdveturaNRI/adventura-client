import { Pressable, StyleSheet, Text, View, ViewStyle } from 'react-native';

import { FontSize, Radius, Sizes, Spacing, type ThemeColors } from '@/constants/theme';
import { useThemedStyles } from '@/hooks/use-themed-styles';

type SocialProvider = 'vk' | 'yandex';

type SocialButtonProps = {
  provider: SocialProvider;
  onPress?: () => void;
  style?: ViewStyle;
};

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    base: {
      flex: 1,
      minHeight: Sizes.controlHeight,
      borderRadius: Radius.pill,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.borderLight,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: Spacing.md,
    },
    pressed: {
      opacity: 0.85,
    },
    logoRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.sm,
    },
    vkIcon: {
      width: 22,
      height: 22,
      borderRadius: 5,
      backgroundColor: '#0077FF',
      alignItems: 'center',
      justifyContent: 'center',
    },
    vkIconText: {
      color: colors.onPrimary,
      fontSize: 10,
      fontWeight: '700',
    },
    vkText: {
      fontSize: FontSize.button,
      color: colors.text,
      fontWeight: '600',
    },
    yandexText: {
      fontSize: FontSize.button,
      fontWeight: '600',
    },
    yandexAccent: {
      color: '#FC3F1D',
    },
    yandexRest: {
      color: colors.text,
    },
  });
}

export function SocialButton({ provider, onPress, style }: SocialButtonProps) {
  const styles = useThemedStyles(createStyles);

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.base, pressed && styles.pressed, style]}>
      {provider === 'vk' ? <VkLogo styles={styles} /> : <YandexLogo styles={styles} />}
    </Pressable>
  );
}

function VkLogo({ styles }: { styles: ReturnType<typeof createStyles> }) {
  return (
    <View style={styles.logoRow}>
      <View style={styles.vkIcon}>
        <Text style={styles.vkIconText}>vk</Text>
      </View>
      <Text style={styles.vkText}>вконтакте</Text>
    </View>
  );
}

function YandexLogo({ styles }: { styles: ReturnType<typeof createStyles> }) {
  return (
    <Text style={styles.yandexText}>
      <Text style={styles.yandexAccent}>Я</Text>
      <Text style={styles.yandexRest}>ндекс</Text>
    </Text>
  );
}
