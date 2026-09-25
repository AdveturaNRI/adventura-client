import { Ionicons } from '@expo/vector-icons';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { FontSize, Spacing, type ThemeColors } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useThemedStyles } from '@/hooks/use-themed-styles';

export type HandbookBreadcrumbItem = {
  label: string;
  /** Если нет onPress — текущий шаг (не кликабелен). */
  onPress?: () => void;
};

type HandbookBreadcrumbsProps = {
  items: HandbookBreadcrumbItem[];
};

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    scroll: {
      flexGrow: 0,
      marginHorizontal: -Spacing.lg,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingHorizontal: Spacing.lg,
      paddingVertical: 2,
      minHeight: 28,
    },
    crumb: {
      maxWidth: 180,
    },
    crumbPressed: {
      opacity: 0.75,
    },
    label: {
      fontSize: FontSize.caption,
      fontWeight: '600',
      color: colors.primary,
    },
    labelCurrent: {
      color: colors.textSecondary,
      fontWeight: '700',
    },
    sep: {
      marginHorizontal: 2,
    },
  });
}

export function HandbookBreadcrumbs({ items }: HandbookBreadcrumbsProps) {
  const colors = useTheme();
  const styles = useThemedStyles(createStyles);

  if (items.length === 0) return null;

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={styles.scroll}
      contentContainerStyle={styles.row}>
      {items.map((item, index) => {
        const isLast = index === items.length - 1;
        const clickable = Boolean(item.onPress) && !isLast;

        return (
          <View key={`${item.label}-${index}`} style={{ flexDirection: 'row', alignItems: 'center' }}>
            {index > 0 ? (
              <Ionicons
                name="chevron-forward"
                size={12}
                color={colors.textSubtle}
                style={styles.sep}
              />
            ) : null}
            {clickable ? (
              <Pressable
                accessibilityRole="link"
                onPress={item.onPress}
                style={({ pressed }) => [styles.crumb, pressed && styles.crumbPressed]}>
                <Text style={styles.label} numberOfLines={1}>
                  {item.label}
                </Text>
              </Pressable>
            ) : (
              <View style={styles.crumb}>
                <Text
                  style={[styles.label, (isLast || !item.onPress) && styles.labelCurrent]}
                  numberOfLines={1}>
                  {item.label}
                </Text>
              </View>
            )}
          </View>
        );
      })}
    </ScrollView>
  );
}
