import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useRef } from 'react';
import {
  Dimensions,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { FadeInImage } from '@/components/ui/media/FadeInImage';
import { FontSize, type ThemeColors } from '@/constants/theme';
import {
  ANNOUNCEMENT_READ_DWELL_MS,
  useAnnouncementsOptional,
} from '@/context/AnnouncementContext';
import { useTheme } from '@/hooks/use-theme';
import { useThemedStyles } from '@/hooks/use-themed-styles';
import type { NewsItem } from '@/services/news/newsApi';
import { authorContentExcerpt } from '@/utils/authors-format';

type NewsCardProps = {
  item: NewsItem;
  onToggleLike?: (id: string) => void;
  /** Called once per session when the card is opened (просмотр). */
  onOpen?: (id: string) => void;
};

export const NEWS_COVER_ASPECT = 16 / 9;

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

function isMostlyVisible(top: number, height: number, windowHeight: number): boolean {
  if (height <= 0) return false;
  const visibleTop = Math.max(0, top);
  const visibleBottom = Math.min(windowHeight, top + height);
  const visible = Math.max(0, visibleBottom - visibleTop);
  return visible / height >= 0.45;
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    card: {
      width: '100%',
      borderRadius: 16,
      overflow: 'hidden',
      borderWidth: 1,
      borderColor: colors.borderLight,
      backgroundColor: colors.surface,
    },
    cardUnread: {
      borderWidth: 2,
      borderColor: 'rgba(255, 59, 48, 0.55)',
      backgroundColor: 'rgba(255, 59, 48, 0.04)',
    },
    cover: {
      width: '100%',
      aspectRatio: NEWS_COVER_ASPECT,
      overflow: 'hidden',
      backgroundColor: colors.surfaceMuted,
    },
    coverImage: {
      ...StyleSheet.absoluteFillObject,
    },
    body: {
      gap: 10,
      paddingHorizontal: 14,
      paddingTop: 14,
      paddingBottom: 14,
    },
    metaRow: {
      flexDirection: 'row',
      alignItems: 'center',
      flexWrap: 'wrap',
      gap: 8,
    },
    dateRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
    },
    dateText: {
      fontSize: 11,
      fontWeight: '600',
      color: colors.primary,
    },
    newBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      paddingLeft: 7,
      paddingRight: 9,
      paddingVertical: 4,
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
      fontSize: 10,
      fontWeight: '800',
      color: colors.onPrimary,
      letterSpacing: 0.6,
      textTransform: 'uppercase',
    },
    title: {
      fontSize: FontSize.button,
      fontWeight: '700',
      color: colors.text,
      lineHeight: FontSize.button * 1.3,
      letterSpacing: -0.2,
    },
    excerpt: {
      fontSize: FontSize.caption,
      color: colors.textSecondary,
      lineHeight: FontSize.caption * 1.5,
    },
    bottomRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 8,
      marginTop: 2,
    },
    readHint: {
      fontSize: FontSize.caption,
      fontWeight: '600',
      color: colors.primary,
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

export function NewsCard({ item, onToggleLike, onOpen }: NewsCardProps) {
  const router = useRouter();
  const colors = useTheme();
  const styles = useThemedStyles(createStyles);
  const announcements = useAnnouncementsOptional();
  const rootRef = useRef<View>(null);
  const excerpt = authorContentExcerpt(item.body, 420);
  const dateLabel = formatNewsDate(item.publishedAt);
  const open = () => {
    onOpen?.(item.id);
    router.push(`/news/${item.id}`);
  };

  // В ленте: ≥2 с в зоне видимости → прочитано (не пока открыта модалка).
  useEffect(() => {
    if (!item.unread || item.publicationVersion < 1) return;
    if (announcements?.isModalVisible) return;
    const markRead = announcements?.markAnnouncementRead;
    if (!markRead) return;

    let visibleSince: number | null = null;
    let fired = false;
    let tick: ReturnType<typeof setInterval> | null = null;
    let observer: IntersectionObserver | null = null;

    const tryFire = () => {
      if (fired || visibleSince == null) return;
      if (Date.now() - visibleSince < ANNOUNCEMENT_READ_DWELL_MS) return;
      fired = true;
      markRead(item.id, item.publicationVersion);
    };

    if (Platform.OS === 'web' && typeof IntersectionObserver !== 'undefined') {
      const node = rootRef.current as unknown as Element | null;
      if (!node) return;

      observer = new IntersectionObserver(
        (entries) => {
          const entry = entries[0];
          const visible = Boolean(
            entry?.isIntersecting && (entry.intersectionRatio ?? 0) >= 0.45,
          );
          if (!visible) {
            visibleSince = null;
            return;
          }
          if (visibleSince == null) visibleSince = Date.now();
        },
        { threshold: [0, 0.45, 0.7, 1] },
      );
      observer.observe(node);
      tick = setInterval(tryFire, 400);
    } else {
      tick = setInterval(() => {
        const view = rootRef.current;
        if (!view) return;
        view.measureInWindow((_x, y, _w, height) => {
          const windowHeight = Dimensions.get('window').height;
          const visible = isMostlyVisible(y, height, windowHeight);
          if (!visible) {
            visibleSince = null;
            return;
          }
          if (visibleSince == null) visibleSince = Date.now();
          tryFire();
        });
      }, 400);
    }

    return () => {
      observer?.disconnect();
      if (tick) clearInterval(tick);
    };
  }, [
    announcements?.isModalVisible,
    announcements?.markAnnouncementRead,
    item.id,
    item.publicationVersion,
    item.unread,
  ]);

  return (
    <View
      ref={rootRef}
      collapsable={false}
      style={[styles.card, item.unread && styles.cardUnread]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={item.unread ? `${item.title}, новая` : item.title}
        onPress={open}
        style={({ pressed }) => [pressed && { opacity: 0.94 }]}>
        {item.imageUrl ? (
          <View style={styles.cover}>
            <FadeInImage uri={item.imageUrl} style={styles.coverImage} contentFit="cover" />
          </View>
        ) : null}
        <View style={styles.body}>
          {dateLabel || item.unread ? (
            <View style={styles.metaRow}>
              {item.unread ? (
                <View style={styles.newBadge} accessibilityLabel="Новая новость">
                  <View style={styles.newBadgeDot} />
                  <Text style={styles.newBadgeText}>Новая</Text>
                </View>
              ) : null}
              {dateLabel ? (
                <View style={styles.dateRow}>
                  <Ionicons name="calendar-outline" size={12} color={colors.primary} />
                  <Text style={styles.dateText}>{dateLabel}</Text>
                </View>
              ) : null}
            </View>
          ) : null}
          <Text style={styles.title} numberOfLines={3}>
            {item.title}
          </Text>
          {excerpt ? (
            <Text style={styles.excerpt} numberOfLines={10}>
              {excerpt}
            </Text>
          ) : null}
        </View>
      </Pressable>

      <View style={[styles.body, { paddingTop: 0 }]}>
        <View style={styles.bottomRow}>
          <Pressable onPress={open} hitSlop={6}>
            <Text style={styles.readHint}>Читать</Text>
          </Pressable>
          <View style={styles.stats}>
            <View style={styles.stat} accessibilityLabel={`Просмотры: ${item.views}`}>
              <Ionicons name="eye-outline" size={14} color={colors.textMuted} />
              <Text style={styles.statText}>{item.views}</Text>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={item.liked ? 'Убрать лайк' : 'Поставить лайк'}
              hitSlop={8}
              onPress={() => onToggleLike?.(item.id)}
              style={styles.stat}>
              <Ionicons
                name={item.liked ? 'heart' : 'heart-outline'}
                size={14}
                color={item.liked ? colors.destructive : colors.textMuted}
              />
              <Text
                style={[styles.statText, item.liked && { color: colors.destructive }]}>
                {item.likes}
              </Text>
            </Pressable>
          </View>
        </View>
      </View>
    </View>
  );
}
