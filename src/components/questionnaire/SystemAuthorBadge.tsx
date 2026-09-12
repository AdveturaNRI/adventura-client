import { UserAvatar } from '@/components/navigation/UserAvatar';
import { FontSize, Spacing, type ThemeColors } from '@/constants/theme';
import { useThemedStyles } from '@/hooks/use-themed-styles';
import type { UserGameSystemAuthor } from '@/services/api/types';
import { StyleSheet, Text, View } from 'react-native';

type SystemAuthorBadgeProps = {
  author?: UserGameSystemAuthor | null;
  size?: number;
  compact?: boolean;
};

function createStyles(colors: ThemeColors, compact: boolean) {
  return StyleSheet.create({
    container: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: compact ? 4 : Spacing.xs,
      flexShrink: 1,
      minWidth: 0,
      maxWidth: compact ? 112 : undefined,
    },
    nickname: {
      fontSize: compact ? 11 : FontSize.caption,
      color: colors.textMuted,
      flexShrink: 1,
    },
  });
}

export function SystemAuthorBadge({
  author,
  size = 20,
  compact = false,
}: SystemAuthorBadgeProps) {
  const styles = useThemedStyles((colors) => createStyles(colors, compact));

  if (!author?.nickname) {
    return null;
  }

  return (
    <View style={styles.container}>
      <UserAvatar nickname={author.nickname} avatarUrl={author.avatarUrl} size={size} />
      <Text style={styles.nickname} numberOfLines={1}>
        {author.nickname}
      </Text>
    </View>
  );
}
