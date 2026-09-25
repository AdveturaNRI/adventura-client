import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import {
  HANDBOOK_CATEGORY_ICONS,
  HANDBOOK_CATEGORY_LABELS,
  HANDBOOK_CATEGORY_HINTS,
} from '@/data/handbook/labels';
import type { HandbookCategory } from '@/data/handbook/types';
import { FontSize, Spacing, type ThemeColors } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useThemedStyles } from '@/hooks/use-themed-styles';

type HandbookCategoryTileProps = {
  category: HandbookCategory;
  entryCount: number;
  accent: string;
  onPress: () => void;
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
  if (Number.isNaN(n)) return `rgba(21,122,254,${alpha})`;
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return `rgba(${r},${g},${b},${alpha})`;
}

function pluralArticles(count: number): string {
  const mod10 = count % 10;
  const mod100 = count % 100;
  if (mod10 === 1 && mod100 !== 11) return 'статья';
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return 'статьи';
  return 'статей';
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    card: {
      flex: 1,
      minWidth: 0,
      borderRadius: 18,
      overflow: 'hidden',
      borderWidth: 1,
      minHeight: 148,
    },
    cardPressed: {
      opacity: 0.92,
      transform: [{ scale: 0.985 }],
    },
    inner: {
      flex: 1,
      padding: Spacing.md,
      gap: Spacing.sm,
      justifyContent: 'space-between',
    },
    iconWrap: {
      width: 44,
      height: 44,
      borderRadius: 14,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
    },
    title: {
      fontSize: 18,
      fontWeight: '700',
      letterSpacing: -0.3,
      lineHeight: 22,
    },
    hint: {
      fontSize: FontSize.caption,
      fontWeight: '500',
      lineHeight: FontSize.caption * 1.4,
      marginTop: 2,
    },
    meta: {
      fontSize: 11,
      fontWeight: '700',
      letterSpacing: 0.2,
      marginTop: 8,
    },
    accentBar: {
      height: 3,
      width: '100%',
    },
  });
}

export function HandbookCategoryTile({
  category,
  entryCount,
  accent,
  onPress,
}: HandbookCategoryTileProps) {
  const colors = useTheme();
  const styles = useThemedStyles(createStyles);
  const icon = HANDBOOK_CATEGORY_ICONS[category];
  const tintBg = hexToRgba(accent, 0.1);
  const tintBorder = hexToRgba(accent, 0.28);
  const iconBg = hexToRgba(accent, 0.16);
  const iconBorder = hexToRgba(accent, 0.35);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${HANDBOOK_CATEGORY_LABELS[category]}, ${entryCount} ${pluralArticles(entryCount)}`}
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        {
          backgroundColor: tintBg,
          borderColor: tintBorder,
        },
        pressed && styles.cardPressed,
      ]}>
      <View style={styles.inner}>
        <View style={[styles.iconWrap, { backgroundColor: iconBg, borderColor: iconBorder }]}>
          <Ionicons name={icon} size={22} color={accent} />
        </View>
        <View>
          <Text style={[styles.title, { color: colors.text }]}>
            {HANDBOOK_CATEGORY_LABELS[category]}
          </Text>
          <Text style={[styles.hint, { color: colors.textSecondary }]} numberOfLines={2}>
            {HANDBOOK_CATEGORY_HINTS[category]}
          </Text>
          <Text style={[styles.meta, { color: accent }]}>
            {entryCount} {pluralArticles(entryCount)}
          </Text>
        </View>
      </View>
      <View style={[styles.accentBar, { backgroundColor: accent }]} />
    </Pressable>
  );
}
