import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  Linking,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import type { Partner } from '@/data/partners/partners';
import { type ThemeColors } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useThemedStyles } from '@/hooks/use-themed-styles';
import {
  getPartnerNewsCache,
  getPartnersCache,
  getSidebarPartnersCache,
  listPartnerNews,
  listPartners,
  listSidebarPartners,
  trackPartnerNews,
  type PartnerNews,
} from '@/services/partners/partnersApi';

const ROTATE_MS = 4_000;
const RESUME_DELAY_MS = 600;
const FADE_OUT_MS = 140;
const FADE_IN_MS = 200;
const SHIFT_PX = 4;
const LOGO_SIZE = 38;
/** Лого + название (до 2 строк) + слоган в одну строку. */
const CONTENT_MIN_HEIGHT = 44;
/** Имя партнёра + заголовок новости в две строки: держим высоту, чтобы карточка не прыгала. */
const NEWS_CONTENT_MIN_HEIGHT = 50;

/** Партнёры со свежей новостью идут в ротации первыми, порядок внутри групп сохраняется. */
function newsFirst(partners: Partner[], newsByPartner: Map<string, PartnerNews>): Partner[] {
  return [
    ...partners.filter((partner) => newsByPartner.has(partner.id)),
    ...partners.filter((partner) => !newsByPartner.has(partner.id)),
  ];
}

function indexNews(rows: PartnerNews[] | null): Map<string, PartnerNews> {
  return new Map((rows ?? []).map((row) => [row.partnerId, row]));
}

function partnerTagline(partner: Partner): string | null {
  const tagline = partner.tagline?.trim() ?? '';
  return tagline || null;
}

function openPartnerUrl(href: string) {
  const url = href.trim();
  if (!url) return;
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    window.open(url, '_blank', 'noopener,noreferrer');
    return;
  }
  void Linking.openURL(url).catch(() => undefined);
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    root: {
      position: 'relative',
      borderRadius: 12,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      backgroundColor: colors.surfaceMuted,
      overflow: 'hidden',
    },
    rootHovered: {
      borderColor: colors.primary,
      backgroundColor: colors.surface,
    },
    rootFocused: {
      borderColor: colors.primary,
      borderWidth: 1,
    },
    pressable: {
      paddingHorizontal: 10,
      paddingVertical: 8,
      gap: 6,
    },
    pressed: {
      opacity: 0.9,
    },
    eyebrowRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    eyebrowLeft: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      minWidth: 0,
    },
    eyebrow: {
      flexShrink: 1,
      fontSize: 9,
      fontWeight: '600',
      letterSpacing: 0.5,
      textTransform: 'uppercase',
      color: colors.textMuted,
    },
    content: {
      minHeight: CONTENT_MIN_HEIGHT,
      justifyContent: 'center',
    },
    body: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },
    logo: {
      width: LOGO_SIZE,
      height: LOGO_SIZE,
      borderRadius: 8,
      backgroundColor: colors.surface,
    },
    mark: {
      width: LOGO_SIZE,
      height: LOGO_SIZE,
      borderRadius: 8,
      alignItems: 'center',
      justifyContent: 'center',
    },
    markText: {
      fontSize: 12,
      fontWeight: '700',
      color: '#FFFFFF',
      letterSpacing: 0.2,
    },
    textCol: {
      flex: 1,
      minWidth: 0,
      gap: 1,
      justifyContent: 'center',
    },
    name: {
      fontSize: 13,
      fontWeight: '500',
      color: colors.text,
      letterSpacing: -0.1,
      lineHeight: 17,
    },
    tagline: {
      fontSize: 11,
      fontWeight: '400',
      color: colors.textSecondary,
      lineHeight: 14,
    },
    contentNews: {
      minHeight: NEWS_CONTENT_MIN_HEIGHT,
    },
    newsChip: {
      flexShrink: 0,
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: 999,
      backgroundColor: 'rgba(21, 122, 254, 0.12)',
    },
    newsChipText: {
      fontSize: 9,
      fontWeight: '700',
      letterSpacing: 0.4,
      textTransform: 'uppercase',
      color: colors.primary,
    },
    newsMeta: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      minWidth: 0,
    },
    newsPartner: {
      flexShrink: 1,
      fontSize: 11,
      fontWeight: '600',
      color: colors.textSecondary,
      lineHeight: 14,
    },
    newsTitle: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.text,
      letterSpacing: -0.1,
      lineHeight: 17,
    },
  });
}

