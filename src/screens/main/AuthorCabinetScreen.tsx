import { Ionicons } from '@expo/vector-icons';
import { useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { AuthorCabinetPostCard } from '@/components/authors/AuthorCabinetPostCard';
import { AuthorPostCreate } from '@/components/authors/AuthorPostCreate';
import { AuthorProfile } from '@/components/authors/AuthorProfile';
import { AuthorProfileEdit } from '@/components/authors/AuthorProfileEdit';
import { DeleteAuthorPostDialog } from '@/components/authors/DeleteAuthorPostDialog';
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
import { Button, toast } from '@/components/ui';
import { useAuthors } from '@/context/AuthorsContext';
import { useAuth } from '@/context/AuthContext';
import { useProfile } from '@/context/ProfileContext';
import type { AuthorPost } from '@/data/authors/types';
import { FontSize, Spacing, type ThemeColors } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useThemedStyles } from '@/hooks/use-themed-styles';
import { localizeErrorMessage } from '@/utils/localizeError';

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
      gap: Spacing.sm,
    },
    headerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.sm,
      width: '100%',
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
      maxWidth: isDesktopWeb ? 560 : undefined,
    },
    createButtonDesktop: {
      alignSelf: 'center',
      minWidth: 160,
      flexShrink: 0,
    },
    createButtonMobile: {
      alignSelf: 'stretch',
    },
    workspace: {
      flexDirection: isDesktopWeb ? 'row' : 'column',
      alignItems: 'flex-start',
      gap: isDesktopWeb ? Spacing.lg : Spacing.md,
      width: '100%',
    },
    sidebar: {
      width: isDesktopWeb ? DESKTOP_SIDEBAR_WIDTH : '100%',
      maxWidth: isDesktopWeb ? DESKTOP_SIDEBAR_WIDTH : undefined,
      flexShrink: 0,
      gap: Spacing.md,
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
      minHeight: 44,
    },
    sectionTitleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.sm,
      flex: 1,
      minWidth: 0,
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
      paddingVertical: isDesktopWeb ? Spacing.xl : Spacing.xl,
      paddingHorizontal: isDesktopWeb ? Spacing.xl : 0,
      gap: Spacing.sm,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.borderLight,
      backgroundColor: colors.surface,
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: isDesktopWeb ? 220 : undefined,
    },
    emptyTitle: {
      fontSize: FontSize.button,
      fontWeight: '700',
      color: colors.text,
      textAlign: 'center',
    },
    emptyText: {
      fontSize: FontSize.caption,
      color: colors.textMuted,
      lineHeight: FontSize.caption * 1.45,
      maxWidth: 360,
      textAlign: 'center',
    },
  });
}

