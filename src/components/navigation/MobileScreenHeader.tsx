import type { ReactNode } from 'react';
import { StyleSheet, Text, View, type ViewStyle } from 'react-native';

import { useIsDesktopWeb } from '@/components/navigation/DesktopThemeToggle';
import { MobileBackButton } from '@/components/navigation/MobileBackButton';
import { MobileMenuButton } from '@/components/navigation/MobileMenuButton';
import { NotificationButton } from '@/components/navigation/NotificationButton';
import { FontSize, type ThemeColors } from '@/constants/theme';
import { useThemedStyles } from '@/hooks/use-themed-styles';

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      minHeight: 40,
      gap: 8,
    },
    side: {
      minWidth: 40,
      justifyContent: 'center',
    },
    sideLeft: {
      alignItems: 'flex-start',
    },
    sideRight: {
      alignItems: 'flex-end',
    },
    sideGrow: {
      flexShrink: 0,
    },
    actions: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      minWidth: 0,
    },
    title: {
      flex: 1,
      fontSize: FontSize.h1,
      fontWeight: '700',
      color: colors.text,
      textAlign: 'center',
      letterSpacing: -0.3,
    },
    titleLeft: {
      textAlign: 'left',
    },
  });
}

type MobileScreenHeaderProps = {
  title: string;
  align?: 'center' | 'left';
  showBack?: boolean;
  onBackPress?: () => void;
  leftAction?: ReactNode;
  style?: ViewStyle;
};

export function MobileScreenHeader({
  title,
  align = 'center',
  showBack = false,
  onBackPress,
  leftAction,
  style,
}: MobileScreenHeaderProps) {
  const styles = useThemedStyles(createStyles);
  const isDesktopWeb = useIsDesktopWeb();
  const isCentered = align === 'center';
  const leftContent = leftAction ?? (showBack ? <MobileBackButton onPress={onBackPress} /> : null);

  return (
    <View style={[styles.row, style]}>
      <View style={[styles.side, styles.sideLeft, leftAction ? styles.sideGrow : null]}>
        {leftContent}
      </View>
      <Text style={[styles.title, !isCentered && styles.titleLeft]} numberOfLines={1}>
        {title}
      </Text>
      <View style={[styles.side, styles.sideRight, styles.actions]}>
        {/* Desktop web already has the bell in MainDesktopHeader — avoid a duplicate. */}
        {!isDesktopWeb ? <NotificationButton variant="compact" /> : null}
        <MobileMenuButton />
      </View>
    </View>
  );
}
