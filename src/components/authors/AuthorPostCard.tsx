import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { CreativityCategoryBadge } from '@/components/authors/CreativityCategoryBadge';
import { AuthorPostPurchase, AuthorPostPriceBadge } from '@/components/authors/AuthorPostPurchase';
import { useIsDesktopWeb } from '@/components/navigation/DesktopThemeToggle';
import { UserAvatar } from '@/components/navigation/UserAvatar';
import { FadeInImage } from '@/components/ui/media/FadeInImage';
import type { AuthorPost } from '@/data/authors/types';
import { FontSize, type ThemeColors } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useThemedStyles } from '@/hooks/use-themed-styles';
import {
  authorContentExcerpt,
  formatAuthorPostDate,
} from '@/utils/authors-format';

type AuthorPostCardProps = {
  post: AuthorPost;
  authorId: string;
  authorName?: string;
  authorAvatar?: string;
  onToggleLike?: (postId: string) => void;
};

/** Единый кадр обложки: 1:1, горизонтальные и вертикальные кропаются через cover. */
export const AUTHOR_POST_COVER_ASPECT = 1;

function createStyles(colors: ThemeColors, singleColumn: boolean) {
  return StyleSheet.create({
    card: {
      width: '100%',
      borderRadius: singleColumn ? 16 : 18,
      overflow: 'hidden',
      borderWidth: 1,
      borderColor: colors.borderLight,
      backgroundColor: colors.surface,
    },
    cover: {
      width: '100%',
      aspectRatio: AUTHOR_POST_COVER_ASPECT,
      overflow: 'hidden',
      backgroundColor: colors.surfaceMuted,
      position: 'relative',
    },
    coverImage: {
      ...StyleSheet.absoluteFillObject,
    },
    newsBody: {
      gap: 10,
      paddingHorizontal: 14,
      paddingTop: 14,
      paddingBottom: 4,
    },
    newsMeta: {
      flexDirection: 'row',
      alignItems: 'center',
      flexWrap: 'wrap',
      gap: 8,
    },
    newsDate: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
    },
    newsDateText: {
      fontSize: 11,
      fontWeight: '600',
      color: colors.textMuted,
    },
    newsTitle: {
      fontSize: FontSize.button,
      fontWeight: '700',
      color: colors.text,
      lineHeight: FontSize.button * 1.3,
      letterSpacing: -0.2,
    },
    newsExcerpt: {
      fontSize: FontSize.caption,
      color: colors.textSecondary,
      lineHeight: FontSize.caption * 1.5,
    },
    footer: {
      gap: 8,
      paddingHorizontal: singleColumn ? 12 : 10,
      paddingTop: singleColumn ? 12 : 10,
      paddingBottom: singleColumn ? 12 : 10,
    },
    title: {
      fontSize: singleColumn ? FontSize.button : FontSize.label,
      fontWeight: '700',
      color: colors.text,
      lineHeight: (singleColumn ? FontSize.button : FontSize.label) * 1.3,
    },
    bottomRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    authorHit: {
      flex: 1,
      minWidth: 0,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    authorName: {
      flex: 1,
      minWidth: 0,
      fontSize: FontSize.caption,
      fontWeight: '600',
      color: colors.textSecondary,
    },
    stats: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      flexShrink: 0,
    },
    stat: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 3,
    },
    statText: {
      fontSize: 12,
      fontWeight: '600',
      color: colors.textMuted,
    },
  });
}

export function AuthorPostCard({
  post,
  authorId,
  authorName,
  authorAvatar,
  onToggleLike,
}: AuthorPostCardProps) {
  const router = useRouter();
  const colors = useTheme();
  const singleColumn = !useIsDesktopWeb();
  const styles = useThemedStyles((theme) => createStyles(theme, singleColumn));
  const cover = post.images[0];
  const showPriceBadge = post.isForSale && post.price != null;
  const isNewsCard = !cover;
  const excerpt = authorContentExcerpt(post.content, 150);
  const openPost = () => router.push(`/authors/${authorId}/posts/${post.id}`);

  return (
    <View style={styles.card}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={post.title}
        onPress={openPost}
        style={({ pressed }) => [pressed && { opacity: 0.94 }]}>
        {cover ? (
          <View style={styles.cover}>
            <FadeInImage uri={cover} style={styles.coverImage} contentFit="cover" />
            {showPriceBadge ? (
              <AuthorPostPriceBadge price={post.price!} currency={post.currency} />
            ) : null}
          </View>
        ) : (
          <View style={styles.newsBody}>
            <View style={styles.newsMeta}>
              <CreativityCategoryBadge category={post.category} size="sm" />
              <View style={styles.newsDate}>
                <Ionicons name="calendar-outline" size={12} color={colors.textMuted} />
                <Text style={styles.newsDateText}>{formatAuthorPostDate(post.createdAt)}</Text>
              </View>
            </View>
            <Text style={styles.newsTitle} numberOfLines={3}>
              {post.title}
            </Text>
            {excerpt ? (
              <Text style={styles.newsExcerpt} numberOfLines={4}>
                {excerpt}
              </Text>
            ) : null}
            {showPriceBadge ? (
              <AuthorPostPriceBadge price={post.price!} currency={post.currency} />
            ) : null}
          </View>
        )}
      </Pressable>

      <View style={styles.footer}>
        {cover ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={post.title}
            onPress={openPost}
            style={{ gap: 6 }}>
            <Text style={styles.title} numberOfLines={2}>
              {post.title}
            </Text>
            {excerpt ? (
              <Text style={styles.newsExcerpt} numberOfLines={3}>
                {excerpt}
              </Text>
            ) : null}
          </Pressable>
        ) : null}

        {post.isForSale ? <AuthorPostPurchase post={post} compact /> : null}

        <View style={styles.bottomRow}>
          {authorName ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={authorName}
              onPress={() => router.push(`/authors/${authorId}`)}
              style={({ pressed }) => [styles.authorHit, pressed && { opacity: 0.88 }]}>
              <UserAvatar nickname={authorName} avatarUrl={authorAvatar} size={24} />
              <Text style={styles.authorName} numberOfLines={1}>
                {authorName}
              </Text>
            </Pressable>
          ) : (
            <View style={styles.authorHit}>
              {isNewsCard ? (
                <Text style={styles.authorName} numberOfLines={1}>
                  Читать
                </Text>
              ) : null}
            </View>
          )}

          <View style={styles.stats}>
            <View style={styles.stat} accessibilityLabel={`Просмотры: ${post.views}`}>
              <Ionicons name="eye-outline" size={14} color={colors.textMuted} />
              <Text style={styles.statText}>{post.views}</Text>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={post.liked ? 'Убрать лайк' : 'Поставить лайк'}
              hitSlop={8}
              onPress={() => onToggleLike?.(post.id)}
              style={styles.stat}>
              <Ionicons
                name={post.liked ? 'heart' : 'heart-outline'}
                size={14}
                color={post.liked ? colors.destructive : colors.textMuted}
              />
              <Text style={[styles.statText, post.liked && { color: colors.destructive }]}>
                {post.likes}
              </Text>
            </Pressable>
          </View>
        </View>
      </View>
    </View>
  );
}
