import { useLocalSearchParams, router } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
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

import { AuthorPostCard } from '@/components/authors/AuthorPostCard';
import { AuthorProfile } from '@/components/authors/AuthorProfile';
import {
  useIsDesktopSidebarVisible,
  useIsDesktopWeb,
} from '@/components/navigation/DesktopThemeToggle';
import { MobileBackButton } from '@/components/navigation/MobileBackButton';
import { MobileScreenHeader } from '@/components/navigation/MobileScreenHeader';
import { ScreenTransition } from '@/components/navigation/ScreenTransition';
import {
  ScrollToTopButton,
  shouldShowScrollToTop,
} from '@/components/navigation/ScrollToTopButton';
import { useAuthors } from '@/context/AuthorsContext';
import { FontSize, Spacing, type ThemeColors } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useThemedStyles } from '@/hooks/use-themed-styles';

import { useMainScreenStyles } from './main-screen.styles';

const DESKTOP_CONTENT_MAX = 1080;
const DESKTOP_SIDEBAR_WIDTH = 300;
const DESKTOP_CARD_WIDTH = 340;
const PIN_GAP = Spacing.md;

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
    headerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.sm,
    },
    headerCopy: {
      flex: 1,
      minWidth: 0,
      gap: 6,
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
    },
    workspace: {
      flexDirection: isDesktopWeb ? 'row' : 'column',
      alignItems: 'stretch',
      gap: isDesktopWeb ? Spacing.lg : Spacing.md,
      width: '100%',
    },
    sidebar: {
      width: isDesktopWeb ? DESKTOP_SIDEBAR_WIDTH : '100%',
      maxWidth: isDesktopWeb ? DESKTOP_SIDEBAR_WIDTH : undefined,
      flexShrink: 0,
    },
    main: {
      flex: 1,
      minWidth: 0,
      width: isDesktopWeb ? undefined : '100%',
      gap: Spacing.md,
    },
    sectionHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: Spacing.sm,
      minHeight: 32,
    },
    sectionTitle: {
      fontSize: FontSize.button,
      fontWeight: '700',
      color: colors.text,
    },
    sectionCount: {
      minWidth: 28,
      height: 28,
      paddingHorizontal: 8,
      borderRadius: 999,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'rgba(21, 122, 254, 0.12)',
    },
    sectionCountText: {
      fontSize: FontSize.caption,
      fontWeight: '700',
      color: colors.primary,
    },
    postsGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      alignContent: 'flex-start',
      gap: PIN_GAP,
      width: '100%',
    },
    cardSlot: {
      width: isDesktopWeb ? DESKTOP_CARD_WIDTH : '100%',
      maxWidth: isDesktopWeb ? DESKTOP_CARD_WIDTH : '100%',
    },
    stateWrap: {
      paddingVertical: Spacing.lg,
      gap: Spacing.xs,
    },
    emptyText: {
      fontSize: FontSize.caption,
      color: colors.textMuted,
      lineHeight: FontSize.caption * 1.45,
    },
    missing: {
      paddingVertical: Spacing.xl,
      gap: Spacing.sm,
    },
    missingTitle: {
      fontSize: FontSize.button,
      fontWeight: '700',
      color: colors.text,
    },
    retry: {
      alignSelf: 'flex-start',
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

export default function AuthorProfileScreen() {
  const mainStyles = useMainScreenStyles();
  const colors = useTheme();
  const isDesktopWeb = useIsDesktopWeb();
  const hasDesktopSidebar = useIsDesktopSidebarVisible();
  const showCompactNav = !hasDesktopSidebar;
  const styles = useThemedStyles((theme) => createLocalStyles(theme, isDesktopWeb));

  const { authorId: rawAuthorId } = useLocalSearchParams<{ authorId: string }>();
  const authorId = Array.isArray(rawAuthorId) ? rawAuthorId[0] : rawAuthorId;

  const { getAuthorById, getPostsForAuthor, toggleLike, ensureAuthor, isLoading } = useAuthors();
  const author = authorId ? getAuthorById(authorId) : undefined;
  const posts = useMemo(
    () => (authorId ? getPostsForAuthor(authorId) : []),
    [authorId, getPostsForAuthor],
  );

  const [showScrollTop, setShowScrollTop] = useState(false);
  const [resolving, setResolving] = useState(false);
  const scrollRef = useRef<ScrollView>(null);

  useEffect(() => {
    if (!authorId || author) {
      return;
    }
    let cancelled = false;
    setResolving(true);
    void ensureAuthor(authorId).finally(() => {
      if (!cancelled) {
        setResolving(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [author, authorId, ensureAuthor]);

  if (!authorId) {
    return (
      <ScreenTransition animateOnFocus>
        <View style={mainStyles.container}>
          <View style={styles.headerRow}>
            <MobileBackButton fallbackHref="/authors" />
            <Text style={styles.pageTitle}>Автор</Text>
          </View>
          <View style={styles.missing}>
            <Text style={styles.missingTitle}>Автор не найден</Text>
            <Text style={styles.emptyText}>Вернитесь в каталог и выберите другого.</Text>
          </View>
        </View>
      </ScreenTransition>
    );
  }

  if (!author && (isLoading || resolving)) {
    return (
      <ScreenTransition animateOnFocus>
        <View style={[mainStyles.container, { alignItems: 'center', justifyContent: 'center' }]}>
          <ActivityIndicator color={colors.primary} />
          <Text style={[styles.emptyText, { marginTop: Spacing.sm }]}>Загружаем профиль…</Text>
        </View>
      </ScreenTransition>
    );
  }

  if (!author) {
    return (
      <ScreenTransition animateOnFocus>
        <View style={mainStyles.container}>
          <View style={styles.headerRow}>
            <MobileBackButton fallbackHref="/authors" />
            <Text style={styles.pageTitle}>Автор</Text>
          </View>
          <View style={styles.missing}>
            <Text style={styles.missingTitle}>Автор не найден</Text>
            <Text style={styles.emptyText}>Вернитесь в каталог и выберите другого.</Text>
            <Pressable
              accessibilityRole="button"
              onPress={() => {
                setResolving(true);
                void ensureAuthor(authorId).finally(() => setResolving(false));
              }}
              style={({ pressed }) => [styles.retry, pressed && { opacity: 0.88 }]}>
              <Text style={styles.retryLabel}>Повторить</Text>
            </Pressable>
          </View>
        </View>
      </ScreenTransition>
    );
  }

  return (
    <ScreenTransition animateOnFocus>
      <View style={{ flex: 1, minWidth: 0, width: '100%' }}>
        <ScrollView
          ref={scrollRef}
          style={mainStyles.scroll}
          contentContainerStyle={[mainStyles.content, { width: '100%' }]}
          showsVerticalScrollIndicator={false}
          scrollEventThrottle={16}
          onScroll={(event: NativeSyntheticEvent<NativeScrollEvent>) => {
            setShowScrollTop(shouldShowScrollToTop(event.nativeEvent.contentOffset.y));
          }}>
          <View style={styles.shell}>
            {showCompactNav ? (
              <View style={styles.headerBlock}>
                <MobileScreenHeader
                  title={author.name}
                  leftAction={<MobileBackButton fallbackHref="/authors" />}
                />
              </View>
            ) : (
              <View style={styles.headerCopy}>
                <Text style={styles.pageTitle} numberOfLines={1}>
                  {author.name}
                </Text>
                <Text style={styles.pageSubtitle}>
                  {posts.length === 0
                    ? 'Публикаций пока нет'
                    : `${posts.length} ${posts.length === 1 ? 'работа' : 'работ'} в «Публикациях»`}
                </Text>
              </View>
            )}

            <View style={styles.workspace}>
              <View style={styles.sidebar}>
                <AuthorProfile
                  author={author}
                  variant={isDesktopWeb ? 'panel' : 'default'}
                  onPress={() => router.push(`/users/${author.id}`)}
                />
              </View>

              <View style={styles.main}>
                <View style={styles.sectionHeader}>
                  <Text style={styles.sectionTitle}>Публикации</Text>
                  {posts.length > 0 ? (
                    <View style={styles.sectionCount}>
                      <Text style={styles.sectionCountText}>{posts.length}</Text>
                    </View>
                  ) : null}
                </View>

                {posts.length === 0 ? (
                  <View style={styles.stateWrap}>
                    <Text style={styles.emptyText}>Публикаций пока нет.</Text>
                  </View>
                ) : (
                  <View style={styles.postsGrid}>
                    {posts.map((post) => (
                      <View key={post.id} style={styles.cardSlot}>
                        <AuthorPostCard
                          post={post}
                          authorId={author.id}
                          onToggleLike={(postId) => {
                            void toggleLike(postId);
                          }}
                        />
                      </View>
                    ))}
                  </View>
                )}
              </View>
            </View>
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