export default function AuthorCabinetScreen() {
  const mainStyles = useMainScreenStyles();
  const colors = useTheme();
  const isDesktopWeb = useIsDesktopWeb();
  const hasDesktopSidebar = useIsDesktopSidebarVisible();
  const showCompactNav = !hasDesktopSidebar;
  const styles = useThemedStyles((theme) => createLocalStyles(theme, isDesktopWeb));
  const { user } = useAuth();
  const { avatarUrl, profile } = useProfile();
  const {
    getAuthorById,
    getPostsForAuthor,
    toggleLike,
    createPost,
    updatePost,
    deletePost,
    updateAuthor,
    myAuthorId,
    isLoading,
    error,
    refresh,
  } = useAuthors();

  const author = myAuthorId ? getAuthorById(myAuthorId) : undefined;
  const displayAuthor = useMemo(() => {
    if (!author) {
      return undefined;
    }
    const nickname = user?.nickname?.trim();
    const perks = profile?.perks;
    return {
      ...author,
      name: nickname && nickname.length > 0 ? nickname : author.name,
      avatar: avatarUrl?.trim() || author.avatar,
      badges: perks?.visibleBadges ?? perks?.badges ?? author.badges,
      avatarFrameId: perks?.avatarFrameId ?? author.avatarFrameId ?? null,
    };
  }, [author, avatarUrl, profile?.perks, user?.nickname]);

  const posts = useMemo(
    () => (displayAuthor ? getPostsForAuthor(displayAuthor.id) : []),
    [displayAuthor, getPostsForAuthor],
  );

  const [editorOpen, setEditorOpen] = useState(false);
  const [editingPost, setEditingPost] = useState<AuthorPost | null>(null);
  const [profileEditOpen, setProfileEditOpen] = useState(false);
  const [postToDelete, setPostToDelete] = useState<AuthorPost | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [showScrollTop, setShowScrollTop] = useState(false);
  const scrollRef = useRef<ScrollView>(null);

  const openCreate = () => {
    setEditingPost(null);
    setEditorOpen(true);
  };

  const openEdit = (post: AuthorPost) => {
    setEditingPost(post);
    setEditorOpen(true);
  };

  const closeEditor = () => {
    setEditorOpen(false);
    setEditingPost(null);
  };

  const handleConfirmDelete = async () => {
    if (!postToDelete || deleting) {
      return;
    }
    setDeleting(true);
    try {
      await deletePost(postToDelete.id);
      toast.success('Публикацию удалили');
      setPostToDelete(null);
    } catch (err) {
      toast.error(localizeErrorMessage(err, 'Не удалось удалить публикацию'));
    } finally {
      setDeleting(false);
    }
  };

  if (isLoading && !displayAuthor) {
    return (
      <ScreenTransition animateOnFocus>
        <View style={[mainStyles.container, { alignItems: 'center', justifyContent: 'center' }]}>
          <ActivityIndicator color={colors.primary} />
          <Text style={[styles.emptyText, { marginTop: Spacing.sm }]}>Открываем кабинет…</Text>
        </View>
      </ScreenTransition>
    );
  }

  if (!displayAuthor) {
    return (
      <ScreenTransition animateOnFocus>
        <View style={mainStyles.container}>
          <View style={styles.headerRow}>
            {showCompactNav ? <MobileBackButton fallbackHref="/profile" /> : null}
            <Text style={styles.pageTitle}>Кабинет автора</Text>
          </View>
          <Text style={styles.emptyText}>
            {error || 'Профиль автора пока не создан.'}
          </Text>
          {error ? (
            <Button
              label="Повторить"
              variant="outline"
              onPress={() => {
                void refresh();
              }}
              style={{ alignSelf: 'flex-start', marginTop: Spacing.sm }}
            />
          ) : null}
        </View>
      </ScreenTransition>
    );
  }

  const publishButton = (
    <Button
      label="Опубликовать"
      icon={<Ionicons name="add" size={18} color={colors.onPrimary} />}
      onPress={openCreate}
      style={showCompactNav ? styles.createButtonMobile : styles.createButtonDesktop}
    />
  );

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
                  title="Кабинет автора"
                  leftAction={<MobileBackButton fallbackHref="/profile" />}
                />
                <Text style={styles.pageSubtitle}>
                  Здесь вы можете управлять публикациями, которые отображаются в разделе «Публикации».
                </Text>
                {publishButton}
              </View>
            ) : (
              <View style={styles.headerCopy}>
                <Text style={styles.pageTitle}>Кабинет автора</Text>
                <Text style={styles.pageSubtitle}>
                  Здесь вы можете управлять публикациями, которые отображаются в разделе «Публикации».
                </Text>
              </View>
            )}

            <View style={styles.workspace}>
              <View style={styles.sidebar}>
                <AuthorProfile
                  author={displayAuthor}
                  variant={isDesktopWeb ? 'panel' : 'default'}
                  actions={
                    <Button
                      label="О себе"
                      variant="outline"
                      icon={<Ionicons name="pencil-outline" size={16} color={colors.text} />}
                      onPress={() => setProfileEditOpen(true)}
                    />
                  }
                />
              </View>

              <View style={styles.main}>
                <View style={styles.sectionHeader}>
                  <View style={styles.sectionTitleRow}>
                    <Text style={styles.sectionTitle}>Мои публикации</Text>
                    {posts.length > 0 ? (
                      <View style={styles.sectionCount}>
                        <Text style={styles.sectionCountText}>{posts.length}</Text>
                      </View>
                    ) : null}
                  </View>
                  {isDesktopWeb ? publishButton : null}
                </View>

                {posts.length === 0 ? (
                  <View style={styles.stateWrap}>
                    <Text style={styles.emptyTitle}>Пока пусто</Text>
                    <Text style={styles.emptyText}>
                      Добавьте первую работу — она сразу появится в разделе «Публикации».
                    </Text>
                    {!isDesktopWeb ? (
                      <Button
                        label="Опубликовать"
                        icon={<Ionicons name="add" size={18} color={colors.onPrimary} />}
                        onPress={openCreate}
                      />
                    ) : null}
                  </View>
                ) : (
                  <View style={styles.postsGrid}>
                    {posts.map((post) => (
                      <View key={post.id} style={styles.cardSlot}>
                        <AuthorCabinetPostCard
                          post={post}
                          authorId={displayAuthor.id}
                          onToggleLike={(postId) => {
                            void toggleLike(postId);
                          }}
                          onEdit={openEdit}
                          onDelete={setPostToDelete}
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

        <AuthorPostCreate
          authorId={displayAuthor.id}
          visible={editorOpen}
          initialPost={editingPost}
          onClose={closeEditor}
          onSubmit={createPost}
          onUpdate={updatePost}
        />

        <AuthorProfileEdit
          author={displayAuthor}
          visible={profileEditOpen}
          onClose={() => setProfileEditOpen(false)}
          onSave={updateAuthor}
        />

        <DeleteAuthorPostDialog
          visible={Boolean(postToDelete)}
          postTitle={postToDelete?.title}
          onConfirm={() => {
            void handleConfirmDelete();
          }}
          onCancel={() => {
            if (!deleting) {
              setPostToDelete(null);
            }
          }}
        />
      </View>
    </ScreenTransition>
  );
}
