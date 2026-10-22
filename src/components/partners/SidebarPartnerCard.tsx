import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
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
  getPartnersCache,
  getSidebarPartnersCache,
  listPartners,
  listSidebarPartners,
} from '@/services/partners/partnersApi';

const ROTATE_MS = 4_000;
const RESUME_DELAY_MS = 600;
const FADE_OUT_MS = 140;
const FADE_IN_MS = 200;
const SHIFT_PX = 4;
const LOGO_SIZE = 38;
/** Лого + название (до 2 строк) + слоган в одну строку. */
const CONTENT_MIN_HEIGHT = 44;

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
  });
}

export function SidebarPartnerCard() {
  const colors = useTheme();
  const styles = useThemedStyles(createStyles);
  const [partners, setPartners] = useState<Partner[]>(
    () => getSidebarPartnersCache() ?? getPartnersCache() ?? [],
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
      let rows = await listSidebarPartners({ force: true });
      // Нет галочки «в сайдбаре» — всё равно показываем активных, блок не должен пропадать.
      if (!rows.length) {
        rows = await listPartners({ force: true });
      }
      if (!alive) return;
      const currentId = partnersRef.current[indexRef.current]?.id;
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

  if (!partner) return null;

  const accent = partner.accent || colors.primary;
  const tagline = partnerTagline(partner);
  const a11yHint = tagline
    ? `${tagline}. Открывает сайт партнёра в новой вкладке`
    : 'Открывает сайт партнёра в новой вкладке';

  return (
    <View style={[styles.root, hovered && styles.rootHovered, focused && styles.rootFocused]}>
      <Pressable
        accessibilityRole="link"
        accessibilityLabel={`Наши партнёры: ${partner.name}`}
        accessibilityHint={a11yHint}
        accessibilityLiveRegion="none"
        onPress={() => openPartnerUrl(partner.href)}
        onHoverIn={Platform.OS === 'web' ? () => setHovered(true) : undefined}
        onHoverOut={Platform.OS === 'web' ? () => setHovered(false) : undefined}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        {...(Platform.OS === 'web' && tagline
          ? ({ title: tagline } as object)
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

        <Animated.View style={[styles.content, animatedContentStyle]}>
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
          </View>
        </Animated.View>
      </Pressable>
    </View>
  );
}
