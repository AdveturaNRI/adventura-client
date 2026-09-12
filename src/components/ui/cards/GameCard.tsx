import { Image, StyleSheet, Text, View } from 'react-native';

import { Badge } from '../feedback/Badge';
import { SwipeBlock, type SwipeAction } from '../swipe/SwipeBlock';
import { FontSize, Radius, Spacing, type ThemeColors } from '@/constants/theme';
import { useThemedStyles } from '@/hooks/use-themed-styles';

export type GameCardSwipeConfig = {
  leftAction?: SwipeAction;
  rightAction?: SwipeAction;
  actionWidth?: number;
  dismissible?: boolean;
  resetKey?: string | number;
  onDismiss?: (direction: 'left' | 'right') => void;
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
};

export type GameCardProps = {
  title: string;
  description: string;
  imageUrl?: string;
  date: string;
  time: string;
  format: string;
  system: string;
  level: string;
  price: string;
  players: string;
  swipe?: GameCardSwipeConfig;
};

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    card: {
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      overflow: 'hidden',
    },
    cardEmbedded: {
      borderWidth: 0,
      borderRadius: 0,
    },
    coverWrap: {
      height: 180,
      backgroundColor: colors.placeholderAlt,
    },
    cover: {
      width: '100%',
      height: '100%',
    },
    coverPlaceholder: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },
    coverPlaceholderText: {
      color: colors.textMuted,
      fontSize: FontSize.label,
    },
    dateBadge: {
      position: 'absolute',
      left: Spacing.sm,
      bottom: Spacing.sm,
      backgroundColor: colors.overlay,
      borderRadius: Radius.pill,
      paddingHorizontal: Spacing.sm,
      paddingVertical: Spacing.xs,
    },
    dateText: {
      fontSize: FontSize.caption,
      color: colors.textSecondary,
    },
    body: {
      padding: Spacing.md,
      gap: Spacing.sm,
    },
    titleRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      gap: Spacing.sm,
    },
    title: {
      flex: 1,
      fontSize: FontSize.button,
      fontWeight: '600',
      color: colors.text,
    },
    price: {
      fontSize: FontSize.button,
      fontWeight: '700',
      color: colors.text,
    },
    tagsRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: Spacing.sm,
    },
    description: {
      fontSize: FontSize.caption,
      color: colors.textSecondary,
      lineHeight: FontSize.caption * 1.5,
    },
    playersRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingTop: Spacing.xs,
    },
    avatars: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    avatar: {
      width: 28,
      height: 28,
      borderRadius: 14,
      backgroundColor: colors.avatar,
      borderWidth: 2,
      borderColor: colors.surface,
    },
    avatarOverlap: {
      marginLeft: -8,
    },
    players: {
      fontSize: FontSize.caption,
      color: colors.textMuted,
      fontWeight: '500',
    },
  });
}

export function GameCard({
  title,
  description,
  imageUrl,
  date,
  time,
  format,
  system,
  level,
  price,
  players,
  swipe,
}: GameCardProps) {
  const styles = useThemedStyles(createStyles);

  const card = (
    <View style={[styles.card, swipe && styles.cardEmbedded]}>
      <View style={styles.coverWrap}>
        {imageUrl ? (
          <Image source={{ uri: imageUrl }} style={styles.cover} />
        ) : (
          <View style={styles.coverPlaceholder}>
            <Text style={styles.coverPlaceholderText}>Обложка игры</Text>
          </View>
        )}

        <View style={styles.dateBadge}>
          <Text style={styles.dateText}>
            {date} · {time}
          </Text>
        </View>
      </View>

      <View style={styles.body}>
        <View style={styles.titleRow}>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.price}>{price}</Text>
        </View>

        <View style={styles.tagsRow}>
          <Badge label={format} variant="filter" />
          <Badge label={system} variant="filter" />
          <Badge label={level} variant="filter" />
        </View>

        <Text style={styles.description}>{description}</Text>

        <View style={styles.playersRow}>
          <View style={styles.avatars}>
            {[0, 1, 2].map((index) => (
              <View key={index} style={[styles.avatar, index > 0 && styles.avatarOverlap]} />
            ))}
          </View>
          <Text style={styles.players}>{players}</Text>
        </View>
      </View>
    </View>
  );

  if (!swipe) {
    return card;
  }

  return (
    <SwipeBlock
      variant="corner"
      dismissible={swipe.dismissible}
      resetKey={swipe.resetKey}
      onDismiss={swipe.onDismiss}
      leftAction={swipe.leftAction}
      rightAction={swipe.rightAction}
      actionWidth={swipe.actionWidth ?? 108}
      onSwipeLeft={swipe.onSwipeLeft}
      onSwipeRight={swipe.onSwipeRight}>
      {card}
    </SwipeBlock>
  );
}
