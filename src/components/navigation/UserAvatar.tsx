import { memo } from 'react';
import { Image } from 'expo-image';
import { StyleSheet, Text, View } from 'react-native';

import { AvatarFrame } from '@/components/rewards/AvatarFrame';
import { FontSize, type ThemeColors } from '@/constants/theme';
import { useThemedStyles } from '@/hooks/use-themed-styles';
import { isGifImage } from '@/utils/image-format';
import { sanitizeBadges, type AvatarFrameId, type RewardBadgeType } from '@/data/rewards/catalog';

type UserAvatarProps = {
  nickname: string;
  avatarUrl?: string | null;
  size?: number;
  badges?: RewardBadgeType[] | null;
  frameId?: AvatarFrameId | string | null;
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

function isEphemeralUri(uri: string) {
  return (
    uri.startsWith('blob:') ||
    uri.startsWith('data:') ||
    uri.startsWith('file:') ||
    uri.startsWith('content:')
  );
}

function UserAvatarComponent({
  nickname,
  avatarUrl,
  size = 36,
  badges,
  frameId,
}: UserAvatarProps) {
  const initial = [...nickname.trim()][0]?.toUpperCase() ?? '?';
  const styles = useThemedStyles((colors) => createStyles(colors, size));
  const resolvedBadges = sanitizeBadges(badges);
  const uri = avatarUrl?.trim() || null;
  const cachePolicy = uri && !isEphemeralUri(uri) ? 'memory-disk' : 'none';
  const recycleKey = uri ? uri.split('?')[0] : undefined;

  const inner = (
    <View style={styles.avatar} accessibilityElementsHidden importantForAccessibility="no">
      {uri ? (
        <Image
          source={{ uri }}
          style={styles.image}
          contentFit="cover"
          cachePolicy={cachePolicy}
          recyclingKey={recycleKey}
          transition={220}
          autoplay={isGifImage(uri)}
        />
      ) : (
        <Text style={styles.initial}>{initial}</Text>
      )}
    </View>
  );

  return (
    <AvatarFrame size={size} badges={resolvedBadges} frameId={frameId as AvatarFrameId | null | undefined}>
      {inner}
    </AvatarFrame>
  );
}

function propsEqual(prev: UserAvatarProps, next: UserAvatarProps) {
  if (
    prev.nickname !== next.nickname ||
    prev.avatarUrl !== next.avatarUrl ||
    prev.size !== next.size ||
    prev.frameId !== next.frameId
  ) {
    return false;
  }
  const prevBadges = prev.badges ?? null;
  const nextBadges = next.badges ?? null;
  if (prevBadges === nextBadges) {
    return true;
  }
  if (!prevBadges || !nextBadges || prevBadges.length !== nextBadges.length) {
    return !prevBadges && !nextBadges;
  }
  return prevBadges.every((badge, index) => badge === nextBadges[index]);
}

export const UserAvatar = memo(UserAvatarComponent, propsEqual);
