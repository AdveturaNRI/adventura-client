import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';

import {
  AUTHOR_CATEGORY_LABELS,
  CREATIVITY_CATEGORY_ICONS,
} from '@/data/authors/labels';
import type { CreativityCategory } from '@/data/authors/types';
import { FontSize, Radius, type ThemeColors } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useThemedStyles } from '@/hooks/use-themed-styles';

type CreativityCategoryBadgeProps = {
  category: CreativityCategory;
  size?: 'sm' | 'md';
};

type CreativityCategoryBadgesProps = {
  categories: CreativityCategory[];
  size?: 'sm' | 'md';
};

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    row: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 6,
    },
    badge: {
      alignSelf: 'flex-start',
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      minHeight: 26,
      paddingHorizontal: 10,
      borderRadius: Radius.pill,
      borderWidth: 1,
      borderColor: 'rgba(21, 122, 254, 0.35)',
      backgroundColor: 'rgba(21, 122, 254, 0.12)',
    },
    badgeSm: {
      minHeight: 22,
      paddingHorizontal: 8,
      gap: 4,
    },
    label: {
      fontSize: FontSize.caption,
      fontWeight: '700',
      color: colors.primary,
    },
    labelSm: {
      fontSize: 11,
    },
  });
}

export function CreativityCategoryBadge({
  category,
  size = 'md',
}: CreativityCategoryBadgeProps) {
  const colors = useTheme();
  const styles = useThemedStyles(createStyles);
  const compact = size === 'sm';

  return (
    <View style={[styles.badge, compact && styles.badgeSm]}>
      <Ionicons
        name={CREATIVITY_CATEGORY_ICONS[category]}
        size={compact ? 12 : 14}
        color={colors.primary}
      />
      <Text style={[styles.label, compact && styles.labelSm]}>
        {AUTHOR_CATEGORY_LABELS[category]}
      </Text>
    </View>
  );
}

export function CreativityCategoryBadges({
  categories,
  size = 'md',
}: CreativityCategoryBadgesProps) {
  const styles = useThemedStyles(createStyles);
  const unique = categories.filter(
    (category, index, list) => list.indexOf(category) === index,
  );

  if (unique.length === 0) {
    return null;
  }

  return (
    <View style={styles.row}>
      {unique.map((category) => (
        <CreativityCategoryBadge key={category} category={category} size={size} />
      ))}
    </View>
  );
}
