import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useIsDesktopWeb } from '@/components/navigation/DesktopThemeToggle';
import { CREATIVITY_FILTER_OPTIONS } from '@/data/authors/labels';
import type { CreativityCategoryFilter } from '@/data/authors/types';
import { FontSize, Radius, type ThemeColors } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useThemedStyles } from '@/hooks/use-themed-styles';

type AuthorFiltersProps = {
  value: CreativityCategoryFilter;
  onChange: (value: CreativityCategoryFilter) => void;
};

function createStyles(colors: ThemeColors, compact: boolean) {
  return StyleSheet.create({
    row: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: compact ? 6 : 8,
    },
    chip: {
      minHeight: compact ? 32 : 36,
      paddingHorizontal: compact ? 9 : 12,
      borderRadius: Radius.pill,
      borderWidth: 1,
      borderColor: colors.borderLight,
      backgroundColor: colors.surface,
      flexDirection: 'row',
      alignItems: 'center',
      gap: compact ? 4 : 6,
    },
    chipActive: {
      borderColor: 'rgba(21, 122, 254, 0.35)',
      backgroundColor: 'rgba(21, 122, 254, 0.12)',
    },
    label: {
      fontSize: compact ? 12 : FontSize.caption,
      fontWeight: '700',
      color: colors.text,
    },
    labelActive: {
      color: colors.primary,
    },
  });
}

export function AuthorFilters({ value, onChange }: AuthorFiltersProps) {
  const colors = useTheme();
  const isDesktopWeb = useIsDesktopWeb();
  const compact = !isDesktopWeb;
  const styles = useThemedStyles((theme) => createStyles(theme, compact));
  const iconSize = compact ? 13 : 15;

  return (
    <View style={styles.row}>
      {CREATIVITY_FILTER_OPTIONS.map((option) => {
        const active = option.key === value;
        const iconColor = active ? colors.primary : colors.textMuted;
        return (
          <Pressable
            key={option.key}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            accessibilityLabel={option.hint ? `${option.label}. ${option.hint}` : option.label}
            onPress={() => onChange(option.key)}
            style={({ pressed }) => [
              styles.chip,
              active && styles.chipActive,
              pressed && { opacity: 0.88 },
            ]}>
            {option.icon ? (
              <Ionicons name={option.icon} size={iconSize} color={iconColor} />
            ) : null}
            <Text style={[styles.label, active && styles.labelActive]}>{option.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}
