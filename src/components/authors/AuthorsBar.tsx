import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { FadeInImage } from '@/components/ui/media/FadeInImage';
import { AUTHOR_CATEGORY_LABELS } from '@/data/authors/labels';
import { useAuthors } from '@/context/AuthorsContext';
import { FontSize, Spacing, type ThemeColors } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useThemedStyles } from '@/hooks/use-themed-styles';
import { formatAuthorPostDate } from '@/utils/authors-format';

type AuthorsBarProps = {
  title?: string;
  /** @deprecated больше не нужен — берём свежие посты из контекста */
  authors?: unknown;
};

const THUMB = 56;
const CARD_WIDTH = 260;

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    root: {
      gap: Spacing.sm,
    },
    headerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: Spacing.sm,
    },
    title: {
      fontSize: FontSize.button,
      fontWeight: '700',
      color: colors.text,
    },
    allLink: {
      fontSize: FontSize.caption,
      fontWeight: '600',
      color: colors.primary,
    },
    list: {
      paddingVertical: 2,
      gap: Spacing.sm,
    },
    card: {
      width: CARD_WIDTH,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      padding: 8,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.borderLight,
      backgroundColor: colors.surface,
    },
    thumb: {
      width: THUMB,
      height: THUMB,
      borderRadius: 10,
      overflow: 'hidden',
      backgroundColor: colors.surfaceMuted,
      alignItems: 'center',
      justifyContent: 'center',
    },
    thumbImage: {
      width: '100%',
      height: '100%',
    },
    body: {
      flex: 1,
      minWidth: 0,
      gap: 2,
    },
    meta: {
      fontSize: 11,
      fontWeight: '600',
      color: colors.primary,
    },
    postTitle: {
      fontSize: FontSize.caption,
      fontWeight: '700',
      color: colors.text,
      lineHeight: FontSize.caption * 1.25,
    },
    footerMetaText: {
      fontSize: 11,
      color: colors.textMuted,
    },
    pressed: {
      opacity: 0.88,
    },
  });
}

export function AuthorsBar({ title = 'Последние публикации' }: AuthorsBarProps) {
  const router = useRouter();
  const colors = useTheme();
  const styles = useThemedStyles(createStyles);
  const { posts, getAuthorById, isLoading } = useAuthors();

  const recentPosts = useMemo(
    () =>
      [...posts]
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .slice(0, 12),
    [posts],
  );

  if (isLoading || recentPosts.length === 0) {
    return null;
  }

  return (
    <View style={styles.root}>
      <View style={styles.headerRow}>
        <Text style={styles.title}>{title}</Text>
        <Pressable
          accessibilityRole="link"
          accessibilityLabel="Все публикации"
          onPress={() => router.push('/authors')}
          style={({ pressed }) => [pressed && styles.pressed]}>
          <Text style={styles.allLink}>Все</Text>
        </Pressable>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.list}>
        {recentPosts.map((post) => {
          const author = getAuthorById(post.authorId);
          const cover = post.images[0];

          return (
            <Pressable
              key={post.id}
              accessibilityRole="button"
              accessibilityLabel={post.title}
              onPress={() => router.push(`/authors/${post.authorId}/posts/${post.id}`)}
              style={({ pressed }) => [styles.card, pressed && styles.pressed]}>
              <View style={styles.thumb}>
                {cover ? (
                  <FadeInImage uri={cover} style={styles.thumbImage} contentFit="cover" />
                ) : (
                  <Ionicons name="newspaper-outline" size={20} color={colors.primary} />
                )}
              </View>

              <View style={styles.body}>
                <Text style={styles.meta} numberOfLines={1}>
                  {AUTHOR_CATEGORY_LABELS[post.category]}
                </Text>
                <Text style={styles.postTitle} numberOfLines={2}>
                  {post.title}
                </Text>
                <Text style={styles.footerMetaText} numberOfLines={1}>
                  {author?.name ?? 'Автор'} · {formatAuthorPostDate(post.createdAt)}
                </Text>
              </View>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}
