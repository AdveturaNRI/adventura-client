import { Link } from 'expo-router';
import {
  Image,
  Platform,
  Pressable,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { LOGO_TEXT_PATH } from '@/constants/logo-text-path';

/** Transparent-bg d20 for the white plate (black baked out). */
const LOGO_ICON = require('../../../assets/logo/logo-icon-on-light.png');

/** Wordmark width in the original 135×37 artboard (icon occupies 0…37). */
const TEXT_VIEW_W = 98;
const TEXT_VIEW_H = 37;

type AppLogoProps = {
  height?: number;
  align?: 'left' | 'center';
  href?: string | null;
  style?: StyleProp<ViewStyle>;
};

export function AppLogo({ height = 32, align = 'left', href = '/', style }: AppLogoProps) {
  const iconSize = height;
  const iconInner = Math.round(iconSize * 0.72);
  const textWidth = height * (TEXT_VIEW_W / TEXT_VIEW_H);
  const plateRadius = Math.max(8, Math.round(iconSize * 0.22));

  const logo = (
    <View style={styles.row}>
      <View
        style={[
          styles.iconPlate,
          {
            width: iconSize,
            height: iconSize,
            borderRadius: plateRadius,
          },
          Platform.OS === 'web' ? styles.iconPlateWeb : styles.iconPlateNative,
        ]}>
        <Image
          source={LOGO_ICON}
          style={{ width: iconInner, height: iconInner }}
          resizeMode="contain"
          accessibilityIgnoresInvertColors
        />
      </View>
      <Svg width={textWidth} height={height} viewBox={`37 0 ${TEXT_VIEW_W} ${TEXT_VIEW_H}`}>
        <Path d={LOGO_TEXT_PATH} fill="#157AFE" />
      </Svg>
    </View>
  );

  const pressableStyle = [
    styles.pressable,
    align === 'center' ? styles.centered : styles.left,
    style,
  ];

  if (href == null) {
    return <View style={pressableStyle}>{logo}</View>;
  }

  return (
    <Link href={href} asChild>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Adventura"
        style={({ pressed }) => [pressableStyle, pressed && styles.pressed]}>
        {logo}
      </Pressable>
    </Link>
  );
}

const styles = StyleSheet.create({
  pressable: {
    backgroundColor: 'transparent',
  },
  left: {
    alignSelf: 'flex-start',
  },
  centered: {
    alignSelf: 'center',
  },
  pressed: {
    opacity: 0.85,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  iconPlate: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    overflow: 'hidden',
  },
  iconPlateWeb: {
    // Soft lift + thin brand rim on dark sidebar
    boxShadow: '0 1px 2px rgba(15, 23, 42, 0.14), 0 0 0 1px rgba(21, 122, 254, 0.1)',
  } as ViewStyle,
  iconPlateNative: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(21, 122, 254, 0.18)',
  },
});
