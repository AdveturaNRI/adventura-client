import { useEffect, useState, type ComponentProps } from 'react';
import {
  StyleSheet,
  View,
  type ImageStyle,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { Image } from 'expo-image';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { useTheme } from '@/hooks/use-theme';

type FadeInImageProps = {
  /** Remote URL. Ignored when `source` is set (локальный require). */
  uri?: string;
  /** Локальный ассет: `require('…/cover.png')`. */
  source?: ComponentProps<typeof Image>['source'];
  style?: StyleProp<ViewStyle>;
  /** Extra styles for the inner Image (e.g. web objectPosition). */
  imageStyle?: StyleProp<ImageStyle>;
  contentFit?: ComponentProps<typeof Image>['contentFit'];
  /** Cross-fade duration once the image is ready. */
  transitionMs?: number;
  recyclingKey?: string;
  cachePolicy?: ComponentProps<typeof Image>['cachePolicy'];
} & Omit<
  ComponentProps<typeof Image>,
  'source' | 'style' | 'contentFit' | 'transition' | 'recyclingKey' | 'cachePolicy'
>;

/**
 * Image with a soft pulse skeleton while loading and a fade-in on ready.
 * Remote (`uri`) or bundled (`source` / require). Muted frame until first paint.
 */
export function FadeInImage({
  uri,
  source,
  style,
  imageStyle,
  contentFit = 'cover',
  transitionMs = 320,
  recyclingKey,
  cachePolicy = 'memory-disk',
  onLoad,
  onError,
  ...imageProps
}: FadeInImageProps) {
  const colors = useTheme();
  const [ready, setReady] = useState(false);
  const pulse = useSharedValue(0.55);
  const imageSource = source ?? (uri ? { uri } : undefined);
  const cacheKey = recyclingKey ?? uri ?? String(source);

  useEffect(() => {
    setReady(false);
  }, [cacheKey]);

  useEffect(() => {
    if (ready) {
      return;
    }
    pulse.value = 0.55;
    pulse.value = withRepeat(
      withTiming(1, { duration: 900, easing: Easing.inOut(Easing.quad) }),
      -1,
      true,
    );
  }, [pulse, ready]);

  const skeletonStyle = useAnimatedStyle(() => ({
    opacity: pulse.value,
  }));

  return (
    <View style={[styles.root, { backgroundColor: colors.placeholderAlt }, style]}>
      {!ready ? (
        <Animated.View
          pointerEvents="none"
          style={[
            StyleSheet.absoluteFill,
            { backgroundColor: colors.placeholder },
            skeletonStyle,
          ]}
        />
      ) : null}
      {imageSource ? (
        <Image
          {...imageProps}
          key={cacheKey}
          source={imageSource}
          style={[styles.image, imageStyle]}
          contentFit={contentFit}
          transition={transitionMs}
          recyclingKey={cacheKey}
          cachePolicy={cachePolicy}
          onLoad={(event) => {
            setReady(true);
            onLoad?.(event);
          }}
          onError={(event) => {
            setReady(true);
            onError?.(event);
          }}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    overflow: 'hidden',
  },
  image: {
    ...StyleSheet.absoluteFill,
    width: '100%',
    height: '100%',
  },
});
