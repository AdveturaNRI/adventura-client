import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { type ComponentProps } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { FontSize, Radius, Sizes, Spacing, type ThemeColors } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useThemedStyles } from '@/hooks/use-themed-styles';

type IoniconName = ComponentProps<typeof Ionicons>['name'];
type MaterialCommunityIconName = ComponentProps<typeof MaterialCommunityIcons>['name'];

export type SwitcherOption = {
  key: string;
  label: string;
  icon?: IoniconName | MaterialCommunityIconName;
  iconSet?: 'ionicons' | 'material-community';
  badge?: number;
};

type SwitcherSize = 'default' | 'compact';

type SwitcherProps = {
  options: SwitcherOption[];
  value: string;
  onChange: (key: string) => void;
  disabled?: boolean;
  size?: SwitcherSize;
  stretch?: boolean;
  showLabelOnlyWhenActive?: boolean;
};

const SIZE_CONFIG = {
  default: {
    minHeight: Sizes.controlHeight,
    padding: 4,
    tabMinHeight: Sizes.controlHeight - 8,
    tabPaddingH: Spacing.sm,
    gap: 6,
    fontSize: FontSize.button,
    iconSize: 16,
  },
  compact: {
    minHeight: 36,
    padding: 3,
    tabMinHeight: 30,
    tabPaddingH: 10,
    gap: 4,
    fontSize: FontSize.caption,
    iconSize: 13,
  },
} as const;

function createStyles(
  colors: ThemeColors,
  size: SwitcherSize,
  stretch: boolean,
  showLabelOnlyWhenActive: boolean,
) {
  const cfg = SIZE_CONFIG[size];
  const useStretchTabs = stretch && !showLabelOnlyWhenActive;

  return StyleSheet.create({
    container: {
      flexDirection: 'row',
      alignItems: 'stretch',
      alignSelf: stretch || size === 'default' ? 'stretch' : 'flex-start',
      width: stretch ? '100%' : undefined,
      minHeight: cfg.minHeight,
      padding: cfg.padding,
      borderRadius: Radius.pill,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.borderLight,
    },
    containerDisabled: {
      opacity: 0.45,
    },
    tab: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: cfg.gap,
      paddingHorizontal: stretch ? cfg.tabPaddingH - 2 : cfg.tabPaddingH,
      borderRadius: Radius.pill,
      minHeight: cfg.tabMinHeight,
      minWidth: stretch ? 0 : undefined,
      flex: size === 'default' || useStretchTabs ? 1 : undefined,
      overflow: 'hidden',
    },
    tabIconOnly: {
      flex: 0,
      minWidth: 44,
      paddingHorizontal: 12,
    },
    tabExpanded: {
      flex: 1,
      minWidth: 0,
      paddingHorizontal: cfg.tabPaddingH,
    },
    tabActive: {
      backgroundColor: colors.primary,
    },
    label: {
      flexShrink: 1,
      fontSize: cfg.fontSize,
      fontWeight: '600',
    },
    labelActive: {
      color: colors.onPrimary,
    },
    labelInactive: {
      color: colors.textSecondary,
    },
    badge: {
      minWidth: 18,
      height: 18,
      paddingHorizontal: 5,
      borderRadius: 999,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.surfaceMuted,
    },
    badgeActive: {
      backgroundColor: 'rgba(255, 255, 255, 0.22)',
    },
    badgeText: {
      fontSize: 11,
      fontWeight: '700',
      color: colors.textMuted,
    },
    badgeTextActive: {
      color: colors.onPrimary,
    },
  });
}

export function Switcher({
  options,
  value,
  onChange,
  disabled = false,
  size = 'default',
  stretch = false,
  showLabelOnlyWhenActive = false,
}: SwitcherProps) {
  const colors = useTheme();
  const styles = useThemedStyles((themeColors) =>
    createStyles(themeColors, size, stretch, showLabelOnlyWhenActive),
  );
  const iconSize = SIZE_CONFIG[size].iconSize;

  return (
    <View style={[styles.container, disabled ? styles.containerDisabled : null]}>
      {options.map((option) => {
        const isActive = option.key === value;
        const iconColor = isActive ? colors.onPrimary : colors.textMuted;
        const showLabel = !showLabelOnlyWhenActive || isActive;
        const badgeLabel =
          typeof option.badge === 'number' && option.badge > 0 ? `, ${option.badge}` : '';

        return (
          <Pressable
            key={option.key}
            disabled={disabled}
            accessibilityRole="tab"
            accessibilityState={{ selected: isActive }}
            accessibilityLabel={`${option.label}${badgeLabel}`}
            onPress={() => onChange(option.key)}
            style={[
              styles.tab,
              isActive && styles.tabActive,
              showLabelOnlyWhenActive && (isActive ? styles.tabExpanded : styles.tabIconOnly),
            ]}>
            {option.icon ? (
              option.iconSet === 'material-community' ? (
                <MaterialCommunityIcons
                  name={option.icon as MaterialCommunityIconName}
                  size={iconSize}
                  color={iconColor}
                />
              ) : (
                <Ionicons name={option.icon as IoniconName} size={iconSize} color={iconColor} />
              )
            ) : null}
            {showLabel ? (
              <Text
                numberOfLines={1}
                style={[styles.label, isActive ? styles.labelActive : styles.labelInactive]}>
                {option.label}
              </Text>
            ) : null}
            {typeof option.badge === 'number' && option.badge > 0 ? (
              <View style={[styles.badge, isActive && styles.badgeActive]}>
                <Text style={[styles.badgeText, isActive && styles.badgeTextActive]}>
                  {option.badge}
                </Text>
              </View>
            ) : null}
          </Pressable>
        );
      })}
    </View>
  );
}
