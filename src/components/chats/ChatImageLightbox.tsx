import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useEffect, useMemo, useState } from 'react';
import { Modal, Platform, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const MIN_SCALE = 1;
const MAX_SCALE = 4;

type ChatImageLightboxProps = {
  /** @deprecated Prefer `uris` + `index`. */
  uri?: string | null;
  uris?: string[] | null;
  index?: number;
  onClose: () => void;
};

export function ChatImageLightbox({
  uri = null,
  uris = null,
  index = 0,
  onClose,
}: ChatImageLightboxProps) {
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const gallery = useMemo(() => {
    if (uris && uris.length > 0) {
      return uris.filter(Boolean);
    }
    return uri ? [uri] : [];
  }, [uri, uris]);
  const [activeIndex, setActiveIndex] = useState(0);
  const activeUri = gallery[activeIndex] ?? null;

  const scale = useSharedValue(1);
  const savedScale = useSharedValue(1);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const savedTranslateX = useSharedValue(0);
  const savedTranslateY = useSharedValue(0);

  useEffect(() => {
    if (gallery.length === 0) {
      setActiveIndex(0);
      return;
    }
    setActiveIndex(Math.min(Math.max(index, 0), gallery.length - 1));
  }, [gallery, index]);

  useEffect(() => {
    if (!activeUri) {
      return;
    }
    scale.value = 1;
    savedScale.value = 1;
    translateX.value = 0;
    translateY.value = 0;
    savedTranslateX.value = 0;
    savedTranslateY.value = 0;
  }, [activeUri, scale, savedScale, translateX, translateY, savedTranslateX, savedTranslateY]);

  useEffect(() => {
    if (Platform.OS !== 'web' || !activeUri || typeof window === 'undefined') {
      return;
    }

    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      const delta = event.deltaY > 0 ? 0.9 : 1.1;
      const next = Math.min(MAX_SCALE, Math.max(MIN_SCALE, scale.value * delta));
      scale.value = next;
      savedScale.value = next;
      if (next <= 1.01) {
        translateX.value = withTiming(0);
        translateY.value = withTiming(0);
        savedTranslateX.value = 0;
        savedTranslateY.value = 0;
      }
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'ArrowLeft') {
        setActiveIndex((current) => Math.max(0, current - 1));
      }
      if (event.key === 'ArrowRight') {
        setActiveIndex((current) => Math.min(gallery.length - 1, current + 1));
      }
      if (event.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('wheel', onWheel, { passive: false });
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('wheel', onWheel);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [
    activeUri,
    gallery.length,
    onClose,
    scale,
    savedScale,
    translateX,
    translateY,
    savedTranslateX,
    savedTranslateY,
  ]);

  const pinch = Gesture.Pinch()
    .onUpdate((event) => {
      const next = Math.min(MAX_SCALE, Math.max(MIN_SCALE, savedScale.value * event.scale));
      scale.value = next;
    })
    .onEnd(() => {
      savedScale.value = scale.value;
      if (scale.value <= 1.01) {
        scale.value = withTiming(1);
        savedScale.value = 1;
        translateX.value = withTiming(0);
        translateY.value = withTiming(0);
        savedTranslateX.value = 0;
        savedTranslateY.value = 0;
      }
    });

  const pan = Gesture.Pan()
    .onUpdate((event) => {
      if (scale.value <= 1) {
        return;
      }
      translateX.value = savedTranslateX.value + event.translationX;
      translateY.value = savedTranslateY.value + event.translationY;
    })
    .onEnd(() => {
      savedTranslateX.value = translateX.value;
      savedTranslateY.value = translateY.value;
    });

  const doubleTap = Gesture.Tap()
    .numberOfTaps(2)
    .onEnd(() => {
      if (scale.value > 1.01) {
        scale.value = withTiming(1);
        savedScale.value = 1;
        translateX.value = withTiming(0);
        translateY.value = withTiming(0);
        savedTranslateX.value = 0;
        savedTranslateY.value = 0;
      } else {
        scale.value = withTiming(2.2);
        savedScale.value = 2.2;
      }
    });

  const composed = Gesture.Simultaneous(pinch, pan, doubleTap);

  const imageStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { scale: scale.value },
    ],
  }));

  const showNav = gallery.length > 1;

  return (
    <Modal visible={gallery.length > 0} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.root}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Закрыть"
          onPress={onClose}
          style={[styles.closeButton, { top: insets.top + 12 }]}>
          <Ionicons name="close" size={24} color="#fff" />
        </Pressable>

        {showNav ? (
          <Text style={[styles.counter, { top: insets.top + 22 }]}>
            {activeIndex + 1} / {gallery.length}
          </Text>
        ) : null}

        {showNav ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Предыдущее фото"
            disabled={activeIndex <= 0}
            onPress={() => setActiveIndex((current) => Math.max(0, current - 1))}
            style={[
              styles.navButton,
              styles.navButtonLeft,
              activeIndex <= 0 && styles.navButtonDisabled,
            ]}>
            <Ionicons name="chevron-back" size={28} color="#fff" />
          </Pressable>
        ) : null}

        {showNav ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Следующее фото"
            disabled={activeIndex >= gallery.length - 1}
            onPress={() =>
              setActiveIndex((current) => Math.min(gallery.length - 1, current + 1))
            }
            style={[
              styles.navButton,
              styles.navButtonRight,
              activeIndex >= gallery.length - 1 && styles.navButtonDisabled,
            ]}>
            <Ionicons name="chevron-forward" size={28} color="#fff" />
          </Pressable>
        ) : null}

        {activeUri ? (
          <GestureDetector gesture={composed}>
            <Animated.View
              style={[
                styles.imageWrap,
                { width, height: height * 0.82 },
                imageStyle,
                Platform.OS === 'web' ? ({ touchAction: 'none' } as object) : null,
              ]}>
              <Image source={{ uri: activeUri }} style={styles.image} contentFit="contain" />
            </Animated.View>
          </GestureDetector>
        ) : null}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.92)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeButton: {
    position: 'absolute',
    right: 16,
    zIndex: 2,
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.14)',
  },
  counter: {
    position: 'absolute',
    alignSelf: 'center',
    zIndex: 2,
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  navButton: {
    position: 'absolute',
    zIndex: 2,
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.14)',
  },
  navButtonLeft: {
    left: 12,
  },
  navButtonRight: {
    right: 12,
  },
  navButtonDisabled: {
    opacity: 0.35,
  },
  imageWrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  image: {
    width: '100%',
    height: '100%',
  },
});
