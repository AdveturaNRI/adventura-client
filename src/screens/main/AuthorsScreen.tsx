import { useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { AuthorFilters } from '@/components/authors/AuthorFilters';
import { AuthorPostCard } from '@/components/authors/AuthorPostCard';
import { BecomeAuthorBanner } from '@/components/authors/BecomeAuthorBanner';
import {
  useIsDesktopSidebarVisible,
  useIsDesktopWeb,
} from '@/components/navigation/DesktopThemeToggle';
import { MobileScreenHeader } from '@/components/navigation/MobileScreenHeader';
import { ScreenTransition } from '@/components/navigation/ScreenTransition';
import {
  ScrollToTopButton,
  shouldShowScrollToTop,
} from '@/components/navigation/ScrollToTopButton';
import { useRouter } from 'expo-router';
import { useAuthors } from '@/context/AuthorsContext';
import { filterPostsByCategory } from '@/data/authors/helpers';
import type { Author, AuthorPost, CreativityCategoryFilter } from '@/data/authors/types';
import { FontSize, Spacing, type ThemeColors } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useThemedStyles } from '@/hooks/use-themed-styles';

import { useMainScreenStyles } from './main-screen.styles';

const DESKTOP_CONTENT_MAX = 1120;
const PIN_GAP = Spacing.md;

type FeedPost = {
  post: AuthorPost;
  author: Author;
};

function splitIntoColumns(items: FeedPost[], columnCount: number): FeedPost[][] {
  const columns: FeedPost[][] = Array.from({ length: columnCount }, () => []);
  items.forEach((item, index) => {
    columns[index % columnCount]?.push(item);
  });
  return columns;
}

function createLocalStyles(colors: ThemeColors, isDesktopWeb: boolean) {
  return StyleSheet.create({
    shell: {
      width: '100%',
      maxWidth: isDesktopWeb ? DESKTOP_CONTENT_MAX : undefined,
      alignSelf: isDesktopWeb ? 'center' : undefined,
      gap: isDesktopWeb ? Spacing.lg : Spacing.md,
      paddingBottom: Spacing.xl,
    },
    headerBlock: {
      gap: Spacing.xs,
    },
    pageTitle: {
      fontSize: isDesktopWeb ? 32 : FontSize.h1,
      fontWeight: '700',
      color: colors.text,
      letterSpacing: -0.4,
    },
    pageSubtitle: {
      fontSize: FontSize.label,
      color: colors.textMuted,
      lineHeight: FontSize.label * 1.45,
      maxWidth: 520,
    },
    masonry: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: PIN_GAP,
    },
    column: {
      flex: 1,
      minWidth: 0,
      gap: PIN_GAP,
    },
    stateWrap: {
      alignItems: 'center',
      justifyContent: 'center',
      gap: Spacing.sm,
      paddingVertical: Spacing.xl,
      paddingHorizontal: Spacing.lg,
      minHeight: 180,
    },
    emptyTitle: {
      fontSize: FontSize.button,
      fontWeight: '700',
      color: colors.text,
      textAlign: 'center',
    },
    emptyHint: {
      fontSize: FontSize.caption,
      color: colors.textMuted,
      textAlign: 'center',
      lineHeight: FontSize.caption * 1.45,
    },
    retry: {
      marginTop: Spacing.xs,
      minHeight: 40,
      paddingHorizontal: 16,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: 'rgba(21, 122, 254, 0.35)',
      backgroundColor: 'rgba(21, 122, 254, 0.12)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    retryLabel: {
      fontSize: FontSize.caption,
      fontWeight: '700',
      color: colors.primary,
    },
  });
}

