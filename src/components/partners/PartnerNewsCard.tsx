import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { NEWS_COVER_ASPECT } from '@/components/news/NewsCard';
import { FadeInImage } from '@/components/ui/media/FadeInImage';
import { FontSize, type ThemeColors } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useThemedStyles } from '@/hooks/use-themed-styles';
import type { PartnerNews } from '@/services/partners/partnersApi';
import { authorContentExcerpt } from '@/utils/authors-format';
import { markPartnerNewsSeen } from '@/utils/partner-news-seen-storage';

type PartnerNewsCardProps = {
  item: PartnerNews;
  unread: boolean;
};

const SOURCE_LOGO = 20;

function formatDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' });
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
      padding: 14,
    },
    metaRow: {
      flexDirection: 'row',
      alignItems: 'center',
      flexWrap: 'wrap',
      gap: 8,
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
    source: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      flexShrink: 1,
      minWidth: 0,
    },
    sourceLogo: {
      width: SOURCE_LOGO,
      height: SOURCE_LOGO,
      borderRadius: 5,
      backgroundColor: colors.surfaceMuted,
    },
    sourceMark: {
      width: SOURCE_LOGO,
      height: SOURCE_LOGO,
      borderRadius: 5,
      alignItems: 'center',
      justifyContent: 'center',
    },
    sourceMarkText: {
      fontSize: 8,
      fontWeight: '800',
      color: '#FFFFFF',
    },
    sourceName: {
      flexShrink: 1,
      fontSize: 12,
      fontWeight: '700',
      color: colors.primary,
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
    readHint: {
      fontSize: FontSize.caption,
      fontWeight: '600',
      color: colors.primary,
    },
  });
}

export function PartnerNewsCard({ item, unread }: PartnerNewsCardProps) {
  const router = useRouter();
  const colors = useTheme();
  const styles = useThemedStyles(createStyles);
  const excerpt = authorContentExcerpt(item.body, 420);
  const dateLabel = formatDate(item.publishedAt);
  const accent = item.partner.accent || colors.primary;

  const open = () => {
    void markPartnerNewsSeen(item.id);
    router.push({ pathname: '/news/partner/[id]', params: { id: item.id } });
  };

  return (
    <View style={[styles.card, unread && styles.cardUnread]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${item.partner.name}: ${item.title}${unread ? ', новая' : ''}`}
        onPress={open}
        style={({ pressed }) => [pressed && { opacity: 0.94 }]}>
        {item.coverUrl ? (
          <View style={styles.cover}>
            <FadeInImage uri={item.coverUrl} style={styles.coverImage} contentFit="cover" />
          </View>
        ) : null}
        <View style={styles.body}>
          <View style={styles.metaRow}>
            {unread ? (
              <View style={styles.newBadge}>
                <View style={styles.newBadgeDot} />
                <Text style={styles.newBadgeText}>Новая</Text>
              </View>
            ) : null}
            <View style={styles.source}>
              {item.partner.logoUrl ? (
                <Image
                  source={{ uri: item.partner.logoUrl }}
                  style={styles.sourceLogo}
                  contentFit="contain"
                  accessibilityIgnoresInvertColors
                />
              ) : (
                <View style={[styles.sourceMark, { backgroundColor: accent }]}>
                  <Text style={styles.sourceMarkText}>
                    {item.partner.name.slice(0, 2).toUpperCase()}
                  </Text>
                </View>
              )}
              <Text style={styles.sourceName} numberOfLines={1}>
                {item.partner.name}
              </Text>
            </View>
            {dateLabel ? (
              <View style={styles.dateRow}>
                <Ionicons name="calendar-outline" size={12} color={colors.primary} />
                <Text style={styles.dateText}>{dateLabel}</Text>
              </View>
            ) : null}
          </View>
          <Text style={styles.title} numberOfLines={3}>
            {item.title}
          </Text>
          {excerpt ? (
            <Text style={styles.excerpt} numberOfLines={10}>
              {excerpt}
            </Text>
          ) : null}
          <Text style={styles.readHint}>Читать</Text>
        </View>
      </Pressable>
    </View>
  );
}
