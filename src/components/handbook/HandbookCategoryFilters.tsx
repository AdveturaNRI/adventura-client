import { Ionicons } from '@expo/vector-icons';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import {
  HANDBOOK_CATEGORY_FILTER_LABELS,
  HANDBOOK_CATEGORY_ICONS,
} from '@/data/handbook/labels';
import type { HandbookCategory, HandbookCategoryFilter } from '@/data/handbook/types';
import { FontSize, Radius, Spacing, type ThemeColors } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useThemedStyles } from '@/hooks/use-themed-styles';

const FILTER_ORDER: HandbookCategoryFilter[] = [
  'all',
  'races',
  'classes',
  'spells',
  'equipment',
  'bestiary',
  'rules',
];

type HandbookCategoryFiltersProps = {
  value: HandbookCategoryFilter;
  onChange: (next: HandbookCategoryFilter) => void;
  counts?: Partial<Record<HandbookCategoryFilter, number>>;
};

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    scroll: {
      flexGrow: 0,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      paddingVertical: 2,
    },
    chip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      minHeight: 34,
      paddingHorizontal: 12,
      borderRadius: Radius.pill,
      borderWidth: 1,
      borderColor: 'rgba(21, 122, 254, 0.28)',
      backgroundColor: 'rgba(21, 122, 254, 0.08)',
    },
    chipActive: {
      borderColor: colors.primary,
      backgroundColor: 'rgba(21, 122, 254, 0.18)',
    },
    chipPressed: {
      opacity: 0.88,
    },
    label: {
      fontSize: FontSize.caption,
      fontWeight: '700',
      color: colors.primary,
    },
    count: {
      fontSize: 11,
      fontWeight: '600',
      color: colors.primary,
      opacity: 0.75,
    },
  });
}

export function HandbookCategoryFilters({
  value,
  onChange,
  counts,
}: HandbookCategoryFiltersProps) {
  const colors = useTheme();
  const styles = useThemedStyles(createStyles);

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={styles.scroll}
      contentContainerStyle={styles.row}>
      {FILTER_ORDER.map((key) => {
        const active = key === value;
        const count = counts?.[key];
        const iconName =
          key === 'all'
            ? ('apps-outline' as const)
            : HANDBOOK_CATEGORY_ICONS[key as HandbookCategory];

        return (
          <Pressable
            key={key}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            onPress={() => onChange(key)}
            style={({ pressed }) => [
              styles.chip,
              active && styles.chipActive,
              pressed && styles.chipPressed,
            ]}>
            <Ionicons name={iconName} size={14} color={colors.primary} />
            <Text style={styles.label}>{HANDBOOK_CATEGORY_FILTER_LABELS[key]}</Text>
            {typeof count === 'number' ? (
              <Text style={styles.count}>{count}</Text>
            ) : null}
          </Pressable>
        );
      })}
    </ScrollView>
  );
}
