import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { AUTHOR_POST_COVER_ASPECT } from '@/components/authors/AuthorPostCard';
import { FadeInImage } from '@/components/ui/media/FadeInImage';
import { AUTHOR_CATEGORY_LABELS } from '@/data/authors/labels';
import { useAuthors } from '@/context/AuthorsContext';
import { FontSize, Spacing, type ThemeColors } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useThemedStyles } from '@/hooks/use-themed-styles';
import { authorContentExcerpt, formatAuthorPostDate } from '@/utils/authors-format';

type AuthorsBarProps = {
  title?: string;
  /** @deprecated больше не нужен — берём свежие посты из контекста */
  authors?: unknown;
};

const CARD_WIDTH = 168;

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
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.borderLight,
      backgroundColor: colors.surface,
      overflow: 'hidden',
    },
    cover: {
      width: '100%',
      aspectRatio: AUTHOR_POST_COVER_ASPECT,
      backgroundColor: colors.surfaceMuted,
      overflow: 'hidden',
    },
    coverImage: {
      ...StyleSheet.absoluteFillObject,
    },
    newsCover: {
      width: '100%',
      aspectRatio: AUTHOR_POST_COVER_ASPECT,
      padding: 12,
      gap: 6,
      justifyContent: 'center',
      backgroundColor: 'rgba(21, 122, 254, 0.1)',
    },
    newsExcerpt: {
      fontSize: 11,
      fontWeight: '500',
      color: colors.textSecondary,
      lineHeight: 15,
    },
    body: {
      gap: 4,
      paddingHorizontal: 10,
      paddingTop: 8,
      paddingBottom: 10,
    },
    postTitle: {
      fontSize: FontSize.caption,
      fontWeight: '700',
      color: colors.text,
      lineHeight: FontSize.caption * 1.3,
    },
    meta: {
      fontSize: 11,
      fontWeight: '600',
      color: colors.primary,
    },
    footerMeta: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      marginTop: 2,
    },
    footerMetaText: {
      flex: 1,
      fontSize: 11,
      color: colors.textMuted,
    },
    pressed: {
      opacity: 0.88,
    },
  });
}

export function AuthorsBar({ title = 'Публикации' }: AuthorsBarProps) {
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
          const excerpt = authorContentExcerpt(post.content, 70);

          return (
            <Pressable
              key={post.id}
              accessibilityRole="button"
              accessibilityLabel={post.title}
              onPress={() => router.push(`/authors/${post.authorId}/posts/${post.id}`)}
              style={({ pressed }) => [styles.card, pressed && styles.pressed]}>
              {cover ? (
                <View style={styles.cover}>
                  <FadeInImage uri={cover} style={styles.coverImage} contentFit="cover" />
                </View>
              ) : (
                <View style={styles.newsCover}>
                  {excerpt ? (
                    <Text style={styles.newsExcerpt} numberOfLines={4}>
                      {excerpt}
                    </Text>
                  ) : (
                    <Ionicons name="newspaper-outline" size={22} color={colors.primary} />
                  )}
                </View>
              )}

              <View style={styles.body}>
                <Text style={styles.meta} numberOfLines={1}>
                  {AUTHOR_CATEGORY_LABELS[post.category]}
                </Text>
                <Text style={styles.postTitle} numberOfLines={2}>
                  {post.title}
                </Text>
                <View style={styles.footerMeta}>
                  <Text style={styles.footerMetaText} numberOfLines={1}>
                    {author?.name ?? 'Автор'} · {formatAuthorPostDate(post.createdAt)}
                  </Text>
                </View>
              </View>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}
