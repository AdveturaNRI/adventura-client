import { type ReactNode } from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Spacing } from '@/constants/theme';

type ScreenHeaderProps = {
  left?: ReactNode;
  center?: ReactNode;
  right?: ReactNode;
  transparent?: boolean;
  style?: ViewStyle;
};

export function ScreenHeader({
  left,
  center,
  right,
  transparent = true,
  style,
}: ScreenHeaderProps) {
  const insets = useSafeAreaInsets();

  return (
    <View
      pointerEvents="box-none"
      style={[
        styles.container,
        {
          paddingTop: insets.top + Spacing.sm,
          paddingHorizontal: Spacing.md,
          backgroundColor: transparent ? 'transparent' : undefined,
        },
        style,
      ]}>
      <View pointerEvents="box-none" style={styles.row}>
        <View pointerEvents="box-none" style={styles.side}>
          {left}
        </View>
        <View pointerEvents="box-none" style={styles.center}>
          {center}
        </View>
        <View pointerEvents="box-none" style={[styles.side, styles.sideRight]}>
          {right}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 100,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 44,
  },
  side: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
  },
  sideRight: {
    justifyContent: 'flex-end',
  },
  center: {
    flexShrink: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
