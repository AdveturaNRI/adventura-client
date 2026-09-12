import { StyleSheet, Text, View } from 'react-native';
import Svg, { Line, Polygon, Rect } from 'react-native-svg';

import { useTheme } from '@/hooks/use-theme';

export type DieGlyphSides = 4 | 6 | 8 | 10 | 12 | 20 | 100;

type DieGlyphProps = {
  sides: DieGlyphSides;
  size?: number;
  color?: string;
  label?: string | number;
  dimmed?: boolean;
};

function polygonFor(sides: DieGlyphSides): string {
  if (sides === 4) return '50,10 92,88 8,88';
  if (sides === 8) return '50,6 94,50 50,94 6,50';
  if (sides === 10) return '50,4 90,36 76,94 24,94 10,36';
  if (sides === 12) return '50,6 84,20 94,50 84,80 50,94 16,80 6,50 16,20';
  // d20 / d100
  return '50,6 88,26 88,74 50,94 12,74 12,26';
}

export function DieGlyph({ sides, size = 56, color, label, dimmed }: DieGlyphProps) {
  const colors = useTheme();
  const fill = color ?? colors.primary;
  const stroke = colors.d20Stroke;
  const opacity = dimmed ? 0.45 : 1;
  const fontSize = size * (String(label ?? '').length > 2 ? 0.22 : 0.28);

  return (
    <View style={[styles.wrap, { width: size, height: size, opacity }]}>
      <Svg width={size} height={size} viewBox="0 0 100 100">
        {sides === 6 ? (
          <Rect
            x="14"
            y="14"
            width="72"
            height="72"
            rx="12"
            fill={fill}
            stroke={stroke}
            strokeWidth="2.5"
          />
        ) : (
          <Polygon
            points={polygonFor(sides)}
            fill={fill}
            stroke={stroke}
            strokeWidth="2.5"
          />
        )}
        {sides !== 4 && sides !== 6 ? (
          <>
            <Line x1="50" y1="8" x2="50" y2="92" stroke="#FFFFFF44" strokeWidth="1.3" />
            <Line x1="12" y1="28" x2="88" y2="72" stroke="#FFFFFF44" strokeWidth="1.3" />
            <Line x1="12" y1="72" x2="88" y2="28" stroke="#FFFFFF44" strokeWidth="1.3" />
          </>
        ) : null}
      </Svg>
      {label != null ? (
        <View style={styles.face} pointerEvents="none">
          <Text style={[styles.faceText, { fontSize }]}>{label}</Text>
        </View>
      ) : null}
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
    color: '#FFFFFF',
    includeFontPadding: false,
  },
});