export function SidebarPartnerCard() {
  const colors = useTheme();
  const styles = useThemedStyles(createStyles);
  const [newsByPartner, setNewsByPartner] = useState(() => indexNews(getPartnerNewsCache()));
  const [partners, setPartners] = useState<Partner[]>(() =>
    newsFirst(getSidebarPartnersCache() ?? getPartnersCache() ?? [], newsByPartner),
  );
  const [index, setIndex] = useState(0);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const [reduceMotion, setReduceMotion] = useState(false);

  const partnersRef = useRef(partners);
  const indexRef = useRef(index);
  const animatingRef = useRef(false);
  const resumeFromPauseRef = useRef(false);
  const paused = hovered || focused;

  partnersRef.current = partners;
  indexRef.current = index;

  const opacity = useSharedValue(1);
  const translateY = useSharedValue(0);

  const animatedContentStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }],
  }));

  useEffect(() => {
    let mounted = true;
    void AccessibilityInfo.isReduceMotionEnabled().then((enabled) => {
      if (mounted) setReduceMotion(enabled);
    });
    const sub = AccessibilityInfo.addEventListener?.(
      'reduceMotionChanged',
      setReduceMotion,
    );
    return () => {
      mounted = false;
      sub?.remove?.();
    };
  }, []);

  useEffect(() => {
    let alive = true;
    void (async () => {
      const newsPromise = listPartnerNews({ force: true });
      let rows = await listSidebarPartners({ force: true });
      // Нет галочки «в сайдбаре» — всё равно показываем активных, блок не должен пропадать.
      if (!rows.length) {
        rows = await listPartners({ force: true });
      }
      const news = indexNews(await newsPromise);
      if (!alive) return;
      // Свежая новость выводит партнёра в ротацию, даже если он не отмечен «в сайдбаре».
      const known = new Set(rows.map((row) => row.id));
      const fromNews: Partner[] = [...news.values()]
        .filter((item) => !known.has(item.partnerId))
        .map((item) => ({
          id: item.partner.id,
          name: item.partner.name,
          href: item.partner.href,
          mark: item.partner.name,
          accent: item.partner.accent,
          logoUrl: item.partner.logoUrl,
        }));
      rows = newsFirst([...rows, ...fromNews], news);
      const currentId = partnersRef.current[indexRef.current]?.id;
      setNewsByPartner(news);
      setPartners(rows);
      if (!rows.length) {
        setIndex(0);
        return;
      }
      if (currentId) {
        const found = rows.findIndex((row) => row.id === currentId);
        setIndex(found >= 0 ? found : 0);
        return;
      }
      setIndex(0);
    })();
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (paused) {
      resumeFromPauseRef.current = true;
    }
  }, [paused]);

  const clearAnimating = useCallback(() => {
    animatingRef.current = false;
  }, []);

  const applyIndex = useCallback((next: number) => {
    setIndex(next);
  }, []);

  const goToIndex = useCallback(
    (nextIndex: number) => {
      if (nextIndex === indexRef.current) return;
      if (reduceMotion) {
        setIndex(nextIndex);
        opacity.value = 1;
        translateY.value = 0;
        return;
      }
      if (animatingRef.current) return;
      animatingRef.current = true;

      opacity.value = withTiming(
        0,
        { duration: FADE_OUT_MS, easing: Easing.out(Easing.quad) },
        (finished) => {
          if (!finished) {
            runOnJS(clearAnimating)();
            return;
          }
          runOnJS(applyIndex)(nextIndex);
          translateY.value = SHIFT_PX;
          opacity.value = withTiming(1, {
            duration: FADE_IN_MS,
            easing: Easing.out(Easing.cubic),
          });
          translateY.value = withTiming(
            0,
            { duration: FADE_IN_MS, easing: Easing.out(Easing.cubic) },
            () => {
              runOnJS(clearAnimating)();
            },
          );
        },
      );
    },
    [applyIndex, clearAnimating, opacity, reduceMotion, translateY],
  );

  const advance = useCallback(() => {
    const list = partnersRef.current;
    if (list.length < 2) return;
    goToIndex((indexRef.current + 1) % list.length);
  }, [goToIndex]);

  useEffect(() => {
    if (partners.length < 2 || paused) return;

    const delay = resumeFromPauseRef.current ? RESUME_DELAY_MS : 0;
    resumeFromPauseRef.current = false;

    let intervalId: ReturnType<typeof setInterval> | null = null;
    const delayId = setTimeout(() => {
      intervalId = setInterval(advance, ROTATE_MS);
    }, delay);

    return () => {
      clearTimeout(delayId);
      if (intervalId) clearInterval(intervalId);
    };
  }, [advance, partners.length, paused]);

  const partner = partners[index] ?? partners[0] ?? null;
  const news = partner ? (newsByPartner.get(partner.id) ?? null) : null;
  const newsId = news?.id ?? null;

  useEffect(() => {
    if (newsId) trackPartnerNews(newsId, 'view');
  }, [newsId]);

  if (!partner) return null;

  const accent = partner.accent || colors.primary;
  const tagline = partnerTagline(partner);
  const a11yHint = news
    ? 'Открывает новость партнёра'
    : tagline
      ? `${tagline}. Открывает сайт партнёра в новой вкладке`
      : 'Открывает сайт партнёра в новой вкладке';
  const hoverTitle = news?.title ?? tagline;
  const onPress = () => {
    if (news) {
      router.push({ pathname: '/news/partner/[id]', params: { id: news.id } });
      return;
    }
    openPartnerUrl(partner.href);
  };

  return (
    <View style={[styles.root, hovered && styles.rootHovered, focused && styles.rootFocused]}>
      <Pressable
        accessibilityRole="link"
        accessibilityLabel={
          news
            ? `Новость партнёра ${partner.name}: ${news.title}`
            : `Наши партнёры: ${partner.name}`
        }
        accessibilityHint={a11yHint}
        accessibilityLiveRegion="none"
        onPress={onPress}
        onHoverIn={Platform.OS === 'web' ? () => setHovered(true) : undefined}
        onHoverOut={Platform.OS === 'web' ? () => setHovered(false) : undefined}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        {...(Platform.OS === 'web' && hoverTitle
          ? ({ title: hoverTitle } as object)
          : null)}
        style={({ pressed }) => [styles.pressable, pressed && styles.pressed]}>
        <View style={styles.eyebrowRow}>
          <View style={styles.eyebrowLeft}>
            <Ionicons name="sparkles" size={10} color={colors.primary} />
            <Text style={styles.eyebrow} numberOfLines={1}>
              Наши партнёры
            </Text>
          </View>
        </View>

        <Animated.View
          style={[
            styles.content,
            newsByPartner.size > 0 && styles.contentNews,
            animatedContentStyle,
          ]}>
          <View style={styles.body}>
            {partner.logoUrl ? (
              <Image
                source={{ uri: partner.logoUrl }}
                style={styles.logo}
                contentFit="contain"
                accessibilityIgnoresInvertColors
              />
            ) : (
              <View style={[styles.mark, { backgroundColor: accent }]}>
                <Text style={styles.markText}>
                  {(partner.mark || partner.name).slice(0, 2).toUpperCase()}
                </Text>
              </View>
            )}
            {news ? (
              <View style={styles.textCol}>
                <View style={styles.newsMeta}>
                  <View style={styles.newsChip}>
                    <Text style={styles.newsChipText}>Новость</Text>
                  </View>
                  <Text style={styles.newsPartner} numberOfLines={1}>
                    {partner.name}
                  </Text>
                </View>
                <Text style={styles.newsTitle} numberOfLines={2}>
                  {news.title}
                </Text>
              </View>
            ) : (
              <View style={styles.textCol}>
                <Text style={styles.name} numberOfLines={2}>
                  {partner.name}
                </Text>
                {tagline ? (
                  <Text style={styles.tagline} numberOfLines={3}>
                    {tagline}
                  </Text>
                ) : null}
              </View>
            )}
          </View>
        </Animated.View>
      </Pressable>
    </View>
  );
}
