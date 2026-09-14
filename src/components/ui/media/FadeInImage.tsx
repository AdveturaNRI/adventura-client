import { useEffect, useState, type ComponentProps } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
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
  uri: string;
  style?: StyleProp<ViewStyle>;
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
 * Remote image with a soft pulse skeleton while loading and a fade-in on ready.
 * Keeps the muted frame visible until the first paint so covers don't flash solid gray.
 */
export function FadeInImage({
  uri,
  style,
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

  useEffect(() => {
    setReady(false);
  }, [uri]);

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
      <Image
        {...imageProps}
        key={recyclingKey ?? uri}
        source={{ uri }}
        style={styles.image}
        contentFit={contentFit}
        transition={transitionMs}
        recyclingKey={recyclingKey ?? uri}
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
