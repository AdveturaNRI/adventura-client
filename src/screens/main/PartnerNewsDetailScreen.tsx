import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import {
  useIsDesktopSidebarVisible,
  useIsDesktopWeb,
} from '@/components/navigation/DesktopThemeToggle';
import { MobileBackButton } from '@/components/navigation/MobileBackButton';
import { MobileScreenHeader } from '@/components/navigation/MobileScreenHeader';
import { ScreenTransition } from '@/components/navigation/ScreenTransition';
import { FadeInImage } from '@/components/ui/media/FadeInImage';
import { FontSize, Spacing, type ThemeColors } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useThemedStyles } from '@/hooks/use-themed-styles';
import {
  getPartnerNews,
  trackPartnerNews,
  type PartnerNews,
} from '@/services/partners/partnersApi';

import { useMainScreenStyles } from './main-screen.styles';

const DESKTOP_CONTENT_MAX = 760;
const DESKTOP_IMAGE_MAX_HEIGHT = 380;
const LOGO_SIZE = 40;

function formatDate(iso: string | null): string {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('ru-RU', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

function openExternal(href: string) {
  const url = href.trim();
  if (!url) return;
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    window.open(url, '_blank', 'noopener,noreferrer');
    return;
  }
  void Linking.openURL(url).catch(() => undefined);
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
      position: 'absolute',
      top: 0,
      right: 0,
      bottom: 0,
      left: 0,
    },
    partnerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },
    logo: {
      width: LOGO_SIZE,
      height: LOGO_SIZE,
      borderRadius: 10,
      backgroundColor: colors.surface,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.borderLight,
    },
    mark: {
      width: LOGO_SIZE,
      height: LOGO_SIZE,
      borderRadius: 10,
      alignItems: 'center',
      justifyContent: 'center',
    },
    markText: {
      fontSize: 13,
      fontWeight: '700',
      color: '#FFFFFF',
    },
    partnerText: {
      flex: 1,
      minWidth: 0,
      gap: 2,
    },
    partnerName: {
      fontSize: FontSize.label,
      fontWeight: '700',
      color: colors.text,
    },
    partnerDate: {
      fontSize: FontSize.caption,
      color: colors.textSecondary,
    },
    sponsoredChip: {
      flexDirection: 'row',
      alignItems: 'center',
      alignSelf: 'flex-start',
      gap: 5,
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: 999,
      backgroundColor: 'rgba(21, 122, 254, 0.1)',
    },
    sponsoredChipText: {
      fontSize: 11,
      fontWeight: '700',
      letterSpacing: 0.4,
      textTransform: 'uppercase',
      color: colors.primary,
    },
    body: {
      gap: Spacing.sm,
    },
    paragraph: {
      fontSize: FontSize.label,
      lineHeight: FontSize.label * 1.55,
      color: colors.textSecondary,
    },
    cta: {
      alignSelf: 'flex-start',
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      minHeight: 44,
      paddingHorizontal: 16,
      borderRadius: 12,
      backgroundColor: colors.primary,
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

type LoadState =
  | { status: 'loading' }
  | { status: 'ready'; item: PartnerNews }
  | { status: 'missing' };

export default function PartnerNewsDetailScreen() {
  const params = useLocalSearchParams<{ id?: string | string[] }>();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;
  const colors = useTheme();
  const isDesktopWeb = useIsDesktopWeb();
  const showCompactNav = !useIsDesktopSidebarVisible();
  const mainStyles = useMainScreenStyles();
  const styles = useThemedStyles((theme) => createLocalStyles(theme, isDesktopWeb));
  const [state, setState] = useState<LoadState>({ status: 'loading' });

  useEffect(() => {
    if (!id) return;
    let alive = true;
    getPartnerNews(id)
      .then((item) => {
        if (alive) setState({ status: 'ready', item });
      })
      .catch(() => {
        if (alive) setState({ status: 'missing' });
      });
    return () => {
      alive = false;
    };
  }, [id]);

  const header = showCompactNav ? (
    <View style={styles.headerBlock}>
      <MobileScreenHeader
        title="Новость партнёра"
        leftAction={<MobileBackButton fallbackHref="/news" />}
      />
    </View>
  ) : (
    <View style={styles.headerBlock}>
      <View style={styles.headerRow}>
        <MobileBackButton fallbackHref="/news" />
        <Text style={styles.pageTitle} numberOfLines={1}>
          Новость партнёра
        </Text>
      </View>
    </View>
  );

  if (id && state.status === 'loading') {
    return (
      <ScreenTransition animateOnFocus>
        <View style={[mainStyles.container, styles.empty]}>
          <ActivityIndicator color={colors.primary} />
          <Text style={styles.emptyText}>Загружаем новость…</Text>
        </View>
      </ScreenTransition>
    );
  }

  if (!id || state.status !== 'ready') {
    return (
      <ScreenTransition animateOnFocus>
        <View style={mainStyles.container}>
          <View style={[mainStyles.content, styles.shell]}>
            {header}
            <View style={styles.empty}>
              <Text style={styles.missingTitle}>Новость не найдена</Text>
              <Text style={styles.emptyText}>Возможно, партнёр её уже снял</Text>
            </View>
          </View>
        </View>
      </ScreenTransition>
    );
  }

  const { item } = state;
  const { partner } = item;
  const ctaUrl = item.actionUrl || partner.href;
  const ctaLabel = item.actionLabel?.trim() || 'Подробнее на сайте';
  const paragraphs = item.body
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean);
  const dateLabel = formatDate(item.publishedAt);

  return (
    <ScreenTransition animateOnFocus>
      <ScrollView
        style={mainStyles.scroll}
        contentContainerStyle={mainStyles.content}
        showsVerticalScrollIndicator={false}>
        <View style={styles.shell}>
          {header}

          {item.coverUrl ? (
            <View style={styles.cover}>
              <FadeInImage uri={item.coverUrl} style={styles.coverImage} contentFit="cover" />
            </View>
          ) : null}

          <View style={styles.sponsoredChip}>
            <Ionicons name="sparkles" size={11} color={colors.primary} />
            <Text style={styles.sponsoredChipText}>Партнёрский материал</Text>
          </View>

          <Text style={styles.title} selectable>
            {item.title}
          </Text>

          <View style={styles.partnerRow}>
            {partner.logoUrl ? (
              <Image
                source={{ uri: partner.logoUrl }}
                style={styles.logo}
                contentFit="contain"
                accessibilityIgnoresInvertColors
              />
            ) : (
              <View style={[styles.mark, { backgroundColor: partner.accent || colors.primary }]}>
                <Text style={styles.markText}>{partner.name.slice(0, 2).toUpperCase()}</Text>
              </View>
            )}
            <View style={styles.partnerText}>
              <Text style={styles.partnerName} numberOfLines={1}>
                {partner.name}
              </Text>
              {dateLabel ? <Text style={styles.partnerDate}>{dateLabel}</Text> : null}
            </View>
          </View>

          {paragraphs.length ? (
            <View style={styles.body}>
              {paragraphs.map((paragraph, index) => (
                <Text key={index} style={styles.paragraph} selectable>
                  {paragraph}
                </Text>
              ))}
            </View>
          ) : null}

          {ctaUrl ? (
            <Pressable
              accessibilityRole="link"
              accessibilityLabel={ctaLabel}
              accessibilityHint="Открывает сайт партнёра"
              onPress={() => {
                trackPartnerNews(item.id, 'click');
                openExternal(ctaUrl);
              }}
              style={({ pressed }) => [styles.cta, pressed && { opacity: 0.9 }]}>
              <Text style={styles.ctaText}>{ctaLabel}</Text>
              <Ionicons name="open-outline" size={16} color={colors.onPrimary} />
            </Pressable>
          ) : null}
        </View>
      </ScrollView>
    </ScreenTransition>
  );
}
