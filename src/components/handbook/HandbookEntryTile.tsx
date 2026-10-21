import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { FadeInImage } from '@/components/ui/media/FadeInImage';
import type { HandbookEntry } from '@/data/handbook/types';
import { FontSize, Radius, type ThemeColors } from '@/constants/theme';
import { useThemedStyles } from '@/hooks/use-themed-styles';

type HandbookEntryTileProps = {
  entry: HandbookEntry;
  onPress?: () => void;
};

type PressState = { pressed: boolean; hovered?: boolean };

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
      transform: [{ scale: 1.03 }],
      borderColor: 'rgba(21, 122, 254, 0.55)',
      ...Platform.select({
        web: {
          boxShadow: '0 12px 28px rgba(15, 23, 42, 0.28)',
          zIndex: 2,
        } as object,
        default: {
          elevation: 4,
        },
      }),
    },
    cardPressed: {
      opacity: 0.94,
      transform: [{ scale: 0.985 }],
    },
    cover: {
      width: '100%',
      // Вертикальная карточка, чуть ниже 9:16.
      aspectRatio: 2 / 3,
      overflow: 'hidden',
      backgroundColor: colors.surfaceMuted,
      position: 'relative',
    },
    coverImage: {
      ...StyleSheet.absoluteFillObject,
      ...Platform.select({
        web: {
          transitionProperty: 'transform',
          transitionDuration: '220ms',
          transitionTimingFunction: 'ease-out',
        } as object,
        default: {},
      }),
    },
    coverImageHovered: {
      transform: [{ scale: 1.06 }],
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
            'linear-gradient(to top, rgba(0,0,0,0.86) 0%, rgba(0,0,0,0.4) 48%, rgba(0,0,0,0.08) 74%, rgba(0,0,0,0) 100%)',
        } as object,
        default: {
          backgroundColor: 'rgba(0,0,0,0.22)',
        },
      }),
    },
    coverGradientNativeBase: {
      ...StyleSheet.absoluteFillObject,
      top: '40%',
      backgroundColor: 'rgba(0,0,0,0.66)',
    },
    coverGradientNativeMid: {
      ...StyleSheet.absoluteFillObject,
      top: '26%',
      height: '24%',
      backgroundColor: 'rgba(0,0,0,0.3)',
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
      paddingHorizontal: 10,
      paddingBottom: 10,
      paddingTop: 20,
      gap: 3,
    },
    title: {
      fontSize: 15,
      fontWeight: '800',
      color: '#FFFFFF',
      letterSpacing: -0.25,
      lineHeight: 18,
    },
    summary: {
      fontSize: 11,
      fontWeight: '500',
      color: 'rgba(255,255,255,0.84)',
      lineHeight: 14,
    },
    tags: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 4,
      marginTop: 4,
    },
    tag: {
      paddingHorizontal: 7,
      minHeight: 20,
      borderRadius: Radius.pill,
      borderWidth: 1,
      borderColor: 'rgba(21, 122, 254, 0.55)',
      backgroundColor: 'rgba(21, 122, 254, 0.28)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    tagAlt: {
      borderColor: 'rgba(61, 171, 90, 0.55)',
      backgroundColor: 'rgba(61, 171, 90, 0.28)',
    },
    tagText: {
      fontSize: 9,
      fontWeight: '700',
      color: '#E8F1FF',
    },
    tagTextAlt: {
      color: '#E8F8EE',
    },
  });
}

export function HandbookEntryTile({ entry, onPress }: HandbookEntryTileProps) {
  const styles = useThemedStyles(createStyles);
  const accent = entry.accent || '#2F6B4F';
  const coverUrl =
    entry.coverSource != null
      ? undefined
      : entry.coverUrl ||
        `https://picsum.photos/seed/handbook-entry-${entry.id}/900/1600`;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={entry.title}
      onPress={onPress}
      style={({ pressed, hovered }: PressState) => [
        styles.card,
        hovered && !pressed && styles.cardHovered,
        pressed && styles.cardPressed,
      ]}>
      {({ hovered }: PressState) => (
        <View style={styles.cover}>
          <FadeInImage
            source={entry.coverSource}
            uri={coverUrl}
            style={[styles.coverImage, hovered ? styles.coverImageHovered : null]}
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

          <View style={styles.body} pointerEvents="none">
            <Text style={styles.title} numberOfLines={1}>
              {entry.title}
            </Text>
            <Text style={styles.summary} numberOfLines={2}>
              {entry.summary}
            </Text>
            {entry.tags.length > 0 ? (
              <View style={styles.tags}>
                {entry.tags.slice(0, 2).map((tag, index) => (
                  <View
                    key={`${entry.id}-tag-${index}`}
                    style={[styles.tag, index > 0 ? styles.tagAlt : null]}>
                    <Text style={[styles.tagText, index > 0 ? styles.tagTextAlt : null]}>{tag}</Text>
                  </View>
                ))}
              </View>
            ) : null}
          </View>

          <View pointerEvents="none" style={[styles.accentBar, { backgroundColor: accent }]} />
        </View>
      )}
    </Pressable>
  );
}
