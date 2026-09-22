import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { AuthorPostCard } from '@/components/authors/AuthorPostCard';
import type { AuthorPost } from '@/data/authors/types';
import { FontSize, type ThemeColors } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useThemedStyles } from '@/hooks/use-themed-styles';

type AuthorCabinetPostCardProps = {
  post: AuthorPost;
  authorId: string;
  onToggleLike?: (postId: string) => void;
  onEdit: (post: AuthorPost) => void;
  onDelete: (post: AuthorPost) => void;
};

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    root: {
      width: '100%',
      gap: 8,
    },
    actions: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 6,
    },
    action: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 4,
      minHeight: 28,
      paddingHorizontal: 10,
      borderRadius: 999,
      borderWidth: 1,
    },
    actionEdit: {
      borderColor: 'rgba(21, 122, 254, 0.3)',
      backgroundColor: 'rgba(21, 122, 254, 0.1)',
    },
    actionDelete: {
      borderColor: 'rgba(255, 59, 48, 0.22)',
      backgroundColor: 'rgba(255, 59, 48, 0.06)',
    },
    actionLabel: {
      fontSize: 12,
      fontWeight: '600',
      color: colors.primary,
    },
    actionLabelDelete: {
      color: colors.destructive,
    },
  });
}

export function AuthorCabinetPostCard({
  post,
  authorId,
  onToggleLike,
  onEdit,
  onDelete,
}: AuthorCabinetPostCardProps) {
  const colors = useTheme();
  const styles = useThemedStyles(createStyles);

  return (
    <View style={styles.root}>
      <AuthorPostCard post={post} authorId={authorId} onToggleLike={onToggleLike} />
      <View style={styles.actions}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Изменить публикацию"
          onPress={() => onEdit(post)}
          style={({ pressed }) => [
            styles.action,
            styles.actionEdit,
            pressed && { opacity: 0.88 },
          ]}>
          <Ionicons name="pencil-outline" size={13} color={colors.primary} />
          <Text style={styles.actionLabel}>Изменить</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Удалить публикацию"
          onPress={() => onDelete(post)}
          style={({ pressed }) => [
            styles.action,
            styles.actionDelete,
            pressed && { opacity: 0.88 },
          ]}>
          <Ionicons name="trash-outline" size={13} color={colors.destructive} />
          <Text style={[styles.actionLabel, styles.actionLabelDelete]}>Удалить</Text>
        </Pressable>
      </View>
    </View>
  );
}
