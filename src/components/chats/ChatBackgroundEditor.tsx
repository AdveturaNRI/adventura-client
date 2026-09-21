import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
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

import {
  CHAT_BG_CROP,
  CHAT_BG_EFFECTS,
  renderChatBackgroundImage,
  resolveChatCropFrame,
  type ChatBgEffect,
} from '@/components/chats/chat-background-editor.utils';
import {
  clampTranslation,
  clampTranslationPlain,
  resolveBaseScale,
} from '@/components/questionnaire/photo-crop.utils';
import { FontSize, Spacing, type ThemeColors } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useThemedStyles } from '@/hooks/use-themed-styles';
import { localizeErrorMessage } from '@/utils/localizeError';
import { toast } from '@/components/ui';

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

type ChatBackgroundEditorProps = {
  visible: boolean;
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
      backgroundColor: '#0B0D12',
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
      color: '#FFFFFF',
    },
    headerActionMuted: {
      color: 'rgba(255,255,255,0.55)',
    },
    headerTitle: {
      flex: 1,
      textAlign: 'center',
      fontSize: FontSize.label,
      fontWeight: '600',
      color: '#FFFFFF',
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
    dim: {
      position: 'absolute',
      backgroundColor: 'rgba(0,0,0,0.58)',
    },
    cropFrame: {
      position: 'absolute',
      borderWidth: 2,
      borderColor: '#FFFFFF',
      borderRadius: 12,
      overflow: 'hidden',
    },
    footer: {
      paddingHorizontal: Spacing.lg,
      paddingTop: Spacing.sm,
      gap: Spacing.sm,
    },
    hint: {
      fontSize: FontSize.caption,
      color: 'rgba(255,255,255,0.55)',
      textAlign: 'center',
      lineHeight: FontSize.caption * 1.45,
    },
    effectsRow: {
      flexDirection: 'row',
      gap: Spacing.sm,
      justifyContent: 'center',
      flexWrap: 'wrap',
    },
    effectChip: {
      minHeight: 36,
      paddingHorizontal: 14,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.22)',
      backgroundColor: 'rgba(255,255,255,0.08)',
      alignItems: 'center',
      justifyContent: 'center',
      flexDirection: 'row',
      gap: 6,
    },
    effectChipActive: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    effectChipLabel: {
      fontSize: FontSize.caption,
      fontWeight: '600',
      color: 'rgba(255,255,255,0.85)',
    },
    effectChipLabelActive: {
      color: colors.onPrimary,
    },
    saveButton: {
      width: '100%',
      minHeight: 48,
      borderRadius: 999,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.primary,
      marginTop: Spacing.xs,
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
  });
}

