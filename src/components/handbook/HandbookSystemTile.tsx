import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { FadeInImage } from '@/components/ui/media/FadeInImage';
import type { HandbookSystem } from '@/data/handbook/types';
import { FontSize, Radius, Spacing, type ThemeColors } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useThemedStyles } from '@/hooks/use-themed-styles';

type HandbookSystemTileProps = {
  system: HandbookSystem;
  onPress: () => void;
  /**
   * `portrait` — сетка на десктопе.
   * `banner` — полноширинная карточка на телефоне.
   */
  layout?: 'portrait' | 'banner';
};

function hexToRgba(hex: string, alpha: number): string {
  const raw = hex.replace('#', '');
  const full =
    raw.length === 3
      ? raw
          .split('')
          .map((c) => c + c)
          .join('')
      : raw;
  const n = Number.parseInt(full, 16);
  if (Number.isNaN(n)) return `rgba(0,0,0,${alpha})`;
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return `rgba(${r},${g},${b},${alpha})`;
}

function createStyles(colors: ThemeColors, layout: 'portrait' | 'banner') {
  const banner = layout === 'banner';

  return StyleSheet.create({
    card: {
      flex: banner ? undefined : 1,
      width: banner ? '100%' : undefined,
      minWidth: 0,
      borderRadius: banner ? 22 : 18,
      overflow: 'hidden',
      borderWidth: 1,
      borderColor: colors.borderLight,
      backgroundColor: colors.surface,
      ...Platform.select({
        web: {
          cursor: 'pointer',
          transitionProperty: 'transform, box-shadow, border-color',
          transitionDuration: '160ms',
          transitionTimingFunction: 'ease-out',
        } as object,
        default: {},
      }),
    },
    cardHovered: {
      transform: [{ scale: banner ? 1.01 : 1.025 }],
      borderColor: 'rgba(21, 122, 254, 0.5)',
      ...Platform.select({
        web: {
          boxShadow: '0 12px 28px rgba(15, 23, 42, 0.24)',
          zIndex: 2,
        } as object,
        default: {},
      }),
    },
    cardPressed: {
      opacity: 0.92,
      transform: [{ scale: 0.985 }],
    },
    cover: {
      width: '100%',
      // Ассеты ~4:5; широкий баннер обрезал логотип D&D сверху.
      aspectRatio: banner ? 4 / 5 : 3 / 4,
      overflow: 'hidden',
      backgroundColor: colors.surfaceMuted,
      position: 'relative',
    },
    coverImage: {
      ...StyleSheet.absoluteFillObject,
    },
    coverShield: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: banner ? 'rgba(0,0,0,0.08)' : 'rgba(0,0,0,0.12)',
    },
    coverGradient: {
      ...StyleSheet.absoluteFillObject,
      ...Platform.select({
        web: {
          backgroundImage: banner
            ? 'linear-gradient(to top, rgba(0,0,0,0.82) 0%, rgba(0,0,0,0.32) 48%, rgba(0,0,0,0.08) 78%)'
            : 'linear-gradient(to top, rgba(0,0,0,0.78) 0%, rgba(0,0,0,0.28) 42%, rgba(0,0,0,0) 72%)',
        } as object,
        default: {
          backgroundColor: 'rgba(0,0,0,0.22)',
        },
      }),
    },
    coverGradientNativeBase: {
      ...StyleSheet.absoluteFillObject,
      top: '45%',
      backgroundColor: 'rgba(0,0,0,0.58)',
    },
    coverGradientNativeMid: {
      ...StyleSheet.absoluteFillObject,
      top: '28%',
      height: '28%',
      backgroundColor: 'rgba(0,0,0,0.22)',
    },
    accentBar: {
      position: 'absolute',
      left: 0,
      right: 0,
      bottom: 0,
      height: banner ? 4 : 3,
    },
    badge: {
      position: 'absolute',
      top: banner ? Spacing.md : Spacing.sm + 2,
      left: banner ? Spacing.md : Spacing.sm + 2,
      paddingHorizontal: 10,
      minHeight: 26,
      borderRadius: Radius.pill,
      borderWidth: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },
    badgeText: {
      fontSize: 11,
      fontWeight: '700',
      letterSpacing: 0.2,
    },
    body: {
      position: 'absolute',
      left: 0,
      right: 0,
      bottom: 0,
      paddingHorizontal: banner ? Spacing.md + 2 : 14,
      paddingBottom: banner ? Spacing.md + 2 : 14,
      paddingTop: banner ? 28 : 24,
      gap: banner ? 6 : 4,
    },
    name: {
      fontSize: banner ? 22 : FontSize.button,
      fontWeight: '700',
      color: '#FFFFFF',
      letterSpacing: -0.4,
      lineHeight: (banner ? 22 : FontSize.button) * 1.2,
    },
    tagline: {
      fontSize: banner ? FontSize.label : FontSize.caption,
      fontWeight: '500',
      color: 'rgba(255,255,255,0.88)',
      lineHeight: (banner ? FontSize.label : FontSize.caption) * 1.4,
      maxWidth: banner ? '92%' : undefined,
    },
  });
}

export function HandbookSystemTile({
  system,
  onPress,
  layout = 'portrait',
}: HandbookSystemTileProps) {
  const colors = useTheme();
  const styles = useThemedStyles((theme) => createStyles(theme, layout));
  const badgeBg = hexToRgba(system.accent, 0.92);
  const badgeBorder = hexToRgba(system.accent, 1);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Библиотека ${system.name}`}
      onPress={onPress}
      style={({ pressed, hovered }: { pressed: boolean; hovered?: boolean }) => [
        styles.card,
        hovered && !pressed && styles.cardHovered,
        pressed && styles.cardPressed,
      ]}>
      <View style={styles.cover}>
        <FadeInImage
          source={system.coverSource}
          uri={system.coverUrl}
          style={styles.coverImage}
          contentFit="cover"
          contentPosition="top"
          pointerEvents="none"
        />
        <View pointerEvents="none" style={styles.coverShield} />
        <View pointerEvents="none" style={styles.coverGradient}>
          {Platform.OS !== 'web' ? (
            <>
              <View style={styles.coverGradientNativeMid} />
              <View style={styles.coverGradientNativeBase} />
            </>
          ) : null}
        </View>

        {system.isOfficial ? (
          <View
            style={[
              styles.badge,
              {
                backgroundColor: badgeBg,
                borderColor: badgeBorder,
              },
            ]}>
            <Text style={[styles.badgeText, { color: colors.onPrimary }]}>Официальная</Text>
          </View>
        ) : null}

        <View style={styles.body} pointerEvents="none">
          <Text style={styles.name} numberOfLines={2}>
            {system.shortName}
          </Text>
          <Text style={styles.tagline} numberOfLines={2}>
            {system.tagline}
          </Text>
        </View>

        <View
          pointerEvents="none"
          style={[styles.accentBar, { backgroundColor: system.accent }]}
        />
      </View>
    </Pressable>
  );
}
