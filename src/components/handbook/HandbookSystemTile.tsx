import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { FadeInImage } from '@/components/ui/media/FadeInImage';
import type { HandbookSystem } from '@/data/handbook/types';
import { FontSize, Radius, Spacing, type ThemeColors } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useThemedStyles } from '@/hooks/use-themed-styles';

type HandbookSystemTileProps = {
  system: HandbookSystem;
  entryCount: number;
  onPress: () => void;
  /** Крупнее на десктопе в сетке из 3 колонок */
  compact?: boolean;
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

function createStyles(colors: ThemeColors, compact: boolean) {
  return StyleSheet.create({
    card: {
      flex: 1,
      minWidth: 0,
      borderRadius: compact ? 18 : 20,
      overflow: 'hidden',
      borderWidth: 1,
      borderColor: colors.borderLight,
      backgroundColor: colors.surface,
    },
    cardPressed: {
      opacity: 0.92,
      transform: [{ scale: 0.985 }],
    },
    cover: {
      width: '100%',
      aspectRatio: compact ? 3 / 4 : 4 / 5,
      overflow: 'hidden',
      backgroundColor: colors.surfaceMuted,
      position: 'relative',
    },
    coverImage: {
      ...StyleSheet.absoluteFillObject,
    },
    coverShield: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: 'rgba(0,0,0,0.12)',
    },
    coverGradient: {
      ...StyleSheet.absoluteFillObject,
      ...Platform.select({
        web: {
          backgroundImage:
            'linear-gradient(to top, rgba(0,0,0,0.78) 0%, rgba(0,0,0,0.28) 42%, rgba(0,0,0,0) 72%)',
        } as object,
        default: {
          backgroundColor: 'rgba(0,0,0,0.22)',
        },
      }),
    },
    coverGradientNativeBase: {
      ...StyleSheet.absoluteFillObject,
      top: '50%',
      backgroundColor: 'rgba(0,0,0,0.55)',
    },
    coverGradientNativeMid: {
      ...StyleSheet.absoluteFillObject,
      top: '32%',
      height: '28%',
      backgroundColor: 'rgba(0,0,0,0.22)',
    },
    accentBar: {
      position: 'absolute',
      left: 0,
      right: 0,
      bottom: 0,
      height: 3,
    },
    badge: {
      position: 'absolute',
      top: Spacing.sm + 2,
      left: Spacing.sm + 2,
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
      paddingHorizontal: compact ? 14 : 16,
      paddingBottom: compact ? 14 : 16,
      paddingTop: 24,
      gap: 4,
    },
    name: {
      fontSize: compact ? FontSize.button : 18,
      fontWeight: '700',
      color: '#FFFFFF',
      letterSpacing: -0.3,
      lineHeight: (compact ? FontSize.button : 18) * 1.25,
    },
    tagline: {
      fontSize: FontSize.caption,
      fontWeight: '500',
      color: 'rgba(255,255,255,0.82)',
      lineHeight: FontSize.caption * 1.4,
    },
    meta: {
      marginTop: 6,
      fontSize: 11,
      fontWeight: '600',
      color: 'rgba(255,255,255,0.7)',
    },
  });
}

export function HandbookSystemTile({
  system,
  entryCount,
  onPress,
  compact = false,
}: HandbookSystemTileProps) {
  const colors = useTheme();
  const styles = useThemedStyles((theme) => createStyles(theme, compact));
  const badgeBg = hexToRgba(system.accent, 0.92);
  const badgeBorder = hexToRgba(system.accent, 1);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Справочник ${system.name}`}
      onPress={onPress}
      style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}>
      <View style={styles.cover}>
        <FadeInImage
          uri={system.coverUrl}
          style={styles.coverImage}
          contentFit="cover"
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
          <Text style={styles.meta}>
            {entryCount} {entryCount === 1 ? 'статья' : entryCount < 5 ? 'статьи' : 'статей'}
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
