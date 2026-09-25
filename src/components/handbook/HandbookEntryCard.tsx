import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';

import { HANDBOOK_CATEGORY_ICONS, HANDBOOK_CATEGORY_LABELS } from '@/data/handbook/labels';
import type { HandbookEntry } from '@/data/handbook/types';
import { FontSize, Radius, Spacing, type ThemeColors } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useThemedStyles } from '@/hooks/use-themed-styles';

type HandbookEntryCardProps = {
  entry: HandbookEntry;
};

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    card: {
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.borderLight,
      backgroundColor: colors.surface,
      padding: Spacing.md,
      gap: 10,
    },
    top: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      gap: Spacing.sm,
    },
    titleBlock: {
      flex: 1,
      minWidth: 0,
      gap: 4,
    },
    title: {
      fontSize: FontSize.button,
      fontWeight: '700',
      color: colors.text,
      letterSpacing: -0.2,
      lineHeight: FontSize.button * 1.3,
    },
    summary: {
      fontSize: FontSize.caption,
      color: colors.textSecondary,
      lineHeight: FontSize.caption * 1.5,
    },
    categoryBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      minHeight: 26,
      paddingHorizontal: 10,
      borderRadius: Radius.pill,
      borderWidth: 1,
      borderColor: 'rgba(21, 122, 254, 0.35)',
      backgroundColor: 'rgba(21, 122, 254, 0.12)',
      flexShrink: 0,
    },
    categoryLabel: {
      fontSize: 11,
      fontWeight: '700',
      color: colors.primary,
    },
    tags: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 6,
    },
    tag: {
      paddingHorizontal: 8,
      minHeight: 22,
      borderRadius: Radius.pill,
      borderWidth: 1,
      borderColor: 'rgba(61, 171, 90, 0.35)',
      backgroundColor: 'rgba(61, 171, 90, 0.12)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    tagText: {
      fontSize: 11,
      fontWeight: '600',
      color: colors.success,
    },
  });
}

export function HandbookEntryCard({ entry }: HandbookEntryCardProps) {
  const colors = useTheme();
  const styles = useThemedStyles(createStyles);
  const icon = HANDBOOK_CATEGORY_ICONS[entry.category];

  return (
    <View style={styles.card}>
      <View style={styles.top}>
        <View style={styles.titleBlock}>
          <Text style={styles.title}>{entry.title}</Text>
          <Text style={styles.summary}>{entry.summary}</Text>
        </View>
        <View style={styles.categoryBadge}>
          <Ionicons name={icon} size={12} color={colors.primary} />
          <Text style={styles.categoryLabel}>
            {HANDBOOK_CATEGORY_LABELS[entry.category]}
          </Text>
        </View>
      </View>
      {entry.tags.length > 0 ? (
        <View style={styles.tags}>
          {entry.tags.map((tag) => (
            <View key={tag} style={styles.tag}>
              <Text style={styles.tagText}>{tag}</Text>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}