export default function AuthorsScreen() {
  const router = useRouter();
  const colors = useTheme();
  const mainStyles = useMainScreenStyles();
  const isDesktopWeb = useIsDesktopWeb();
  const hasDesktopSidebar = useIsDesktopSidebarVisible();
  const showCompactNav = !hasDesktopSidebar;
  const styles = useThemedStyles((theme) => createLocalStyles(theme, isDesktopWeb));
  const { authors, posts, toggleLike, isLoading, error, refresh } = useAuthors();

  const [filter, setFilter] = useState<CreativityCategoryFilter>('all');
  const [showScrollTop, setShowScrollTop] = useState(false);
  const scrollRef = useRef<ScrollView>(null);

  const feedPosts = useMemo(() => {
    const authorsById = new Map(authors.map((author) => [author.id, author]));
    const visiblePosts = filterPostsByCategory(posts, filter);
    const items: FeedPost[] = [];
    for (const post of visiblePosts) {
      const author = authorsById.get(post.authorId);
      if (author) {
        items.push({ author, post });
      }
    }
    return items.sort((a, b) => b.post.createdAt.localeCompare(a.post.createdAt));
  }, [authors, filter, posts]);

  const columnCount = isDesktopWeb ? 3 : 1;
  const columns = useMemo(
    () => splitIntoColumns(feedPosts, columnCount),
    [feedPosts, columnCount],
  );

  return (
    <ScreenTransition animateOnFocus>
      <View style={{ flex: 1 }}>
        <ScrollView
          ref={scrollRef}
          style={mainStyles.scroll}
          contentContainerStyle={mainStyles.content}
          showsVerticalScrollIndicator={false}
          scrollEventThrottle={16}
          onScroll={(event: NativeSyntheticEvent<NativeScrollEvent>) => {
            setShowScrollTop(shouldShowScrollToTop(event.nativeEvent.contentOffset.y));
          }}>
          <View style={styles.shell}>
            {showCompactNav ? (
              <View style={styles.headerBlock}>
                <MobileScreenHeader title="Публикации" />
                <Text style={styles.pageSubtitle}>
                  Работы авторов крупным планом.
                </Text>
              </View>
            ) : (
              <View style={styles.headerBlock}>
                <Text style={styles.pageTitle}>Публикации</Text>
                <Text style={styles.pageSubtitle}>
                  Работы авторов крупным планом.
                </Text>
              </View>
            )}

            <BecomeAuthorBanner onBecomeAuthor={() => router.push('/author-cabinet')} />

            <AuthorFilters value={filter} onChange={setFilter} />

            {isLoading ? (
              <View style={styles.stateWrap}>
                <ActivityIndicator color={colors.primary} />
                <Text style={styles.emptyHint}>Загружаем публикации…</Text>
              </View>
            ) : error && feedPosts.length === 0 ? (
              <View style={styles.stateWrap}>
                <Text style={styles.emptyTitle}>Не удалось загрузить</Text>
                <Text style={styles.emptyHint}>{error}</Text>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => {
                    void refresh();
                  }}
                  style={({ pressed }) => [styles.retry, pressed && { opacity: 0.88 }]}>
                  <Text style={styles.retryLabel}>Повторить</Text>
                </Pressable>
              </View>
            ) : feedPosts.length === 0 ? (
              <View style={styles.stateWrap}>
                <Text style={styles.emptyTitle}>Пока нет публикаций</Text>
                <Text style={styles.emptyHint}>Переключите фильтр или загляните позже.</Text>
              </View>
            ) : (
              <View style={styles.masonry}>
                {columns.map((column, columnIndex) => (
                  <View key={`col-${columnIndex}`} style={styles.column}>
                    {column.map(({ post, author }) => (
                      <AuthorPostCard
                        key={post.id}
                        post={post}
                        authorId={author.id}
                        authorName={author.name}
                        authorAvatar={author.avatar}
                        onToggleLike={(postId) => {
                          void toggleLike(postId);
                        }}
                      />
                    ))}
                  </View>
                ))}
              </View>
            )}
          </View>
        </ScrollView>

        <ScrollToTopButton
          visible={showScrollTop}
          onPress={() => scrollRef.current?.scrollTo({ y: 0, animated: true })}
        />
      </View>
    </ScreenTransition>
  );
}
