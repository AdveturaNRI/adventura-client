import { useEffect, useState } from 'react';
import { StyleSheet, Text, View, type ViewStyle } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Line, Polygon } from 'react-native-svg';

import { useTheme } from '@/hooks/use-theme';

type D20LoaderProps = {
  size?: number;
  color?: string;
  style?: ViewStyle;
};

const randomFace = () => Math.floor(Math.random() * 20) + 1;

export function D20Loader({ size = 72, color, style }: D20LoaderProps) {
  const colors = useTheme();
  const dieColor = color ?? colors.primary;
  const [face, setFace] = useState(1);
  const rotate = useSharedValue(0);

  useEffect(() => {
    rotate.value = withRepeat(
      withTiming(360, { duration: 2800, easing: Easing.linear }),
      -1,
      false,
    );
  }, [rotate]);

  useEffect(() => {
    let cancelled = false;
    const timers: ReturnType<typeof setTimeout>[] = [];

    const schedule = (callback: () => void, delay: number) => {
      const timer = setTimeout(callback, delay);
      timers.push(timer);
    };

    const rollNumbers = (step = 0) => {
      if (cancelled) return;

      const fastSteps = 16;
      const slowDelays = [90, 120, 160, 220, 300, 420, 560];

      if (step < fastSteps) {
        setFace(randomFace());
        schedule(() => rollNumbers(step + 1), 55);
        return;
      }

      const slowStep = step - fastSteps;
      if (slowStep < slowDelays.length) {
        setFace(randomFace());
        schedule(() => rollNumbers(step + 1), slowDelays[slowStep]);
        return;
      }

      setFace(20);
      schedule(() => rollNumbers(0), 800);
    };

    rollNumbers();

    return () => {
      cancelled = true;
      timers.forEach(clearTimeout);
    };
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotate.value}deg` }],
  }));

  const fontSize = size * 0.28;

  return (
    <View style={[styles.wrapper, { width: size, height: size }, style]}>
      <Animated.View style={[styles.die, animatedStyle]}>
        <Svg width={size} height={size} viewBox="0 0 100 100">
          <Polygon
            points="50,8 88,28 88,72 50,92 12,72 12,28"
            fill={dieColor}
            stroke={colors.d20Stroke}
            strokeWidth="2"
          />
          <Line x1="50" y1="8" x2="50" y2="92" stroke="#FFFFFF55" strokeWidth="1.5" />
          <Line x1="12" y1="28" x2="88" y2="72" stroke="#FFFFFF55" strokeWidth="1.5" />
          <Line x1="12" y1="72" x2="88" y2="28" stroke="#FFFFFF55" strokeWidth="1.5" />
          <Line x1="50" y1="8" x2="12" y2="72" stroke="#FFFFFF33" strokeWidth="1" />
          <Line x1="50" y1="8" x2="88" y2="72" stroke="#FFFFFF33" strokeWidth="1" />
        </Svg>
      </Animated.View>

      <View style={styles.face} pointerEvents="none">
        <Text style={[styles.faceText, { fontSize, color: colors.onPrimary }]}>{face}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  die: {
    ...StyleSheet.absoluteFill,
  },
  face: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  faceText: {
    fontWeight: '700',
    includeFontPadding: false,
  },
});
