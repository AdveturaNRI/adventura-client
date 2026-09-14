import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { Gesture, GestureDetector, GestureHandlerRootView, MouseButton } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { PHOTO_CROP_PRESETS, type PhotoCropVariant } from '@/components/questionnaire/photo-crop.config';
import {
  clampTranslation,
  clampTranslationPlain,
  computeCropRect,
  resolveBaseScale,
  resolveCropFrame,
} from '@/components/questionnaire/photo-crop.utils';
import { FontSize, Spacing, type ThemeColors } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useThemedStyles } from '@/hooks/use-themed-styles';

const MIN_SCALE = 1;
const MAX_SCALE = 4;
const IS_WEB = Platform.OS === 'web';

function isTouchPrimaryDevice() {
  if (!IS_WEB || typeof window === 'undefined') {
    return !IS_WEB;
  }

  try {
    return window.matchMedia('(hover: none), (pointer: coarse)').matches;
  } catch {
    return typeof navigator !== 'undefined' && navigator.maxTouchPoints > 0;
  }
}

function touchDistance(
  a: { clientX: number; clientY: number },
  b: { clientX: number; clientY: number },
) {
  return Math.hypot(b.clientX - a.clientX, b.clientY - a.clientY);
}

type PhotoCropEditorProps = {
  visible: boolean;
  variant: PhotoCropVariant;
  imageUri: string;
  imageWidth: number;
  imageHeight: number;
  onCancel: () => void;
  onSave: (uri: string) => void;
};

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    root: {
      flex: 1,
      backgroundColor: colors.text,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: Spacing.md,
      paddingVertical: Spacing.sm,
      gap: Spacing.sm,
    },
    headerAction: {
      minWidth: 72,
      paddingVertical: Spacing.sm,
    },
    headerActionText: {
      fontSize: FontSize.button,
      fontWeight: '500',
      color: colors.onPrimary,
    },
    headerActionMuted: {
      color: colors.textSubtle,
    },
    headerTitle: {
      flex: 1,
      textAlign: 'center',
      fontSize: FontSize.label,
      fontWeight: '600',
      color: colors.onPrimary,
    },
    canvas: {
      flex: 1,
      overflow: 'hidden',
      ...(Platform.OS === 'web'
        ? ({
            touchAction: 'none',
            WebkitUserSelect: 'none',
            userSelect: 'none',
          } as object)
        : null),
    },
    gestureSurface: {
      ...StyleSheet.absoluteFill,
      zIndex: 1,
      ...(Platform.OS === 'web'
        ? ({
            touchAction: 'none',
            WebkitUserSelect: 'none',
            userSelect: 'none',
          } as object)
        : null),
    },
    imageLayer: {
      zIndex: 0,
    },
    overlayLayer: {
      zIndex: 2,
    },
    dim: {
      position: 'absolute',
      backgroundColor: 'rgba(0,0,0,0.55)',
    },
    cropFrame: {
      position: 'absolute',
      borderWidth: 2,
      borderColor: colors.onPrimary,
    },
    cropFrameCircle: {
      borderRadius: 999,
    },
    footer: {
      alignItems: 'center',
      paddingHorizontal: Spacing.lg,
      paddingTop: Spacing.md,
      gap: Spacing.md,
    },
    hint: {
      fontSize: FontSize.caption,
      color: colors.textSubtle,
      textAlign: 'center',
      lineHeight: FontSize.caption * 1.5,
    },
    saveButton: {
      width: '100%',
      minHeight: 48,
      borderRadius: 999,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.primary,
    },
    saveButtonDisabled: {
      opacity: 0.7,
    },
    saveButtonText: {
      fontSize: FontSize.button,
      fontWeight: '600',
      color: colors.onPrimary,
    },
    zoomControls: {
      position: 'absolute',
      right: Spacing.md,
      bottom: Spacing.md,
      zIndex: 4,
      gap: Spacing.sm,
    },
    zoomButton: {
      width: 40,
      height: 40,
      borderRadius: 20,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'rgba(0,0,0,0.45)',
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.25)',
    },
    zoomButtonPressed: {
      opacity: 0.85,
    },
  });
}

