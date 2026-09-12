import { Image } from 'expo-image';
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import {
  ImageBackground,
  Platform,
  StyleSheet,
  View,
  type ImageSourcePropType,
  type ViewStyle,
} from 'react-native';

import {
  isAuthSlideLoaded,
  markAuthSlideLoaded,
} from '@/components/auth/auth-slideshow.cache';
import {
  AUTH_SLIDESHOW_FADE_MS,
  AUTH_SLIDESHOW_IMAGES,
  AUTH_SLIDESHOW_INTERVAL_MS,
} from '@/constants/auth-slideshow.config';

const isWeb = Platform.OS === 'web';

type AuthScreenBackgroundProps = {
  children: ReactNode;
};

export function AuthScreenBackground({ children }: AuthScreenBackgroundProps) {
  const slideCount = AUTH_SLIDESHOW_IMAGES.length;

  if (slideCount === 0) {
    return <View style={styles.fallback}>{children}</View>;
  }

  if (isWeb) {
    return (
      <View style={styles.fallback}>
        <WebBackground slideCount={slideCount} />
        {children}
      </View>
    );
  }

  return (
    <NativeBackground source={AUTH_SLIDESHOW_IMAGES[0]}>{children}</NativeBackground>
  );
}

type NativeBackgroundProps = {
  source: ImageSourcePropType;
  children: ReactNode;
};

function NativeBackground({ source, children }: NativeBackgroundProps) {
  return (
    <ImageBackground source={source} style={styles.fill} resizeMode="cover">
      <View style={styles.dim}>{children}</View>
    </ImageBackground>
  );
}

type WebBackgroundProps = {
  slideCount: number;
};

function WebBackground({ slideCount }: WebBackgroundProps) {
  const [index, setIndex] = useState(0);
  const cachedOnMount = isAuthSlideLoaded(0);
  const isSlideshow = slideCount > 1;
  const [webVisible, setWebVisible] = useState(cachedOnMount);
  const [animateWebFade, setAnimateWebFade] = useState(!cachedOnMount);
  const previousIndex = useRef(index);

  const showImage = useCallback((slideIndex: number, animated: boolean) => {
    markAuthSlideLoaded(slideIndex);
    setAnimateWebFade(animated);
    setWebVisible(true);
  }, []);

  const hideImage = useCallback((onComplete?: () => void) => {
    setWebVisible(false);
    onComplete?.();
  }, []);

  const handleImageLoad = useCallback(() => {
    showImage(index, !isAuthSlideLoaded(index));
  }, [index, showImage]);

  useEffect(() => {
    if (previousIndex.current === index) {
      return;
    }

    previousIndex.current = index;

    if (isAuthSlideLoaded(index)) {
      showImage(index, false);
      return;
    }

    setAnimateWebFade(true);
    setWebVisible(false);
  }, [index, showImage]);

  useEffect(() => {
    if (!isSlideshow) {
      return;
    }

    const interval = setInterval(() => {
      const nextIndex = (index + 1) % slideCount;

      if (isAuthSlideLoaded(nextIndex)) {
        setIndex(nextIndex);
        return;
      }

      hideImage(() => setIndex(nextIndex));
    }, AUTH_SLIDESHOW_INTERVAL_MS);

    return () => clearInterval(interval);
  }, [hideImage, index, isSlideshow, slideCount]);

  useEffect(() => {
    if (isAuthSlideLoaded(index)) {
      return;
    }

    const fallback = setTimeout(() => showImage(index, false), 300);
    return () => clearTimeout(fallback);
  }, [index, showImage]);

  const webFadeStyle: ViewStyle = {
    ...StyleSheet.absoluteFillObject,
    opacity: webVisible ? 1 : 0,
    ...(animateWebFade
      ? {
          transitionProperty: 'opacity',
          transitionDuration: `${AUTH_SLIDESHOW_FADE_MS}ms`,
          transitionTimingFunction: 'ease',
        }
      : null),
  };

  return (
    <View style={styles.layer} pointerEvents="none">
      <View style={webFadeStyle}>
        <Image
          key={`slide-${index}`}
          source={AUTH_SLIDESHOW_IMAGES[index]}
          style={StyleSheet.absoluteFillObject}
          contentFit="cover"
          cachePolicy="memory-disk"
          priority="high"
          transition={0}
          onLoad={handleImageLoad}
          onDisplay={handleImageLoad}
          onError={() => showImage(index, false)}
        />
      </View>
      <View style={styles.webOverlay} />
    </View>
  );
}

const styles = StyleSheet.create({
  fill: {
    flex: 1,
    backgroundColor: '#0a0a0a',
  },
  fallback: {
    flex: 1,
    position: 'relative',
    backgroundColor: '#0a0a0a',
  },
  dim: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
  },
  layer: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 0,
    backgroundColor: '#0a0a0a',
  },
  webOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
  },
});
