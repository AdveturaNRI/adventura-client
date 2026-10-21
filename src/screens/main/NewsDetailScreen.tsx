import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import RenderHTML, { defaultSystemFonts } from 'react-native-render-html';

import {
  useIsDesktopSidebarVisible,
  useIsDesktopWeb,
} from '@/components/navigation/DesktopThemeToggle';
import { MobileBackButton } from '@/components/navigation/MobileBackButton';
import { MobileScreenHeader } from '@/components/navigation/MobileScreenHeader';
import { ScreenTransition } from '@/components/navigation/ScreenTransition';
import { FadeInImage } from '@/components/ui/media/FadeInImage';
import { FontSize, Spacing, type ThemeColors } from '@/constants/theme';
import {
  ANNOUNCEMENT_READ_DWELL_MS,
  useAnnouncementsOptional,
} from '@/context/AnnouncementContext';
import { useNews } from '@/context/NewsContext';
import { useTheme } from '@/hooks/use-theme';
import { useThemedStyles } from '@/hooks/use-themed-styles';
import { claimAnnouncementView } from '@/utils/announcement-view-session';

import { useMainScreenStyles } from './main-screen.styles';

const DESKTOP_CONTENT_MAX = 760;
const DESKTOP_IMAGE_MAX_HEIGHT = 380;

function formatNewsDate(iso: string | null): string {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('ru-RU', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

function looksLikeHtml(value: string) {
  return /<\/?[a-z][\s\S]*>/i.test(value);
}

function plainToHtml(value: string) {
  return value
    .split(/\n{2,}/)
    .map((block) => `<p>${block.replace(/\n/g, '<br>')}</p>`)
    .join('');
}

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
    cover: {
      width: '100%',
      borderRadius: 14,
      overflow: 'hidden',
      borderWidth: 1,
      borderColor: colors.borderLight,
      backgroundColor: colors.surfaceMuted,
      aspectRatio: 16 / 9,
      maxHeight: isDesktopWeb ? DESKTOP_IMAGE_MAX_HEIGHT : undefined,
    },
    coverImage: {
      ...StyleSheet.absoluteFillObject,
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
    newBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      paddingLeft: 8,
      paddingRight: 10,
      paddingVertical: 5,
      borderRadius: 999,
      backgroundColor: colors.destructive,
    },
    newBadgeDot: {
      width: 5,
      height: 5,
      borderRadius: 3,
      backgroundColor: 'rgba(255, 255, 255, 0.95)',
    },
    newBadgeText: {
      fontSize: 11,
      fontWeight: '800',
      color: colors.onPrimary,
      letterSpacing: 0.6,
      textTransform: 'uppercase',
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
    },
    cta: {
      alignSelf: 'flex-start',
      minHeight: 44,
      paddingHorizontal: 16,
      borderRadius: 12,
      backgroundColor: colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    ctaText: {
      fontSize: FontSize.button,
      fontWeight: '700',
      color: colors.onPrimary,
    },
    empty: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      padding: Spacing.lg,
      gap: Spacing.sm,
    },
    emptyText: {
      fontSize: FontSize.label,
      color: colors.textMuted,
      textAlign: 'center',
    },
    missingTitle: {
      fontSize: FontSize.h1,
      fontWeight: '700',
      color: colors.text,
      textAlign: 'center',
    },
  });
}

