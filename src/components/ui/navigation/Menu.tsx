import { Pressable, StyleSheet, Text, View, type ViewStyle } from 'react-native';

import { Badge } from '../feedback/Badge';
import { MenuIcon } from './MenuIcons';
import { NavbarIcon } from './NavbarIcon';
import { type MenuIconKey, type MenuItemVariant } from './menu.config';
import type { NavbarIconKey } from './navbar-icon-assets';
import { FontSize, Spacing, type ThemeColors } from '@/constants/theme';
import { useThemedStyles } from '@/hooks/use-themed-styles';

const ICON_TILE_SIZE = 44;
const ICON_TILE_RADIUS = 10;

export type MenuItemProps = {
  label: string;
  subtitle?: string;
  icon?: MenuIconKey;
  navbarIcon?: NavbarIconKey;
  badge?: string;
  /** Red exclamation overlay on the icon tile (e.g. push disabled). */
  iconAlert?: boolean;
  variant?: MenuItemVariant;
  onPress?: () => void;
};

export type MenuProps = {
  title?: string;
  children?: React.ReactNode;
  style?: ViewStyle;
};

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: {
      gap: Spacing.lg,
    },
    title: {
      fontSize: 22,
      fontWeight: '700',
      color: colors.text,
    },
    list: {
      gap: Spacing.lg,
    },
    item: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.md,
    },
    itemPressed: {
      opacity: 0.85,
    },
    iconTile: {
      width: ICON_TILE_SIZE,
      height: ICON_TILE_SIZE,
      borderRadius: ICON_TILE_RADIUS,
      backgroundColor: colors.menuIconBg,
      alignItems: 'center',
      justifyContent: 'center',
      position: 'relative',
      overflow: 'visible',
    },
    iconAlert: {
      position: 'absolute',
      top: -4,
      right: -4,
      minWidth: 16,
      height: 16,
      borderRadius: 8,
      paddingHorizontal: 3,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.destructive,
    },
    iconAlertText: {
      color: colors.onPrimary,
      fontSize: 11,
      fontWeight: '800',
      lineHeight: 12,
    },
    itemBody: {
      flex: 1,
      gap: Spacing.xs,
    },
    label: {
      fontSize: FontSize.button,
      fontWeight: '600',
      color: colors.text,
    },
    labelDanger: {
      color: colors.destructive,
    },
    subtitle: {
      fontSize: FontSize.caption,
      color: colors.textMuted,
      lineHeight: FontSize.caption * 1.45,
    },
    divider: {
      height: 1,
      backgroundColor: colors.borderLight,
    },
  });
}

export function Menu({ title, children, style }: MenuProps) {
  const styles = useThemedStyles(createStyles);

  return (
    <View style={[styles.container, style]}>
      {title ? <Text style={styles.title}>{title}</Text> : null}
      <View style={styles.list}>{children}</View>
    </View>
  );
}

export function MenuDivider() {
  const styles = useThemedStyles(createStyles);
  return <View style={styles.divider} />;
}

export function MenuItem({
  label,
  subtitle,
  icon,
  navbarIcon,
  badge,
  iconAlert = false,
  variant = 'default',
  onPress,
}: MenuItemProps) {
  const styles = useThemedStyles(createStyles);
  const isDanger = variant === 'danger';

  const iconNode = navbarIcon ? (
    <View style={styles.iconTile}>
      <NavbarIcon name={navbarIcon} inverted />
      {iconAlert ? (
        <View style={styles.iconAlert} accessibilityLabel="Требует внимания">
          <Text style={styles.iconAlertText}>!</Text>
        </View>
      ) : null}
    </View>
  ) : icon ? (
    <View style={styles.iconTile}>
      <MenuIcon name={icon} />
      {iconAlert ? (
        <View style={styles.iconAlert} accessibilityLabel="Требует внимания">
          <Text style={styles.iconAlertText}>!</Text>
        </View>
      ) : null}
    </View>
  ) : null;

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.item, pressed && styles.itemPressed]}
      accessibilityRole="button">
      {iconNode}
      <View style={styles.itemBody}>
        <Text style={[styles.label, isDanger && styles.labelDanger]}>{label}</Text>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      </View>
      {badge ? <Badge label={badge} variant="unread" /> : null}
    </Pressable>
  );
}
