import { useEffect } from 'react';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { D20Loader } from '@/components/ui';
import { FontSize, Spacing, type ThemeColors } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useThemedStyles } from '@/hooks/use-themed-styles';

type ArtCanvasLoaderProps = {
  label?: string;
  hint?: string;
  style?: StyleProp<ViewStyle>;
  /** Компактный оверлей поверх уже существующей картинки */
  overlay?: boolean;
};

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    root: {
      alignItems: 'center',
      justifyContent: 'center',
      gap: Spacing.sm,
      padding: Spacing.lg,
      overflow: 'hidden',
    },
    overlay: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: 'rgba(8, 12, 20, 0.55)',
      zIndex: 2,
    },
    shimmer: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: 'rgba(21, 122, 254, 0.18)',
    },
    title: {
      fontSize: FontSize.button,
      fontWeight: '700',
      color: colors.text,
      textAlign: 'center',
    },
    titleOverlay: {
      color: '#FFFFFF',
    },
    hint: {
      fontSize: FontSize.label,
      color: colors.textMuted,
      textAlign: 'center',
      lineHeight: FontSize.label * 1.4,
      maxWidth: 280,
    },
    hintOverlay: {
      color: 'rgba(255,255,255,0.82)',
    },
  });
}

export function ArtCanvasLoader({
  label = 'Рисуем арт…',
  hint = 'Обычно полминуты. Можно свернуть вкладку — холст обновится сам.',
  style,
  overlay = false,
}: ArtCanvasLoaderProps) {
  const colors = useTheme();
  const styles = useThemedStyles(createStyles);
  const pulse = useSharedValue(0.35);
  const sweep = useSharedValue(-1);

  useEffect(() => {
    pulse.value = withRepeat(
      withTiming(0.85, { duration: 1100, easing: Easing.inOut(Easing.quad) }),
      -1,
      true,
    );
    sweep.value = withRepeat(
      withTiming(1, { duration: 1600, easing: Easing.inOut(Easing.cubic) }),
      -1,
      false,
    );
  }, [pulse, sweep]);

  const shimmerStyle = useAnimatedStyle(() => ({
    opacity: pulse.value,
    transform: [{ translateX: sweep.value * 120 }],
  }));

  return (
    <View style={[styles.root, overlay && styles.overlay, style]}>
      {!overlay ? <Animated.View pointerEvents="none" style={[styles.shimmer, shimmerStyle]} /> : null}
      <D20Loader size={overlay ? 56 : 72} color={overlay ? '#FFFFFF' : colors.primary} />
      <Text style={[styles.title, overlay && styles.titleOverlay]}>{label}</Text>
      {hint ? (
        <Text style={[styles.hint, overlay && styles.hintOverlay]}>{hint}</Text>
      ) : null}
    </View>
  );
}