export default function NewsDetailScreen() {
  const params = useLocalSearchParams<{ id?: string | string[] }>();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;
  const colors = useTheme();
  const isDesktopWeb = useIsDesktopWeb();
  const hasDesktopSidebar = useIsDesktopSidebarVisible();
  const showCompactNav = !hasDesktopSidebar;
  const mainStyles = useMainScreenStyles();
  const styles = useThemedStyles((theme) => createLocalStyles(theme, isDesktopWeb));
  const { width } = useWindowDimensions();
  const { getById, ensureItem, toggleLike, incrementViews, isLoading } = useNews();
  const announcements = useAnnouncementsOptional();
  const item = id ? getById(id) : undefined;
  const [resolving, setResolving] = useState(false);
  const viewedRef = useRef<string | null>(null);
  const resolveAttemptRef = useRef<string | null>(null);

  useEffect(() => {
    if (!id) return;
    if (item) return;
    if (resolveAttemptRef.current === id) return;
    resolveAttemptRef.current = id;
    setResolving(true);
    void ensureItem(id).finally(() => setResolving(false));
  }, [ensureItem, id, item]);

  useEffect(() => {
    if (!id || !item) return;
    if (viewedRef.current === id) return;
    viewedRef.current = id;
    if (!claimAnnouncementView(id)) return;
    void incrementViews(id);
  }, [id, item, incrementViews]);

  // Прочтение в ленте: ≥2 с на странице новости.
  useEffect(() => {
    if (!item?.id || item.publicationVersion < 1) return;
    const markRead = announcements?.markAnnouncementRead;
    if (!markRead) return;
    const timer = setTimeout(() => {
      markRead(item.id, item.publicationVersion);
    }, ANNOUNCEMENT_READ_DWELL_MS);
    return () => clearTimeout(timer);
  }, [announcements?.markAnnouncementRead, item?.id, item?.publicationVersion]);

  const html = useMemo(() => {
    const raw = item?.body?.trim() ?? '';
    if (!raw) return '';
    return looksLikeHtml(raw) ? raw : plainToHtml(raw);
  }, [item?.body]);

  const tagsStyles = useMemo(
    () => ({
      body: {
        color: colors.textSecondary,
        fontSize: FontSize.label,
        lineHeight: FontSize.label * 1.55,
        margin: 0,
      },
      p: { marginTop: 0, marginBottom: Spacing.sm },
      a: { color: colors.primary },
      strong: { color: colors.text, fontWeight: '700' as const },
      em: { fontStyle: 'italic' as const },
      ul: { marginBottom: Spacing.sm, paddingLeft: 20 },
      ol: { marginBottom: Spacing.sm, paddingLeft: 20 },
      li: { marginBottom: 4 },
    }),
    [colors.primary, colors.text, colors.textSecondary],
  );

  const contentWidth = Math.min(width - Spacing.md * 2, DESKTOP_CONTENT_MAX);

  if ((!item || !id) && (isLoading || resolving)) {
    return (
      <ScreenTransition animateOnFocus>
        <View style={[mainStyles.container, styles.empty]}>
          <ActivityIndicator color={colors.primary} />
          <Text style={styles.emptyText}>Загружаем новость…</Text>
        </View>
      </ScreenTransition>
    );
  }

  if (!item || !id) {
    return (
      <ScreenTransition animateOnFocus>
        <View style={mainStyles.container}>
          <View style={[mainStyles.content, styles.shell]}>
            <View style={styles.headerRow}>
              <MobileBackButton fallbackHref="/news" />
              <Text style={styles.pageTitle}>Новость</Text>
            </View>
            <View style={styles.empty}>
              <Text style={styles.missingTitle}>Новость не найдена</Text>
              <Text style={styles.emptyText}>Возможно, её сняли с публикации</Text>
            </View>
          </View>
        </View>
      </ScreenTransition>
    );
  }

  const dateLabel = formatNewsDate(item.publishedAt);
  const showCta = Boolean(item.actionLabel && item.actionUrl);

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
                title="Новость"
                leftAction={<MobileBackButton fallbackHref="/news" />}
              />
            </View>
          ) : (
            <View style={styles.headerBlock}>
              <View style={styles.headerRow}>
                <MobileBackButton fallbackHref="/news" />
                <Text style={styles.pageTitle} numberOfLines={1}>
                  Новости
                </Text>
              </View>
            </View>
          )}

          {item.imageUrl ? (
            <View style={styles.cover}>
              <FadeInImage
                uri={item.imageUrl}
                style={styles.coverImage}
                contentFit="cover"
              />
            </View>
          ) : null}

          <Text style={styles.title}>{item.title}</Text>

          <View style={styles.metaRow}>
            {item.unread ? (
              <View style={styles.newBadge} accessibilityLabel="Новая новость">
                <View style={styles.newBadgeDot} />
                <Text style={styles.newBadgeText}>Новая</Text>
              </View>
            ) : null}
            {dateLabel ? (
              <View style={styles.metaChip}>
                <Ionicons name="calendar-outline" size={14} color={colors.textMuted} />
                <Text style={styles.metaChipText}>{dateLabel}</Text>
              </View>
            ) : null}
            <View style={styles.metaChip}>
              <Ionicons name="eye-outline" size={14} color={colors.textMuted} />
              <Text style={styles.metaChipText}>{item.views}</Text>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={item.liked ? 'Убрать лайк' : 'Поставить лайк'}
              onPress={() => {
                void toggleLike(item.id);
              }}
              style={({ pressed }) => [
                styles.metaChip,
                styles.actionLike,
                item.liked && styles.actionLikeOn,
                pressed && { opacity: 0.88 },
              ]}>
              <Ionicons
                name={item.liked ? 'heart' : 'heart-outline'}
                size={14}
                color={colors.destructive}
              />
              <Text style={[styles.metaChipText, styles.actionLikeText]}>{item.likes}</Text>
            </Pressable>
          </View>

          {html ? (
            <RenderHTML
              contentWidth={contentWidth}
              source={{ html }}
              systemFonts={defaultSystemFonts}
              tagsStyles={tagsStyles}
              baseStyle={tagsStyles.body}
            />
          ) : null}

          {showCta ? (
            <Pressable
              accessibilityRole="link"
              accessibilityLabel={item.actionLabel ?? 'Открыть ссылку'}
              onPress={() => {
                if (item.actionUrl) {
                  void Linking.openURL(item.actionUrl).catch(() => undefined);
                }
              }}
              style={({ pressed }) => [styles.cta, pressed && { opacity: 0.9 }]}>
              <Text style={styles.ctaText}>{item.actionLabel}</Text>
            </Pressable>
          ) : null}
        </View>
      </ScrollView>
    </ScreenTransition>
  );
}
