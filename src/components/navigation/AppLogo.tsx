import { Image } from 'expo-image';
import { Link } from 'expo-router';
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Image as SvgImage, Path } from 'react-native-svg';

import { LOGO_TEXT_PATH } from '@/constants/logo-text-path';
import { useThemePreference } from '@/hooks/use-theme';

const LOGO_ICON = require('../../../assets/logo/logo-icon.png');
const LOGO_ASPECT = 135 / 37;

/** Seasonal logo; flip to false to bring back the regular one. */
const HALLOWEEN_LOGO = true;
const HALLOWEEN_LOGO_LIGHT = require('../../../assets/logo/logo-halloween.png');
/** Same art with a light halo — black hat / bat vanish on dark surfaces otherwise. */
const HALLOWEEN_LOGO_DARK = require('../../../assets/logo/logo-halloween-dark.png');
const HALLOWEEN_ASPECT = 876 / 264;
/** Hat and bat stick out above the wordmark: grow the box so letters keep their size. */
const HALLOWEEN_SCALE = 1.3;

type AppLogoProps = {
  height?: number;
  align?: 'left' | 'center';
  href?: string | null;
  style?: StyleProp<ViewStyle>;
};

export function AppLogo({ height = 32, align = 'left', href = '/', style }: AppLogoProps) {
  const { colorScheme } = useThemePreference();

  let logo;
  if (HALLOWEEN_LOGO) {
    const imageHeight = Math.round(height * HALLOWEEN_SCALE);
    logo = (
      <Image
        source={colorScheme === 'dark' ? HALLOWEEN_LOGO_DARK : HALLOWEEN_LOGO_LIGHT}
        style={{ width: imageHeight * HALLOWEEN_ASPECT, height: imageHeight }}
        contentFit="contain"
        accessibilityIgnoresInvertColors
      />
    );
  } else {
    const logoWidth = height * LOGO_ASPECT;
    logo = (
      <Svg width={logoWidth} height={height} viewBox="0 0 135 37">
        <SvgImage href={LOGO_ICON} x={0} y={0} width={37} height={37} />
        <Path d={LOGO_TEXT_PATH} fill="#157AFE" />
      </Svg>
    );
  }

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