export function ChatBackgroundEditor({
  visible,
  imageUri,
  imageWidth,
  imageHeight,
  onCancel,
  onSave,
}: ChatBackgroundEditorProps) {
  const colors = useTheme();
  const styles = useThemedStyles(createStyles);
  const insets = useSafeAreaInsets();
  const { height: screenHeight } = useWindowDimensions();
  const [canvasSize, setCanvasSize] = useState({ width: 0, height: screenHeight * 0.55 });
  const [isSaving, setIsSaving] = useState(false);
  const [effect, setEffect] = useState<ChatBgEffect>('blur');
  const [touchHint, setTouchHint] = useState(() => isTouchPrimaryDevice());

  const cropFrame = useMemo(
    () =>
      canvasSize.width > 0
        ? resolveChatCropFrame(
            canvasSize.width,
            canvasSize.height,
            CHAT_BG_CROP.aspectRatio,
            Spacing.md,
          )
        : null,
    [canvasSize.height, canvasSize.width],
  );

  const baseScale = useMemo(() => {
    if (!cropFrame) return 1;
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
      setEffect('blur');
    }
  }, [visible, imageUri, resetTransform]);

  const clampCurrentTranslation = useCallback(() => {
    if (!cropFrame) return;
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
      if (!cropFrame) return;
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
          if (cropWidth === 0 || cropHeight === 0) return;
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
          if (cropWidth === 0 || cropHeight === 0) return;
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

  useEffect(() => {
    if (!IS_WEB || !visible) return;
    const node = canvasRef.current as unknown as HTMLElement | null;
    if (!node || typeof window === 'undefined') return;

    setTouchHint(isTouchPrimaryDevice());

    let dragging = false;
    let lastX = 0;
    let lastY = 0;
    let pinchStartDist = 0;
    let pinchBaseScale = 1;

    const applyPan = (dx: number, dy: number) => {
      const next = clampTranslationPlain(
        translateX.value + dx,
        translateY.value + dy,
        scale.value,
        imageWidth,
        imageHeight,
        baseScale,
        cropWidth,
        cropHeight,
      );
      translateX.value = next.x;
      translateY.value = next.y;
    };

    const onMouseDown = (event: MouseEvent) => {
      if (event.button !== 0) return;
      event.preventDefault();
      dragging = true;
      lastX = event.clientX;
      lastY = event.clientY;
      node.style.cursor = 'grabbing';
    };

    const onMouseMove = (event: MouseEvent) => {
      if (!dragging) return;
      applyPan(event.clientX - lastX, event.clientY - lastY);
      lastX = event.clientX;
      lastY = event.clientY;
    };

    const stopMouseDrag = () => {
      if (!dragging) return;
      dragging = false;
      node.style.cursor = 'grab';
      clampCurrentTranslation();
    };

    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      adjustScale(event.deltaY > 0 ? -0.12 : 0.12);
    };

    const onTouchStart = (event: TouchEvent) => {
      if (event.touches.length === 1) {
        dragging = true;
        lastX = event.touches[0].clientX;
        lastY = event.touches[0].clientY;
      } else if (event.touches.length === 2) {
        dragging = false;
        pinchStartDist = touchDistance(event.touches[0], event.touches[1]);
        pinchBaseScale = scale.value;
      }
    };

    const onTouchMove = (event: TouchEvent) => {
      event.preventDefault();
      if (event.touches.length === 1 && dragging) {
        const t = event.touches[0];
        applyPan(t.clientX - lastX, t.clientY - lastY);
        lastX = t.clientX;
        lastY = t.clientY;
      } else if (event.touches.length === 2 && pinchStartDist > 0) {
        const dist = touchDistance(event.touches[0], event.touches[1]);
        const nextScale = Math.min(
          MAX_SCALE,
          Math.max(MIN_SCALE, pinchBaseScale * (dist / pinchStartDist)),
        );
        scale.value = nextScale;
        const clamped = clampTranslationPlain(
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
      }
    };

    const onTouchEnd = () => {
      dragging = false;
      pinchStartDist = 0;
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
    if (isSaving || !cropFrame) return;
    setIsSaving(true);
    try {
      const uri = await renderChatBackgroundImage({
        imageUri,
        imageWidth,
        imageHeight,
        baseScale,
        userScale: scale.value,
        translateX: translateX.value,
        translateY: translateY.value,
        cropFrame,
        effect,
        blurPx: 16,
      });
      onSave(uri);
    } catch (error) {
      toast.error(localizeErrorMessage(error, 'Не удалось обработать фон'));
    } finally {
      setIsSaving(false);
    }
  };

  const displayWidth = imageWidth * baseScale;
  const displayHeight = imageHeight * baseScale;
  const effectMeta = CHAT_BG_EFFECTS.find((item) => item.id === effect);

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
            <Text style={styles.headerTitle}>{CHAT_BG_CROP.title}</Text>
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
                    {
                      position: 'absolute',
                      left: cropFrame.centerX - displayWidth / 2,
                      top: cropFrame.centerY - displayHeight / 2,
                      width: displayWidth,
                      height: displayHeight,
                      zIndex: 0,
                    },
                    imageAnimatedStyle,
                    { pointerEvents: 'none' } as object,
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

                <View pointerEvents="none" style={StyleSheet.absoluteFill}>
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
                      {
                        left: cropFrame.left,
                        top: cropFrame.top,
                        width: cropFrame.width,
                        height: cropFrame.height,
                      },
                      effect === 'blur' && IS_WEB
                        ? ({
                            backdropFilter: 'blur(12px)',
                            WebkitBackdropFilter: 'blur(12px)',
                            backgroundColor: 'rgba(0,0,0,0.18)',
                          } as object)
                        : null,
                      effect === 'gradient' && IS_WEB
                        ? ({
                            backdropFilter: 'blur(20px) saturate(1.2)',
                            WebkitBackdropFilter: 'blur(20px) saturate(1.2)',
                            backgroundImage:
                              'linear-gradient(180deg, rgba(40,55,80,0.45) 0%, rgba(10,12,18,0.72) 100%)',
                          } as object)
                        : null,
                      effect === 'gradient' && !IS_WEB
                        ? { backgroundColor: 'rgba(12,14,20,0.45)' }
                        : null,
                      effect === 'blur' && !IS_WEB
                        ? { backgroundColor: 'rgba(0,0,0,0.2)' }
                        : null,
                    ]}
                  />
                </View>

                <View pointerEvents="box-none" style={styles.zoomControls}>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Уменьшить"
                    onPress={() => adjustScale(-0.2)}
                    style={styles.zoomButton}>
                    <Ionicons name="remove" size={20} color="#FFFFFF" />
                  </Pressable>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Увеличить"
                    onPress={() => adjustScale(0.2)}
                    style={styles.zoomButton}>
                    <Ionicons name="add" size={20} color="#FFFFFF" />
                  </Pressable>
                </View>
              </>
            ) : null}
          </View>

          <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, Spacing.md) }]}>
            <View style={styles.effectsRow}>
              {CHAT_BG_EFFECTS.map((item) => {
                const active = effect === item.id;
                return (
                  <Pressable
                    key={item.id}
                    accessibilityRole="button"
                    accessibilityState={{ selected: active }}
                    onPress={() => setEffect(item.id)}
                    style={[styles.effectChip, active && styles.effectChipActive]}>
                    <Ionicons
                      name={
                        item.id === 'photo'
                          ? 'image-outline'
                          : item.id === 'blur'
                            ? 'water-outline'
                            : 'color-palette-outline'
                      }
                      size={14}
                      color={active ? colors.onPrimary : 'rgba(255,255,255,0.85)'}
                    />
                    <Text
                      style={[
                        styles.effectChipLabel,
                        active && styles.effectChipLabelActive,
                      ]}>
                      {item.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
            <Text style={styles.hint}>{effectMeta?.hint ?? CHAT_BG_CROP.hint}</Text>
            <Text style={styles.hint}>
              {touchHint
                ? 'Двигайте и щипком масштабируйте область фона'
                : 'Тяните мышью, колёсико или ± для масштаба'}
            </Text>
            <Pressable
              accessibilityRole="button"
              onPress={() => void handleSave()}
              disabled={isSaving}
              style={({ pressed }) => [
                styles.saveButton,
                (pressed || isSaving) && styles.saveButtonDisabled,
              ]}>
              {isSaving ? (
                <ActivityIndicator color={colors.onPrimary} />
              ) : (
                <Text style={styles.saveButtonText}>Применить фон</Text>
              )}
            </Pressable>
          </View>
        </View>
      </GestureHandlerRootView>
    </Modal>
  );
}