export function PhotoCropEditor({
  visible,
  variant,
  imageUri,
  imageWidth,
  imageHeight,
  onCancel,
  onSave,
}: PhotoCropEditorProps) {
  const preset = PHOTO_CROP_PRESETS[variant];
  const colors = useTheme();
  const styles = useThemedStyles(createStyles);
  const insets = useSafeAreaInsets();
  const { height: screenHeight } = useWindowDimensions();
  const [canvasSize, setCanvasSize] = useState({ width: 0, height: screenHeight * 0.55 });
  const [isSaving, setIsSaving] = useState(false);

  const cropFrame = useMemo(
    () =>
      canvasSize.width > 0
        ? resolveCropFrame(canvasSize.width, canvasSize.height, preset.aspectRatio, Spacing.lg)
        : null,
    [canvasSize.height, canvasSize.width, preset.aspectRatio],
  );

  const baseScale = useMemo(() => {
    if (!cropFrame) {
      return 1;
    }

    return resolveBaseScale(imageWidth, imageHeight, cropFrame.width, cropFrame.height);
  }, [cropFrame, imageHeight, imageWidth]);

  const cropWidth = cropFrame?.width ?? 0;
  const cropHeight = cropFrame?.height ?? 0;

  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const scale = useSharedValue(1);
  const panStartX = useSharedValue(0);
  const panStartY = useSharedValue(0);
  const pinchStartScale = useSharedValue(1);

  const resetTransform = useCallback(() => {
    translateX.value = 0;
    translateY.value = 0;
    scale.value = 1;
  }, [scale, translateX, translateY]);

  useEffect(() => {
    if (visible) {
      resetTransform();
      setIsSaving(false);
    }
  }, [visible, imageUri, variant, resetTransform]);

  const clampCurrentTranslation = useCallback(() => {
    if (!cropFrame) {
      return;
    }

    const clamped = clampTranslation(
      translateX.value,
      translateY.value,
      scale.value,
      imageWidth,
      imageHeight,
      baseScale,
      cropFrame.width,
      cropFrame.height,
    );
    translateX.value = withTiming(clamped.x, { duration: 120 });
    translateY.value = withTiming(clamped.y, { duration: 120 });
  }, [baseScale, cropFrame, imageHeight, imageWidth, scale, translateX, translateY]);

  const adjustScale = useCallback(
    (delta: number) => {
      if (!cropFrame) {
        return;
      }

      const nextScale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, scale.value + delta));
      scale.value = nextScale;

      const clamped = clampTranslation(
        translateX.value,
        translateY.value,
        nextScale,
        imageWidth,
        imageHeight,
        baseScale,
        cropFrame.width,
        cropFrame.height,
      );
      translateX.value = clamped.x;
      translateY.value = clamped.y;
    },
    [baseScale, cropFrame, imageHeight, imageWidth, scale, translateX, translateY],
  );

  const panGesture = useMemo(
    () =>
      Gesture.Pan()
        .mouseButton(MouseButton.LEFT)
        .minDistance(0)
        .onBegin(() => {
          panStartX.value = translateX.value;
          panStartY.value = translateY.value;
        })
        .onUpdate((event) => {
          if (cropWidth === 0 || cropHeight === 0) {
            return;
          }

          const clamped = clampTranslation(
            panStartX.value + event.translationX,
            panStartY.value + event.translationY,
            scale.value,
            imageWidth,
            imageHeight,
            baseScale,
            cropWidth,
            cropHeight,
          );
          translateX.value = clamped.x;
          translateY.value = clamped.y;
        })
        .onEnd(() => {
          runOnJS(clampCurrentTranslation)();
        }),
    [
      baseScale,
      clampCurrentTranslation,
      cropHeight,
      cropWidth,
      imageHeight,
      imageWidth,
      panStartX,
      panStartY,
      scale,
      translateX,
      translateY,
    ],
  );

  const pinchGesture = useMemo(
    () =>
      Gesture.Pinch()
        .onBegin(() => {
          pinchStartScale.value = scale.value;
        })
        .onUpdate((event) => {
          if (cropWidth === 0 || cropHeight === 0) {
            return;
          }

          const nextScale = Math.min(
            MAX_SCALE,
            Math.max(MIN_SCALE, pinchStartScale.value * event.scale),
          );
          scale.value = nextScale;

          const clamped = clampTranslation(
            translateX.value,
            translateY.value,
            nextScale,
            imageWidth,
            imageHeight,
            baseScale,
            cropWidth,
            cropHeight,
          );
          translateX.value = clamped.x;
          translateY.value = clamped.y;
        })
        .onEnd(() => {
          runOnJS(clampCurrentTranslation)();
        }),
    [
      baseScale,
      clampCurrentTranslation,
      cropHeight,
      cropWidth,
      imageHeight,
      imageWidth,
      pinchStartScale,
      scale,
      translateX,
      translateY,
    ],
  );

  const composedGesture = useMemo(
    () => Gesture.Simultaneous(panGesture, pinchGesture),
    [panGesture, pinchGesture],
  );

  const canvasRef = useRef<View>(null);
  const [touchHint, setTouchHint] = useState(() => isTouchPrimaryDevice());

  useEffect(() => {
    if (!IS_WEB || typeof window === 'undefined') {
      return;
    }

    const media = window.matchMedia('(hover: none), (pointer: coarse)');
    const sync = () => setTouchHint(media.matches);
    sync();

    if (typeof media.addEventListener === 'function') {
      media.addEventListener('change', sync);
      return () => media.removeEventListener('change', sync);
    }

    media.addListener(sync);
    return () => media.removeListener(sync);
  }, []);

  useEffect(() => {
    if (!IS_WEB || !visible || cropWidth === 0 || cropHeight === 0) {
      return;
    }

    const node = canvasRef.current as unknown as HTMLElement | null;
    if (!node) {
      return;
    }

    let isMouseDragging = false;
    let pointerStartX = 0;
    let pointerStartY = 0;
    let dragStartX = 0;
    let dragStartY = 0;

    const activeTouches = new Map<number, { clientX: number; clientY: number }>();
    let touchMode: 'none' | 'pan' | 'pinch' = 'none';
    let pinchStartDistance = 0;
    let pinchStartScaleValue = 1;

    const applyTranslation = (nextX: number, nextY: number) => {
      const clamped = clampTranslationPlain(
        nextX,
        nextY,
        scale.value,
        imageWidth,
        imageHeight,
        baseScale,
        cropWidth,
        cropHeight,
      );
      translateX.value = clamped.x;
      translateY.value = clamped.y;
    };

    const applyScale = (nextScale: number) => {
      const clampedScale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, nextScale));
      scale.value = clampedScale;

      const clamped = clampTranslationPlain(
        translateX.value,
        translateY.value,
        clampedScale,
        imageWidth,
        imageHeight,
        baseScale,
        cropWidth,
        cropHeight,
      );
      translateX.value = clamped.x;
      translateY.value = clamped.y;
    };

    const beginPanFromTouch = (touch: { clientX: number; clientY: number }) => {
      touchMode = 'pan';
      pointerStartX = touch.clientX;
      pointerStartY = touch.clientY;
      dragStartX = translateX.value;
      dragStartY = translateY.value;
    };

    const beginPinchFromTouches = (
      first: { clientX: number; clientY: number },
      second: { clientX: number; clientY: number },
    ) => {
      touchMode = 'pinch';
      pinchStartDistance = Math.max(touchDistance(first, second), 1);
      pinchStartScaleValue = scale.value;
    };

    const onMouseDown = (event: MouseEvent) => {
      if (event.button !== 0 || activeTouches.size > 0) {
        return;
      }

      isMouseDragging = true;
      pointerStartX = event.clientX;
      pointerStartY = event.clientY;
      dragStartX = translateX.value;
      dragStartY = translateY.value;
      node.style.cursor = 'grabbing';
      event.preventDefault();
    };

    const onMouseMove = (event: MouseEvent) => {
      if (!isMouseDragging) {
        return;
      }

      applyTranslation(
        dragStartX + event.clientX - pointerStartX,
        dragStartY + event.clientY - pointerStartY,
      );
    };

    const stopMouseDrag = () => {
      if (!isMouseDragging) {
        return;
      }

      isMouseDragging = false;
      node.style.cursor = 'grab';
      clampCurrentTranslation();
    };

    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      adjustScale(event.deltaY > 0 ? -0.12 : 0.12);
    };

    const onTouchStart = (event: TouchEvent) => {
      for (let index = 0; index < event.changedTouches.length; index += 1) {
        const touch = event.changedTouches.item(index);
        if (!touch) {
          continue;
        }
        activeTouches.set(touch.identifier, {
          clientX: touch.clientX,
          clientY: touch.clientY,
        });
      }

      const touches = [...activeTouches.values()];
      if (touches.length >= 2) {
        beginPinchFromTouches(touches[0], touches[1]);
      } else if (touches.length === 1) {
        beginPanFromTouch(touches[0]);
      }

      event.preventDefault();
    };

    const onTouchMove = (event: TouchEvent) => {
      for (let index = 0; index < event.changedTouches.length; index += 1) {
        const touch = event.changedTouches.item(index);
        if (!touch || !activeTouches.has(touch.identifier)) {
          continue;
        }
        activeTouches.set(touch.identifier, {
          clientX: touch.clientX,
          clientY: touch.clientY,
        });
      }

      const touches = [...activeTouches.values()];
      if (touchMode === 'pinch' && touches.length >= 2) {
        const distance = Math.max(touchDistance(touches[0], touches[1]), 1);
        applyScale(pinchStartScaleValue * (distance / pinchStartDistance));
      } else if (touchMode === 'pan' && touches.length === 1) {
        applyTranslation(
          dragStartX + touches[0].clientX - pointerStartX,
          dragStartY + touches[0].clientY - pointerStartY,
        );
      }

      event.preventDefault();
    };

    const onTouchEnd = (event: TouchEvent) => {
      for (let index = 0; index < event.changedTouches.length; index += 1) {
        const touch = event.changedTouches.item(index);
        if (!touch) {
          continue;
        }
        activeTouches.delete(touch.identifier);
      }

      const touches = [...activeTouches.values()];
      if (touches.length >= 2) {
        beginPinchFromTouches(touches[0], touches[1]);
        return;
      }

      if (touches.length === 1) {
        beginPanFromTouch(touches[0]);
        return;
      }

      touchMode = 'none';
      clampCurrentTranslation();
    };

    node.style.cursor = 'grab';
    node.style.touchAction = 'none';
    node.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', stopMouseDrag);
    node.addEventListener('wheel', onWheel, { passive: false });
    node.addEventListener('touchstart', onTouchStart, { passive: false });
    node.addEventListener('touchmove', onTouchMove, { passive: false });
    node.addEventListener('touchend', onTouchEnd, { passive: false });
    node.addEventListener('touchcancel', onTouchEnd, { passive: false });

    return () => {
      node.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', stopMouseDrag);
      node.removeEventListener('wheel', onWheel);
      node.removeEventListener('touchstart', onTouchStart);
      node.removeEventListener('touchmove', onTouchMove);
      node.removeEventListener('touchend', onTouchEnd);
      node.removeEventListener('touchcancel', onTouchEnd);
      node.style.cursor = '';
      node.style.touchAction = '';
    };
  }, [
    adjustScale,
    baseScale,
    clampCurrentTranslation,
    cropHeight,
    cropWidth,
    imageHeight,
    imageWidth,
    scale,
    translateX,
    translateY,
    visible,
  ]);

  const imageAnimatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { scale: scale.value },
    ],
  }));

  const handleSave = async () => {
    if (isSaving || !cropFrame) {
      return;
    }

    setIsSaving(true);

    try {
      const cropRect = computeCropRect(
        imageWidth,
        imageHeight,
        baseScale,
        scale.value,
        translateX.value,
        translateY.value,
        cropFrame,
      );

      const result = await manipulateAsync(
        imageUri,
        [
          { crop: cropRect },
          { resize: { width: preset.outputWidth, height: preset.outputHeight } },
        ],
        { compress: 0.92, format: SaveFormat.JPEG },
      );

      onSave(result.uri);
    } finally {
      setIsSaving(false);
    }
  };

  const displayWidth = imageWidth * baseScale;
  const displayHeight = imageHeight * baseScale;
  const interactionHint = touchHint
    ? 'Перетаскивайте и масштабируйте изображение пальцами'
    : 'Перетащите фото мышью, используйте колёсико или кнопки ± для масштаба.';

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onCancel}>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <View style={[styles.root, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
        <View style={styles.header}>
          <Pressable
            accessibilityRole="button"
            onPress={onCancel}
            disabled={isSaving}
            style={styles.headerAction}>
            <Text style={[styles.headerActionText, styles.headerActionMuted]}>Отмена</Text>
          </Pressable>

          <Text style={styles.headerTitle}>{preset.title}</Text>

          <View style={styles.headerAction} />
        </View>

        <View
          ref={canvasRef}
          style={styles.canvas}
          onLayout={(event) => {
            const { width, height } = event.nativeEvent.layout;
            setCanvasSize({ width, height });
          }}>
          {cropFrame ? (
            <>
              <Animated.View
                style={[
                  styles.imageLayer,
                  {
                    position: 'absolute',
                    left: cropFrame.centerX - displayWidth / 2,
                    top: cropFrame.centerY - displayHeight / 2,
                    width: displayWidth,
                    height: displayHeight,
                  },
                  imageAnimatedStyle,
                  Platform.OS === 'web'
                    ? ({ userSelect: 'none', pointerEvents: 'none' } as object)
                    : ({ pointerEvents: 'none' } as object),
                ]}>
                <Image
                  source={{ uri: imageUri }}
                  style={{ width: displayWidth, height: displayHeight }}
                  contentFit="fill"
                />
              </Animated.View>

              {IS_WEB ? (
                <View style={styles.gestureSurface} />
              ) : (
                <GestureDetector gesture={composedGesture}>
                  <Animated.View style={styles.gestureSurface} />
                </GestureDetector>
              )}

              <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.overlayLayer]}>
                <View style={[styles.dim, { top: 0, left: 0, right: 0, height: cropFrame.top }]} />
                <View
                  style={[
                    styles.dim,
                    {
                      top: cropFrame.top,
                      left: 0,
                      width: cropFrame.left,
                      height: cropFrame.height,
                    },
                  ]}
                />
                <View
                  style={[
                    styles.dim,
                    {
                      top: cropFrame.top,
                      left: cropFrame.left + cropFrame.width,
                      right: 0,
                      height: cropFrame.height,
                    },
                  ]}
                />
                <View
                  style={[
                    styles.dim,
                    {
                      top: cropFrame.top + cropFrame.height,
                      left: 0,
                      right: 0,
                      bottom: 0,
                    },
                  ]}
                />

                <View
                  style={[
                    styles.cropFrame,
                    preset.shape === 'circle' && styles.cropFrameCircle,
                    {
                      left: cropFrame.left,
                      top: cropFrame.top,
                      width: cropFrame.width,
                      height: cropFrame.height,
                    },
                  ]}
                />
              </View>

              <View pointerEvents="box-none" style={styles.zoomControls}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Уменьшить"
                  onPress={() => adjustScale(-0.2)}
                  style={({ pressed }) => [styles.zoomButton, pressed && styles.zoomButtonPressed]}>
                  <Ionicons name="remove" size={20} color={colors.onPrimary} />
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Увеличить"
                  onPress={() => adjustScale(0.2)}
                  style={({ pressed }) => [styles.zoomButton, pressed && styles.zoomButtonPressed]}>
                  <Ionicons name="add" size={20} color={colors.onPrimary} />
                </Pressable>
              </View>
            </>
          ) : null}
        </View>

        <View style={styles.footer}>
          <Text style={styles.hint}>{preset.hint}</Text>
          <Text style={styles.hint}>{interactionHint}</Text>

          <Pressable
            accessibilityRole="button"
            onPress={handleSave}
            disabled={isSaving}
            style={({ pressed }) => [
              styles.saveButton,
              (pressed || isSaving) && styles.saveButtonDisabled,
            ]}>
            {isSaving ? (
              <ActivityIndicator color={colors.onPrimary} />
            ) : (
              <Text style={styles.saveButtonText}>Готово</Text>
            )}
          </Pressable>
        </View>
        </View>
      </GestureHandlerRootView>
    </Modal>
  );
}
