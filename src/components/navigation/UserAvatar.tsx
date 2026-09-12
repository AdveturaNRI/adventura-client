import { Image } from 'expo-image';
import { StyleSheet, Text, View } from 'react-native';

import { FontSize, type ThemeColors } from '@/constants/theme';
import { useThemedStyles } from '@/hooks/use-themed-styles';
import { isGifImage } from '@/utils/image-format';

type UserAvatarProps = {
  nickname: string;
  avatarUrl?: string | null;
  size?: number;
};

function createStyles(colors: ThemeColors, size: number) {
  const fontSize = Math.round(size * 0.42);

  return StyleSheet.create({
    avatar: {
      width: size,
      height: size,
      borderRadius: size / 2,
      overflow: 'hidden',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.primary,
    },
    image: {
      width: size,
      height: size,
    },
    initial: {
      fontSize,
      fontWeight: '600',
      color: colors.onPrimary,
    },
  });
}

export function UserAvatar({ nickname, avatarUrl, size = 36 }: UserAvatarProps) {
  const initial = [...nickname.trim()][0]?.toUpperCase() ?? '?';
  const styles = useThemedStyles((colors) => createStyles(colors, size));
  const isRemote = Boolean(avatarUrl?.startsWith('http'));

  return (
    <View style={styles.avatar} accessibilityElementsHidden importantForAccessibility="no">
      {avatarUrl ? (
        <Image
          key={avatarUrl}
          source={{ uri: avatarUrl }}
          style={styles.image}
          contentFit="cover"
          cachePolicy={isRemote ? 'memory-disk' : 'none'}
          recyclingKey={avatarUrl}
          autoplay={isGifImage(avatarUrl)}
        />
      ) : (
        <Text style={styles.initial}>{initial}</Text>
      )}
    </View>
  );
}
