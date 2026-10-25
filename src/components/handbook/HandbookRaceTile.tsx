import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import {
  type LayoutChangeEvent,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { FadeInImage } from '@/components/ui/media/FadeInImage';
import { Radius, type ThemeColors } from '@/constants/theme';
import type { HandbookEntry } from '@/data/handbook/types';
import { useThemePreference } from '@/hooks/use-theme';
import { useThemedStyles } from '@/hooks/use-themed-styles';

import {
  raceSourceLabel,
  usableRaceSubtitle,
  variantCountLabel,
} from './race-tile-utils';

export { variantShortTitle } from './race-tile-utils';

type HandbookRaceTileProps = {
  entry: HandbookEntry;
  onPress?: () => void;
  onOpenVariants?: () => void;
};

type PressState = { pressed: boolean; hovered?: boolean };

/** Портрет и типографика под ширину карточки. */
function layoutForWidth(width: number) {
  const w = width > 0 ? width : 300;
  const portrait = Math.round(Math.min(108, Math.max(76, w * 0.28)));
  const artCol = portrait + 28;
  const height = Math.max(124, portrait + 32);
  const titleSize = w < 260 ? 13 : w < 320 ? 14 : 15;
  return { portrait, artCol, height, titleSize };
}

function createStyles(colors: ThemeColors, isDark: boolean) {
  return StyleSheet.create({
    card: {
      width: '100%',
      flex: 1,
      borderRadius: 14,
      overflow: 'hidden',
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(15, 23, 42, 0.08)',
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
      transform: [{ translateY: -1 }],
      borderColor: 'rgba(21, 122, 254, 0.4)',
      ...Platform.select({
        web: {
          boxShadow: isDark
            ? '0 10px 22px rgba(0,0,0,0.35)'
            : '0 10px 22px rgba(15, 23, 42, 0.1)',
          zIndex: 2,
        } as object,
        default: { elevation: 3 },
      }),
    },
    cardPressed: {
      opacity: 0.94,
    },
    row: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
    },
    body: {
      flex: 1,
      minWidth: 0,
      paddingVertical: 12,
      paddingLeft: 14,
      paddingRight: 6,
      justifyContent: 'center',
      gap: 4,
      zIndex: 2,
    },
    title: {
      fontWeight: '700',
      color: colors.text,
      letterSpacing: -0.3,
      flexShrink: 1,
      ...Platform.select({
        web: {
          overflowWrap: 'break',
          wordBreak: 'keep-all',
        } as object,
        default: {},
      }),
    },
    subtitle: {
      fontSize: 12,
      fontStyle: 'italic',
      fontWeight: '500',
      color: colors.textMuted,
      lineHeight: 15,
    },
    metaRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginTop: 4,
      flexWrap: 'wrap',
    },
    source: {
      fontSize: 11,
      fontWeight: '800',
      letterSpacing: 0.5,
      color: colors.primary,
      textTransform: 'uppercase',
    },
    variantChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingHorizontal: 9,
      minHeight: 26,
      borderRadius: Radius.pill,
      backgroundColor: isDark ? 'rgba(21, 122, 254, 0.18)' : 'rgba(21, 122, 254, 0.1)',
      borderWidth: 1,
      borderColor: 'rgba(21, 122, 254, 0.35)',
      ...Platform.select({
        web: { cursor: 'pointer' } as object,
        default: {},
      }),
    },
    variantChipPressed: {
      opacity: 0.85,
    },
    variantChipText: {
      fontSize: 11,
      fontWeight: '700',
      color: colors.primary,
    },
    artWrap: {
      alignSelf: 'stretch',
      position: 'relative',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1,
      flexShrink: 0,
    },
    ring: {
      position: 'absolute',
      borderWidth: 1,
      borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(15, 23, 42, 0.08)',
      backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(15, 23, 42, 0.03)',
    },
    portrait: {
      overflow: 'hidden',
      borderWidth: 2,
      borderColor: isDark ? 'rgba(255,255,255,0.16)' : '#FFFFFF',
      backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(15, 23, 42, 0.05)',
      zIndex: 2,
      ...Platform.select({
        web: { boxShadow: '0 6px 16px rgba(0,0,0,0.22)' } as object,
        default: { elevation: 3 },
      }),
    },
    portraitImage: {
      width: '100%',
      height: '100%',
    },
  });
}

export function HandbookRaceTile({ entry, onPress, onOpenVariants }: HandbookRaceTileProps) {
  const { colorScheme } = useThemePreference();
  const isDark = colorScheme === 'dark';
  const styles = useThemedStyles((c) => createStyles(c, isDark));
  const [cardWidth, setCardWidth] = useState(0);
  const layout = layoutForWidth(cardWidth);
  const source = raceSourceLabel(entry);
  const subtitle = usableRaceSubtitle(entry.title, entry.subtitle);
  const variantCount = entry.variants?.length ?? 0;
  const a11y = [entry.title, subtitle, source].filter(Boolean).join(', ');

  const onLayout = (event: LayoutChangeEvent) => {
    const next = Math.round(event.nativeEvent.layout.width);
    if (next > 0 && next !== cardWidth) setCardWidth(next);
  };

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={a11y}
      accessibilityHint={variantCount > 0 ? 'Открыть базовую расу' : undefined}
      onPress={onPress}
      disabled={!onPress}
      onLayout={onLayout}
      style={({ pressed, hovered }: PressState) => [
        styles.card,
        { minHeight: layout.height },
        onPress && hovered && !pressed && styles.cardHovered,
        onPress && pressed && styles.cardPressed,
      ]}>
      <View style={[styles.row, { minHeight: layout.height }]}>
        <View style={styles.body}>
          <Text
            style={[
              styles.title,
              {
                fontSize: layout.titleSize,
                lineHeight: Math.round(layout.titleSize * 1.28),
              },
            ]}
            numberOfLines={3}
            adjustsFontSizeToFit
            minimumFontScale={0.75}>
            {entry.title}
          </Text>
          {subtitle ? (
            <Text style={styles.subtitle} numberOfLines={1}>
              {subtitle}
            </Text>
          ) : null}
          <View style={styles.metaRow}>
            {source ? <Text style={styles.source}>{source}</Text> : null}
            {variantCount > 0 && onOpenVariants ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={variantCountLabel(variantCount)}
                accessibilityHint="Выбрать вариант расы"
                hitSlop={8}
                onPress={(event) => {
                  event?.stopPropagation?.();
                  onOpenVariants();
                }}
                style={({ pressed }) => [styles.variantChip, pressed && styles.variantChipPressed]}>
                <Text style={styles.variantChipText}>{variantCountLabel(variantCount)}</Text>
                <Ionicons name="chevron-forward" size={12} color="#157AFE" />
              </Pressable>
            ) : null}
          </View>
        </View>

        <View style={[styles.artWrap, { width: layout.artCol }]} pointerEvents="none">
          <View
            style={[
              styles.ring,
              {
                width: layout.portrait + 14,
                height: layout.portrait + 14,
                borderRadius: (layout.portrait + 14) / 2,
              },
            ]}
          />
          <View
            style={[
              styles.portrait,
              {
                width: layout.portrait,
                height: layout.portrait,
                borderRadius: layout.portrait / 2,
              },
            ]}>
            {entry.coverSource != null ? (
              <FadeInImage
                source={entry.coverSource}
                style={styles.portraitImage}
                contentFit="cover"
                contentPosition="center"
              />
            ) : null}
          </View>
        </View>
      </View>
    </Pressable>
  );
}
