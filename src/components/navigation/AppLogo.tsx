import { Link } from 'expo-router';
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Image as SvgImage, Path } from 'react-native-svg';

import { LOGO_TEXT_PATH } from '@/constants/logo-text-path';

const LOGO_ICON = require('../../../assets/logo/logo-icon.png');
const LOGO_ASPECT = 135 / 37;

type AppLogoProps = {
  height?: number;
  align?: 'left' | 'center';
  href?: string | null;
  style?: StyleProp<ViewStyle>;
};

export function AppLogo({ height = 32, align = 'left', href = '/', style }: AppLogoProps) {
  const logoWidth = height * LOGO_ASPECT;

  const logo = (
    <Svg width={logoWidth} height={height} viewBox="0 0 135 37">
      <SvgImage href={LOGO_ICON} x={0} y={0} width={37} height={37} />
      <Path d={LOGO_TEXT_PATH} fill="#157AFE" />
    </Svg>
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
});
