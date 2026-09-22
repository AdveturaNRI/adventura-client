import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { CreativityCategoryBadges } from '@/components/authors/CreativityCategoryBadge';
import { AuthorPostFiles } from '@/components/authors/AuthorPostFiles';
import { AuthorPostPurchase } from '@/components/authors/AuthorPostPurchase';
import { AuthorRichText } from '@/components/authors/AuthorRichText';
import { ChatImageLightbox } from '@/components/chats/ChatImageLightbox';
import {
  useIsDesktopSidebarVisible,
  useIsDesktopWeb,
} from '@/components/navigation/DesktopThemeToggle';
import { MobileBackButton } from '@/components/navigation/MobileBackButton';
import { MobileScreenHeader } from '@/components/navigation/MobileScreenHeader';
import { ScreenTransition } from '@/components/navigation/ScreenTransition';
import { UserAvatar } from '@/components/navigation/UserAvatar';
import { toast } from '@/components/ui';
import { copyTextToClipboard } from '@/components/gm-toolkit/copyText';
import { useAuthors } from '@/context/AuthorsContext';
import type { Author } from '@/data/authors/types';
import { FontSize, Spacing, type ThemeColors } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useThemedStyles } from '@/hooks/use-themed-styles';
import { formatAuthorPostDate } from '@/utils/authors-format';
import { getImageSize } from '@/utils/image-size';

import { useMainScreenStyles } from './main-screen.styles';

const DESKTOP_CONTENT_MAX = 760;
/** На ПК превью не растягиваем на весь экран — полный размер через lightbox. */
const DESKTOP_IMAGE_MAX_HEIGHT = 380;

function createLocalStyles(colors: ThemeColors, isDesktopWeb: boolean) {
  return StyleSheet.create({
    shell: {
      width: '100%',
      maxWidth: isDesktopWeb ? DESKTOP_CONTENT_MAX : undefined,
      alignSelf: isDesktopWeb ? 'center' : undefined,
      gap: Spacing.md,
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
    pageTitle: {
      flex: 1,
      fontSize: isDesktopWeb ? 28 : FontSize.h1,
      fontWeight: '700',
      color: colors.text,
      letterSpacing: -0.3,
    },
    title: {
      fontSize: isDesktopWeb ? 30 : FontSize.h1,
      fontWeight: '700',
      color: colors.text,
      letterSpacing: -0.3,
    },
    gallery: {
      gap: Spacing.md,
    },
    imageWrap: {
      width: '100%',
      borderRadius: 14,
      overflow: 'hidden',
      borderWidth: 1,
      borderColor: colors.borderLight,
      backgroundColor: colors.surfaceMuted,
      position: 'relative',
    },
    imageWrapDesktop: {
      maxHeight: DESKTOP_IMAGE_MAX_HEIGHT,
      alignItems: 'center',
      justifyContent: 'center',
      alignSelf: 'center',
    },
    image: {
      width: '100%',
      backgroundColor: colors.surfaceMuted,
    },
    imagePlaceholder: {
      width: '100%',
      height: isDesktopWeb ? DESKTOP_IMAGE_MAX_HEIGHT : 220,
    },
    expandButton: {
      position: 'absolute',
      right: 12,
      bottom: 12,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      minHeight: 36,
      paddingHorizontal: 12,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: 'rgba(21, 122, 254, 0.4)',
      backgroundColor: 'rgba(21, 122, 254, 0.92)',
    },
    expandButtonText: {
      fontSize: FontSize.caption,
      fontWeight: '700',
      color: colors.onPrimary,
    },
    metaRow: {
      flexDirection: 'row',
      alignItems: 'center',
      flexWrap: 'wrap',
      gap: 8,
    },
    metaChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      minHeight: 34,
      paddingHorizontal: 12,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: colors.borderLight,
      backgroundColor: colors.surface,
    },
    metaChipText: {
      fontSize: FontSize.caption,
      fontWeight: '600',
      color: colors.textSecondary,
    },
    actionLike: {
      borderColor: 'rgba(255, 59, 48, 0.28)',
      backgroundColor: 'rgba(255, 59, 48, 0.08)',
    },
    actionLikeOn: {
      borderColor: 'rgba(255, 59, 48, 0.45)',
      backgroundColor: 'rgba(255, 59, 48, 0.16)',
    },
    actionLikeText: {
      color: colors.destructive,
      fontWeight: '700',
    },
    actionShare: {
      borderColor: 'rgba(21, 122, 254, 0.35)',
      backgroundColor: 'rgba(21, 122, 254, 0.12)',
    },
    actionShareText: {
      fontSize: FontSize.caption,
      fontWeight: '700',
      color: colors.primary,
    },
    authorCard: {
      gap: Spacing.md,
      padding: Spacing.md,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.borderLight,
      backgroundColor: colors.surface,
    },
    authorTop: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.md,
    },
    authorBody: {
      flex: 1,
      minWidth: 0,
      gap: 6,
    },
    authorName: {
      fontSize: FontSize.button,
      fontWeight: '700',
      color: colors.text,
    },
    authorDescription: {
      fontSize: FontSize.caption,
      color: colors.textMuted,
      lineHeight: FontSize.caption * 1.45,
    },
    authorCta: {
      alignSelf: 'flex-start',
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      minHeight: 34,
      paddingHorizontal: 12,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: 'rgba(21, 122, 254, 0.35)',
      backgroundColor: 'rgba(21, 122, 254, 0.12)',
    },
    authorCtaText: {
      fontSize: FontSize.caption,
      fontWeight: '700',
      color: colors.primary,
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
    emptyText: {
      fontSize: FontSize.caption,
      color: colors.textMuted,
    },
  });
}

