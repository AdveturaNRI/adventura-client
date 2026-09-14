import { StyleSheet, Text, View, type ViewStyle } from 'react-native';
import Svg, { Circle, Line, Polygon } from 'react-native-svg';

import { useTheme } from '@/hooks/use-theme';

type NotFoundArtProps = {
  size?: number;
  style?: ViewStyle;
};

/** Статичный d20 с «критическим провалом» — 1 на грани. */
export function NotFoundArt({ size = 140, style }: NotFoundArtProps) {
  const colors = useTheme();
  const faceSize = size * 0.42;

  return (
    <View style={[styles.wrap, { width: size, height: size }, style]} accessibilityElementsHidden>
      <Svg width={size} height={size} viewBox="0 0 100 100">
        <Polygon
          points="50,6 90,28 90,72 50,94 10,72 10,28"
          fill={colors.primary}
          stroke={colors.d20Stroke}
          strokeWidth="2.2"
        />
        <Line x1="50" y1="6" x2="50" y2="94" stroke="#FFFFFF44" strokeWidth="1.4" />
        <Line x1="10" y1="28" x2="90" y2="72" stroke="#FFFFFF44" strokeWidth="1.4" />
        <Line x1="10" y1="72" x2="90" y2="28" stroke="#FFFFFF44" strokeWidth="1.4" />
        <Line x1="50" y1="6" x2="10" y2="72" stroke="#FFFFFF28" strokeWidth="1" />
        <Line x1="50" y1="6" x2="90" y2="72" stroke="#FFFFFF28" strokeWidth="1" />
        <Circle cx="78" cy="22" r="7" fill={colors.destructive} opacity={0.95} />
        <Line x1="75" y1="19" x2="81" y2="25" stroke={colors.onPrimary} strokeWidth="1.8" strokeLinecap="round" />
        <Line x1="81" y1="19" x2="75" y2="25" stroke={colors.onPrimary} strokeWidth="1.8" strokeLinecap="round" />
      </Svg>
      <View style={styles.face} pointerEvents="none">
        <Text style={[styles.faceText, { fontSize: faceSize, color: colors.onPrimary }]}>1</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  face: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  faceText: {
    fontWeight: '800',
    includeFontPadding: false,
  },
});
