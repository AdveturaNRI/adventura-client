import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { FadeInImage } from '@/components/ui/media/FadeInImage';
import {
  HANDBOOK_CATEGORY_COVERS,
  getHandbookCategoryHint,
  getHandbookCategoryLabel,
} from '@/data/handbook/labels';
import type { HandbookCategory } from '@/data/handbook/types';
import { FontSize, type ThemeColors } from '@/constants/theme';
import { useThemedStyles } from '@/hooks/use-themed-styles';

type HandbookCategoryTileProps = {
  category: HandbookCategory;
  accent: string;
  systemId?: string;
  onPress: () => void;
};

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    card: {
      flex: 1,
      minWidth: 0,
      borderRadius: 18,
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
      transform: [{ scale: 1.02 }],
      borderColor: 'rgba(21, 122, 254, 0.5)',
      ...Platform.select({
        web: {
          boxShadow: '0 10px 24px rgba(15, 23, 42, 0.22)',
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
      aspectRatio: 16 / 10,
      overflow: 'hidden',
      backgroundColor: colors.surfaceMuted,
      position: 'relative',
      minHeight: 148,
    },
    coverImage: {
      ...StyleSheet.absoluteFillObject,
    },
    coverShield: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: 'rgba(0,0,0,0.14)',
    },
    coverGradient: {
      ...StyleSheet.absoluteFillObject,
      ...Platform.select({
        web: {
          backgroundImage:
            'linear-gradient(to top, rgba(0,0,0,0.82) 0%, rgba(0,0,0,0.36) 45%, rgba(0,0,0,0.08) 72%, rgba(0,0,0,0) 100%)',
        } as object,
        default: {
          backgroundColor: 'rgba(0,0,0,0.22)',
        },
      }),
    },
    coverGradientNativeBase: {
      ...StyleSheet.absoluteFillObject,
      top: '42%',
      backgroundColor: 'rgba(0,0,0,0.62)',
    },
    coverGradientNativeMid: {
      ...StyleSheet.absoluteFillObject,
      top: '28%',
      height: '22%',
      backgroundColor: 'rgba(0,0,0,0.28)',
    },
    accentBar: {
      position: 'absolute',
      left: 0,
      right: 0,
      bottom: 0,
      height: 3,
    },
    body: {
      position: 'absolute',
      left: 0,
      right: 0,
      bottom: 0,
      paddingHorizontal: 14,
      paddingBottom: 14,
      paddingTop: 28,
      gap: 3,
    },
    title: {
      fontSize: 18,
      fontWeight: '700',
      color: '#FFFFFF',
      letterSpacing: -0.3,
      lineHeight: 22,
    },
    hint: {
      fontSize: FontSize.caption,
      fontWeight: '500',
      color: 'rgba(255,255,255,0.82)',
      lineHeight: FontSize.caption * 1.4,
    },
  });
}

export function HandbookCategoryTile({
  category,
  accent,
  systemId,
  onPress,
}: HandbookCategoryTileProps) {
  const styles = useThemedStyles(createStyles);
  const cover = HANDBOOK_CATEGORY_COVERS[category];
  const label = getHandbookCategoryLabel(category, systemId);
  const hint = getHandbookCategoryHint(category, systemId);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed, hovered }: { pressed: boolean; hovered?: boolean }) => [
        styles.card,
        hovered && !pressed && styles.cardHovered,
        pressed && styles.cardPressed,
      ]}>
      <View style={styles.cover}>
        <FadeInImage
          source={cover.source}
          uri={cover.uri}
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

        <View style={styles.body} pointerEvents="none">
          <Text style={styles.title} numberOfLines={1}>
            {label}
          </Text>
          <Text style={styles.hint} numberOfLines={2}>
            {hint}
          </Text>
        </View>

        <View pointerEvents="none" style={[styles.accentBar, { backgroundColor: accent }]} />
      </View>
    </Pressable>
  );
}