function AuthorPostImage({
  uri,
  onExpand,
}: {
  uri: string;
  onExpand: () => void;
}) {
  const colors = useTheme();
  const isDesktopWeb = useIsDesktopWeb();
  const styles = useThemedStyles((theme) => createLocalStyles(theme, isDesktopWeb));
  const [ratio, setRatio] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    void getImageSize(uri)
      .then(({ width, height }) => {
        if (!cancelled && width > 0 && height > 0) {
          setRatio(width / height);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setRatio(16 / 10);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [uri]);

  const desktopFrame = (() => {
    if (!isDesktopWeb) {
      return null;
    }
    const safeRatio = ratio && ratio > 0 ? ratio : 16 / 10;
    const height = Math.min(DESKTOP_IMAGE_MAX_HEIGHT, DESKTOP_CONTENT_MAX / safeRatio);
    const width = Math.min(DESKTOP_CONTENT_MAX, height * safeRatio);
    return { width, height };
  })();

  const imageStyle = desktopFrame
    ? [styles.image, { width: desktopFrame.width, height: desktopFrame.height }]
    : [styles.image, ratio ? { aspectRatio: ratio } : styles.imagePlaceholder];

  return (
    <Pressable
      accessibilityRole="imagebutton"
      accessibilityLabel="Фото публикации"
      onPress={onExpand}
      style={({ pressed }) => [
        styles.imageWrap,
        isDesktopWeb && styles.imageWrapDesktop,
        desktopFrame ? { height: desktopFrame.height } : null,
        pressed && { opacity: 0.96 },
      ]}>
      <Image
        source={{ uri }}
        style={imageStyle}
        contentFit="contain"
        accessibilityLabel="Фото публикации"
      />
      {isDesktopWeb ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Открыть на весь экран"
          onPress={(event) => {
            event.stopPropagation?.();
            onExpand();
          }}
          style={({ pressed }) => [styles.expandButton, pressed && { opacity: 0.88 }]}>
          <Ionicons name="expand-outline" size={16} color={colors.onPrimary} />
          <Text style={styles.expandButtonText}>На весь экран</Text>
        </Pressable>
      ) : null}
    </Pressable>
  );
}

function buildPostShareUrl(authorId: string, postId: string): string {
  if (Platform.OS === 'web' && typeof window !== 'undefined' && window.location?.origin) {
    return `${window.location.origin}/authors/${authorId}/posts/${postId}`;
  }
  return `/authors/${authorId}/posts/${postId}`;
}

async function shareAuthorPost(input: {
  title: string;
  authorName: string;
  authorId: string;
  postId: string;
}) {
  const url = buildPostShareUrl(input.authorId, input.postId);
  const message = `${input.title} — ${input.authorName}\n${url}`;

  try {
    if (
      Platform.OS === 'web' &&
      typeof navigator !== 'undefined' &&
      typeof navigator.share === 'function'
    ) {
      await navigator.share({ title: input.title, text: message, url });
      return;
    }

    if (Platform.OS !== 'web') {
      await Share.share({ message, url, title: input.title });
      return;
    }

    await copyTextToClipboard(url);
    toast.success('Ссылку скопировали');
  } catch (error) {
    if (
      error &&
      typeof error === 'object' &&
      'name' in error &&
      (error as { name?: string }).name === 'AbortError'
    ) {
      return;
    }
    try {
      await copyTextToClipboard(url);
      toast.success('Ссылку скопировали');
    } catch {
      toast.error('Не удалось поделиться');
    }
  }
}

type AuthorSectionProps = {
  author: Author;
  styles: ReturnType<typeof createLocalStyles>;
  mutedColor: string;
  primaryColor: string;
};

function AuthorSection({ author, styles, mutedColor, primaryColor }: AuthorSectionProps) {
  const router = useRouter();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Автор ${author.name}`}
      onPress={() => router.push(`/authors/${author.id}`)}
      style={({ pressed }) => [styles.authorCard, pressed && { opacity: 0.92 }]}>
      <View style={styles.authorTop}>
        <UserAvatar nickname={author.name} avatarUrl={author.avatar} size={56} />
        <View style={styles.authorBody}>
          <Text style={styles.authorName} numberOfLines={1}>
            {author.name}
          </Text>
          <CreativityCategoryBadges categories={author.categories} />
        </View>
        <Ionicons name="chevron-forward" size={18} color={mutedColor} />
      </View>
      {author.description ? (
        <Text style={styles.authorDescription} numberOfLines={3}>
          {author.description}
        </Text>
      ) : null}
      <View style={styles.authorCta}>
        <Ionicons name="person-outline" size={14} color={primaryColor} />
        <Text style={styles.authorCtaText}>К автору</Text>
      </View>
    </Pressable>
  );
}

export default function AuthorPostScreen() {
  const mainStyles = useMainScreenStyles();
  const colors = useTheme();
  const isDesktopWeb = useIsDesktopWeb();
  const hasDesktopSidebar = useIsDesktopSidebarVisible();
  const showCompactNav = !hasDesktopSidebar;
  const styles = useThemedStyles((theme) => createLocalStyles(theme, isDesktopWeb));

  const params = useLocalSearchParams<{ authorId: string; postId: string }>();
  const authorId = Array.isArray(params.authorId) ? params.authorId[0] : params.authorId;
  const postId = Array.isArray(params.postId) ? params.postId[0] : params.postId;

  const { getAuthorById, getPostById, toggleLike, incrementViews, ensurePost, ensureAuthor, isLoading } =
    useAuthors();
  const author = authorId ? getAuthorById(authorId) : undefined;
  const post = postId ? getPostById(postId) : undefined;
  const [resolving, setResolving] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  const viewedRef = useRef<string | null>(null);
  const resolveAttemptRef = useRef<string | null>(null);

  useEffect(() => {
    if (!postId) {
      return;
    }
    if (post && author && post.authorId === author.id) {
      return;
    }
    if (resolveAttemptRef.current === postId) {
      return;
    }
    resolveAttemptRef.current = postId;
    let cancelled = false;
    setResolving(true);
    void (async () => {
      const loadedPost = post ?? (await ensurePost(postId));
      if (loadedPost && !getAuthorById(loadedPost.authorId)) {
        await ensureAuthor(loadedPost.authorId);
      } else if (authorId && !getAuthorById(authorId)) {
        await ensureAuthor(authorId);
      }
      if (!cancelled) {
        setResolving(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [author, authorId, ensureAuthor, ensurePost, getAuthorById, post, postId]);

  useEffect(() => {
    if (!postId || viewedRef.current === postId) {
      return;
    }
    viewedRef.current = postId;
    void incrementViews(postId);
  }, [postId, incrementViews]);

  const fallbackHref = authorId ? `/authors/${authorId}` : '/authors';

  if ((!post || !author || post.authorId !== author.id) && (isLoading || resolving)) {
    return (
      <ScreenTransition animateOnFocus>
        <View style={[mainStyles.container, { alignItems: 'center', justifyContent: 'center' }]}>
          <ActivityIndicator color={colors.primary} />
          <Text style={[styles.emptyText, { marginTop: Spacing.sm }]}>Загружаем публикацию…</Text>
        </View>
      </ScreenTransition>
    );
  }

  if (!post || !author || post.authorId !== author.id) {
    return (
      <ScreenTransition animateOnFocus>
        <View style={mainStyles.container}>
          <View style={styles.headerRow}>
            <MobileBackButton fallbackHref={fallbackHref} />
            <Text style={styles.pageTitle}>Публикация</Text>
          </View>
          <View style={styles.missing}>
            <Text style={styles.missingTitle}>Публикация не найдена</Text>
            <Text style={styles.emptyText}>Возможно, её удалили или ссылка устарела.</Text>
            <Pressable
              accessibilityRole="button"
              onPress={() => {
                if (!postId) return;
                resolveAttemptRef.current = null;
                setResolving(true);
                void ensurePost(postId).finally(() => setResolving(false));
              }}
              style={({ pressed }) => [
                styles.authorCta,
                { marginTop: Spacing.sm },
                pressed && { opacity: 0.88 },
              ]}>
              <Text style={styles.authorCtaText}>Повторить</Text>
            </Pressable>
          </View>
        </View>
      </ScreenTransition>
    );
  }

  return (
    <ScreenTransition animateOnFocus>
      <ScrollView
        style={mainStyles.scroll}
        contentContainerStyle={mainStyles.content}
        showsVerticalScrollIndicator={false}>
        <View style={styles.shell}>
          {showCompactNav ? (
            <View style={styles.headerBlock}>
              <MobileScreenHeader
                title="Публикация"
                leftAction={<MobileBackButton fallbackHref={fallbackHref} />}
              />
            </View>
          ) : (
            <View style={styles.headerBlock}>
              <View style={styles.headerRow}>
                <MobileBackButton fallbackHref={fallbackHref} />
                <Text style={styles.pageTitle} numberOfLines={1}>
                  {author.name}
                </Text>
              </View>
            </View>
          )}

          <Text style={styles.title}>{post.title}</Text>

          <View style={styles.metaRow}>
            <View style={styles.metaChip}>
              <Ionicons name="calendar-outline" size={14} color={colors.textMuted} />
              <Text style={styles.metaChipText}>{formatAuthorPostDate(post.createdAt)}</Text>
            </View>
            <View style={styles.metaChip}>
              <Ionicons name="eye-outline" size={14} color={colors.textMuted} />
              <Text style={styles.metaChipText}>{post.views}</Text>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={post.liked ? 'Убрать лайк' : 'Поставить лайк'}
              onPress={() => {
                void toggleLike(post.id);
              }}
              style={({ pressed }) => [
                styles.metaChip,
                styles.actionLike,
                post.liked && styles.actionLikeOn,
                pressed && { opacity: 0.88 },
              ]}>
              <Ionicons
                name={post.liked ? 'heart' : 'heart-outline'}
                size={14}
                color={colors.destructive}
              />
              <Text style={[styles.metaChipText, styles.actionLikeText]}>{post.likes}</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Поделиться"
              onPress={() =>
                void shareAuthorPost({
                  title: post.title,
                  authorName: author.name,
                  authorId: author.id,
                  postId: post.id,
                })
              }
              style={({ pressed }) => [
                styles.metaChip,
                styles.actionShare,
                pressed && { opacity: 0.88 },
              ]}>
              <Ionicons name="share-outline" size={14} color={colors.primary} />
              <Text style={styles.actionShareText}>Поделиться</Text>
            </Pressable>
          </View>

          {post.content ? <AuthorRichText value={post.content} /> : null}

          {post.images.length > 0 ? (
            <View style={styles.gallery}>
              {post.images.map((uri, index) => (
                <AuthorPostImage
                  key={uri}
                  uri={uri}
                  onExpand={() => setLightboxIndex(index)}
                />
              ))}
            </View>
          ) : null}

          {post.files.length > 0 ? <AuthorPostFiles files={post.files} readOnly /> : null}

          <AuthorPostPurchase post={post} />

          <AuthorSection
            author={author}
            styles={styles}
            mutedColor={colors.textMuted}
            primaryColor={colors.primary}
          />
        </View>
      </ScrollView>

      <ChatImageLightbox
        uris={lightboxIndex != null ? post.images : null}
        index={lightboxIndex ?? 0}
        onClose={() => setLightboxIndex(null)}
      />
    </ScreenTransition>
  );
}
