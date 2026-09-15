import { Image } from 'expo-image';
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Platform, Pressable, StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Gesture, GestureDetector, MouseButton } from 'react-native-gesture-handler';
import Animated, {
  LinearTransition,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';

import { useIsDesktopWeb } from '@/components/navigation/DesktopThemeToggle';
import { type ThemeColors } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useThemedStyles } from '@/hooks/use-themed-styles';
import {
  filesFromDataTransfer,
  getWebHostNode,
  isFileDragEvent,
  isInsideWebNode,
} from '@/utils/web-file-drop';

type GalleryItem = {
  key: string;
  uri: string;
};

type ItemLayout = {
  x: number;
  y: number;
  width: number;
  height: number;
};

type ClubGalleryGridProps = {
  uris: string[];
  disabled?: boolean;
  canAdd?: boolean;
  onReorder: (next: string[]) => void;
  onRemove: (index: number) => void;
  onAdd: () => void;
  onDraggingChange?: (dragging: boolean) => void;
  onDropFiles?: (target: FileDropTarget, files: File[]) => void;
};

export type FileDropTarget = {
  mode: 'insert' | 'replace';
  index: number;
};

const PICKUP_SPRING = { damping: 15, stiffness: 340, mass: 0.55 };
const SLOT_LAYOUT = LinearTransition.springify().damping(20).stiffness(280).mass(0.75);
const IS_WEB = Platform.OS === 'web';
const ADD_LAYOUT_KEY = '__add__';

function isCoarsePointer() {
  if (!IS_WEB || typeof window === 'undefined') {
    return !IS_WEB;
  }
  try {
    return window.matchMedia('(hover: none), (pointer: coarse)').matches;
  } catch {
    return typeof navigator !== 'undefined' && navigator.maxTouchPoints > 0;
  }
}

function syncItems(uris: string[], previous: GalleryItem[]): GalleryItem[] {
  if (previous.length === uris.length && previous.every((item, index) => item.uri === uris[index])) {
    return previous;
  }

  const unused = [...previous];
  return uris.map((uri) => {
    const found = unused.findIndex((item) => item.uri === uri);
    if (found >= 0) {
      const [item] = unused.splice(found, 1);
      return item;
    }
    return { key: `${uri}-${Math.random().toString(36).slice(2, 9)}`, uri };
  });
}

function moveItem(items: GalleryItem[], from: number, to: number) {
  if (from === to || from < 0 || to < 0 || to >= items.length) {
    return items;
  }
  const next = [...items];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

function destinationIndexFromClient(
  clientX: number,
  clientY: number,
  items: GalleryItem[],
  rowNode: HTMLElement | null,
  canAdd: boolean,
  draggingKey: string,
) {
  const from = items.findIndex((item) => item.key === draggingKey);
  if (from < 0 || !rowNode) {
    return from;
  }

  const children = Array.from(rowNode.children) as HTMLElement[];
  const itemEls = canAdd ? children.slice(0, -1) : children;
  if (!itemEls.length) {
    return from;
  }

  let bestIndex = from;
  let bestDistance = Number.POSITIVE_INFINITY;
  for (let index = 0; index < itemEls.length; index += 1) {
    const rect = itemEls[index].getBoundingClientRect();
    const centerX = (rect.left + rect.right) / 2;
    const centerY = (rect.top + rect.bottom) / 2;
    const distance = (clientX - centerX) ** 2 + (clientY - centerY) ** 2;
    if (distance < bestDistance) {
      bestDistance = distance;
      bestIndex = index;
    }
  }

  const target = itemEls[bestIndex]?.getBoundingClientRect();
  if (!target) {
    return from;
  }
  const insertAt = clientX > (target.left + target.right) / 2 ? bestIndex + 1 : bestIndex;
  const dest = from < insertAt ? insertAt - 1 : insertAt;
  return Math.max(0, Math.min(items.length - 1, dest));
}

function containsClient(rect: DOMRect, x: number, y: number, pad = 0) {
  return (
    x >= rect.left - pad &&
    x <= rect.right + pad &&
    y >= rect.top - pad &&
    y <= rect.bottom + pad
  );
}

function resolveFileDropTargetFromClient(
  clientX: number,
  clientY: number,
  items: GalleryItem[],
  rowNode: HTMLElement | null,
  canAdd: boolean,
): FileDropTarget | null {
  if (!rowNode) return null;
  const children = Array.from(rowNode.children) as HTMLElement[];
  if (!children.length) return null;

  const addEl = canAdd ? children[children.length - 1] : null;
  const itemEls = canAdd ? children.slice(0, -1) : children;

  if (addEl && containsClient(addEl.getBoundingClientRect(), clientX, clientY)) {
    return { mode: 'insert', index: items.length };
  }

  for (let index = 0; index < itemEls.length && index < items.length; index += 1) {
    const rect = itemEls[index].getBoundingClientRect();
    if (!containsClient(rect, clientX, clientY, 4)) continue;

    const inset = Math.min(rect.width, rect.height) * 0.22;
    const inCenter =
      clientX >= rect.left + inset &&
      clientX <= rect.right - inset &&
      clientY >= rect.top + inset &&
      clientY <= rect.bottom - inset;
    if (inCenter) {
      return { mode: 'replace', index };
    }
    return {
      mode: 'insert',
      index: clientX > (rect.left + rect.right) / 2 ? index + 1 : index,
    };
  }

  return null;
}

function createStyles(colors: ThemeColors, size: number) {
  return StyleSheet.create({
    wrap: {
      position: 'relative',
      overflow: 'visible',
      zIndex: 2,
      ...(IS_WEB ? ({ userSelect: 'none' } as object) : null),
    },
    row: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
    },
    slot: {
      width: size,
      height: size,
      overflow: 'visible',
    },
    item: {
      width: size,
      height: size,
      borderRadius: 12,
      overflow: 'hidden',
      backgroundColor: colors.surfaceMuted,
      ...(IS_WEB ? ({ cursor: 'grab', touchAction: 'none' } as object) : null),
    },
    placeholder: {
      borderWidth: 2,
      borderStyle: 'dashed',
      borderColor: colors.primary,
      backgroundColor: 'rgba(21, 122, 254, 0.12)',
      overflow: 'visible',
    },
    replaceTarget: {
      borderWidth: 2,
      borderColor: colors.primary,
      overflow: 'hidden',
    },
    replaceOverlay: {
      ...StyleSheet.absoluteFill,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'rgba(21, 122, 254, 0.42)',
    },
    insertBar: {
      position: 'absolute',
      width: 4,
      borderRadius: 2,
      backgroundColor: colors.primary,
      zIndex: 30,
    },
    thumb: {
      width: '100%',
      height: '100%',
    },
    handle: {
      position: 'absolute',
      right: 32,
      bottom: 4,
    },
    controls: {
      position: 'absolute',
      right: 4,
      bottom: 4,
      zIndex: 30,
      ...(IS_WEB ? ({ cursor: 'pointer' } as object) : null),
    },
    control: {
      width: 25,
      height: 25,
      borderRadius: 13,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'rgba(0,0,0,0.66)',
    },
    add: {
      width: size,
      height: size,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.surface,
    },
    addActive: {
      borderWidth: 2,
      borderStyle: 'dashed',
      borderColor: colors.primary,
      backgroundColor: 'rgba(21, 122, 254, 0.12)',
    },
    overlay: {
      position: 'absolute',
      left: 0,
      top: 0,
      width: size,
      height: size,
      borderRadius: 12,
      overflow: 'hidden',
      zIndex: 80,
      borderWidth: 2,
      borderColor: '#FFFFFF',
      backgroundColor: colors.surfaceMuted,
      ...Platform.select({
        web: {
          boxShadow: '0 22px 48px rgba(0,0,0,0.55), 0 0 0 2px rgba(21,122,254,0.85)',
          cursor: 'grabbing',
          pointerEvents: 'none',
        } as object,
        default: {
          elevation: 24,
          shadowColor: '#000000',
          shadowOffset: { width: 0, height: 14 },
          shadowOpacity: 0.45,
          shadowRadius: 22,
        },
      }),
    },
    overlayImage: {
      width: '100%',
      height: '100%',
    },
  });
}

type ThumbProps = {
  item: GalleryItem;
  disabled: boolean;
  coarse: boolean;
  isPlaceholder: boolean;
  isReplaceTarget: boolean;
  styles: ReturnType<typeof createStyles>;
  hostRef?: (node: View | null) => void;
  onLayout: (key: string, event: LayoutChangeEvent) => void;
  onDragBegin: (key: string, absoluteX: number, absoluteY: number) => void;
  onDragUpdate: (absoluteX: number, absoluteY: number) => void;
  onDragEnd: () => void;
  onRemove: () => void;
};

const GalleryThumb = memo(function GalleryThumb({
  item,
  disabled,
  coarse,
  isPlaceholder,
  isReplaceTarget,
  styles,
  hostRef,
  onLayout,
  onDragBegin,
  onDragUpdate,
  onDragEnd,
  onRemove,
}: ThumbProps) {
  const beginRef = useRef(onDragBegin);
  const updateRef = useRef(onDragUpdate);
  const endRef = useRef(onDragEnd);
  const removeRef = useRef(onRemove);
  beginRef.current = onDragBegin;
  updateRef.current = onDragUpdate;
  endRef.current = onDragEnd;
  removeRef.current = onRemove;

  const pan = useMemo(() => {
    const gesture = Gesture.Pan()
      .mouseButton(MouseButton.LEFT)
      .enabled(!disabled)
      .maxPointers(1)
      .minDistance(coarse ? 0 : 3)
      .cancelsTouchesInView(true);

    if (coarse) {
      gesture.activateAfterLongPress(160);
    }

    const begin = (key: string, absoluteX: number, absoluteY: number) =>
      beginRef.current(key, absoluteX, absoluteY);
    const update = (absoluteX: number, absoluteY: number) =>
      updateRef.current(absoluteX, absoluteY);
    const end = () => endRef.current();

    return gesture
      .onStart((event) => {
        runOnJS(begin)(item.key, event.absoluteX, event.absoluteY);
      })
      .onUpdate((event) => {
        runOnJS(update)(event.absoluteX, event.absoluteY);
      })
      .onFinalize(() => {
        runOnJS(end)();
      });
  }, [coarse, disabled, item.key]);

  const removeTap = useMemo(
    () =>
      Gesture.Tap()
        .enabled(!disabled)
        .maxDistance(12)
        .onEnd(() => {
          runOnJS(removeRef.current)();
        }),
    [disabled],
  );

  return (
    <Animated.View
      ref={hostRef}
      layout={SLOT_LAYOUT}
      style={styles.slot}
      onLayout={(event) => onLayout(item.key, event)}>
      <GestureDetector gesture={pan}>
        <Animated.View
          collapsable={false}
          style={[
            styles.item,
            isPlaceholder && styles.placeholder,
            isReplaceTarget && styles.replaceTarget,
          ]}
          accessibilityLabel="Фото в галерее. Перетащите, чтобы изменить порядок.">
          {isPlaceholder ? null : (
            <>
              <Image
                source={{ uri: item.uri }}
                style={styles.thumb}
                contentFit="cover"
                pointerEvents="none"
              />
              <View style={[styles.control, styles.handle]} pointerEvents="none">
                <Ionicons name="reorder-three-outline" size={17} color="#FFFFFF" />
              </View>
              {isReplaceTarget ? (
                <View style={styles.replaceOverlay} pointerEvents="none">
                  <Ionicons name="image-outline" size={18} color="#FFFFFF" />
                </View>
              ) : null}
            </>
          )}
        </Animated.View>
      </GestureDetector>
      {isPlaceholder ? null : (
        <GestureDetector gesture={removeTap}>
          <View
            accessibilityRole="button"
            accessibilityLabel="Удалить фото из галереи"
            style={styles.controls}>
            <View style={[styles.control, disabled && { opacity: 0.35 }]}>
              <Ionicons name="trash-outline" size={14} color="#FFFFFF" />
            </View>
          </View>
        </GestureDetector>
      )}
    </Animated.View>
  );
});

export function ClubGalleryGrid({
  uris,
  disabled = false,
  canAdd = true,
  onReorder,
  onRemove,
  onAdd,
  onDraggingChange,
  onDropFiles,
}: ClubGalleryGridProps) {
  const colors = useTheme();
  const isDesktopWeb = useIsDesktopWeb();
  const size = isDesktopWeb ? 96 : 88;
  const styles = useThemedStyles((theme) => createStyles(theme, size));
  const coarse = useMemo(() => isCoarsePointer(), []);

  const [items, setItems] = useState<GalleryItem[]>(() => syncItems(uris, []));
  const [draggingKey, setDraggingKey] = useState<string | null>(null);
  const [overlayUri, setOverlayUri] = useState<string | null>(null);
  const [fileDropTarget, setFileDropTarget] = useState<FileDropTarget | null>(null);
  const [hoverDestIndex, setHoverDestIndex] = useState<number | null>(null);

  const wrapRef = useRef<View>(null);
  const rowRef = useRef<View>(null);
  const slotRefs = useRef<Record<string, View | null>>({});
  const itemsRef = useRef(items);
  const draggingKeyRef = useRef<string | null>(null);
  const layoutsRef = useRef<Record<string, ItemLayout>>({});
  const originRef = useRef<ItemLayout | null>(null);
  const wrapOffsetRef = useRef({ left: 0, top: 0 });
  const grabOffsetRef = useRef({ x: 0, y: 0 });
  const finishingRef = useRef(false);
  const lastDestRef = useRef<number | null>(null);
  const pendingOrderRef = useRef<string[] | null>(null);
  const canAddRef = useRef(canAdd);
  canAddRef.current = canAdd;

  const overlayX = useSharedValue(0);
  const overlayY = useSharedValue(0);
  const overlayScale = useSharedValue(1);
  const overlayRotate = useSharedValue(0);
  const overlayLift = useSharedValue(0);
  const overlayOpacity = useSharedValue(0);

  itemsRef.current = items;
  draggingKeyRef.current = draggingKey;

  const fileDropTargetRef = useRef<FileDropTarget | null>(null);
  const onDropFilesRef = useRef(onDropFiles);
  fileDropTargetRef.current = fileDropTarget;
  onDropFilesRef.current = onDropFiles;

  useEffect(() => {
    if (draggingKey) return;
    setItems((current) => {
      if (pendingOrderRef.current?.every((uri, index) => current[index]?.uri === uri)) {
        if (uris.length === pendingOrderRef.current.length && uris.every((uri, index) => uri === pendingOrderRef.current?.[index])) {
          pendingOrderRef.current = null;
        }
        return current;
      }
      return syncItems(uris, current);
    });
  }, [uris, draggingKey]);

  useEffect(() => {
    if (!IS_WEB || typeof document === 'undefined' || !onDropFiles) {
      return;
    }

    const rowNode = () => getWebHostNode(rowRef.current);

    const onDragOver = (event: DragEvent) => {
      if (!isFileDragEvent(event) || draggingKeyRef.current) {
        return;
      }
      if (!isInsideWebNode(wrapRef.current, event.target)) {
        setFileDropTarget(null);
        return;
      }
      event.preventDefault();
      if (event.dataTransfer) {
        event.dataTransfer.dropEffect = 'copy';
      }
      const next = resolveFileDropTargetFromClient(
        event.clientX,
        event.clientY,
        itemsRef.current,
        rowNode(),
        canAdd,
      );
      setFileDropTarget((current) => {
        if (!next) return null;
        if (current && current.mode === next.mode && current.index === next.index) {
          return current;
        }
        return next;
      });
    };

    const onDragLeave = (event: DragEvent) => {
      if (event.relatedTarget == null || !isInsideWebNode(wrapRef.current, event.relatedTarget)) {
        setFileDropTarget(null);
      }
    };

    const onDrop = (event: DragEvent) => {
      if (!isFileDragEvent(event) || draggingKeyRef.current) {
        return;
      }
      if (!isInsideWebNode(wrapRef.current, event.target)) {
        setFileDropTarget(null);
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      const files = filesFromDataTransfer(event.dataTransfer);
      const target =
        resolveFileDropTargetFromClient(
          event.clientX,
          event.clientY,
          itemsRef.current,
          getWebHostNode(rowRef.current),
          canAdd,
        ) ?? fileDropTargetRef.current;
      setFileDropTarget(null);
      if (!files.length || !target || target.index < 0) {
        return;
      }
      onDropFilesRef.current?.(target, files);
    };

    document.addEventListener('dragenter', onDragOver);
    document.addEventListener('dragover', onDragOver);
    document.addEventListener('dragleave', onDragLeave);
    document.addEventListener('drop', onDrop, true);

    return () => {
      document.removeEventListener('dragenter', onDragOver);
      document.removeEventListener('dragover', onDragOver);
      document.removeEventListener('dragleave', onDragLeave);
      document.removeEventListener('drop', onDrop, true);
    };
  }, [canAdd, onDropFiles]);

  const overlayStyle = useAnimatedStyle(() => ({
    opacity: overlayOpacity.value,
    transform: [
      { translateX: overlayX.value },
      { translateY: overlayY.value },
      { scale: overlayScale.value },
    ],
  }));

  const onItemLayout = useCallback((key: string, event: LayoutChangeEvent) => {
    const next = event.nativeEvent.layout;
    const previous = layoutsRef.current[key];
    if (
      previous &&
      previous.x === next.x &&
      previous.y === next.y &&
      previous.width === next.width &&
      previous.height === next.height
    ) {
      return;
    }
    layoutsRef.current = { ...layoutsRef.current, [key]: next };
  }, []);

  const onDragBegin = useCallback(
    (key: string, absoluteX: number, absoluteY: number) => {
      if (disabled || finishingRef.current) return;
      const item = itemsRef.current.find((entry) => entry.key === key);
      if (!item) return;

      const applyOrigin = (
        origin: ItemLayout,
        wrapLeft: number,
        wrapTop: number,
        itemLeft: number,
        itemTop: number,
      ) => {
        originRef.current = origin;
        wrapOffsetRef.current = { left: wrapLeft, top: wrapTop };
        grabOffsetRef.current = { x: absoluteX - itemLeft, y: absoluteY - itemTop };
        overlayX.value = absoluteX - wrapLeft - grabOffsetRef.current.x;
        overlayY.value = absoluteY - wrapTop - grabOffsetRef.current.y;
        overlayOpacity.value = 1;
        overlayScale.value = withSpring(1.2, PICKUP_SPRING);
        overlayRotate.value = 0;
        overlayLift.value = 0;
      };

      const index = itemsRef.current.findIndex((entry) => entry.key === key);
      const rowNode = getWebHostNode(rowRef.current);
      const wrapNode = getWebHostNode(wrapRef.current);
      const itemEl =
        rowNode && index >= 0
          ? (Array.from(rowNode.children)[index] as HTMLElement | undefined)
          : undefined;

      if (itemEl && wrapNode) {
        const itemRect = itemEl.getBoundingClientRect();
        const wrapRect = wrapNode.getBoundingClientRect();
        applyOrigin(
          {
            x: itemRect.left - wrapRect.left,
            y: itemRect.top - wrapRect.top,
            width: itemRect.width,
            height: itemRect.height,
          },
          wrapRect.left,
          wrapRect.top,
          itemRect.left,
          itemRect.top,
        );
      } else {
        const slot = slotRefs.current[key];
        const wrap = wrapRef.current;
        if (slot && wrap && typeof slot.measureInWindow === 'function') {
          slot.measureInWindow((itemLeft, itemTop, width, height) => {
            wrap.measureInWindow((wrapLeft, wrapTop) => {
              applyOrigin(
                {
                  x: itemLeft - wrapLeft,
                  y: itemTop - wrapTop,
                  width,
                  height,
                },
                wrapLeft,
                wrapTop,
                itemLeft,
                itemTop,
              );
            });
          });
        } else {
          const layout = layoutsRef.current[key];
          if (!layout) return;
          applyOrigin(layout, 0, 0, layout.x, layout.y);
        }
      }

      lastDestRef.current = itemsRef.current.findIndex((entry) => entry.key === key);
      draggingKeyRef.current = key;
      setDraggingKey(key);
      setHoverDestIndex(lastDestRef.current);
      setOverlayUri(item.uri);
      onDraggingChange?.(true);
    },
    [disabled, onDraggingChange, overlayLift, overlayOpacity, overlayRotate, overlayScale, overlayX, overlayY],
  );

  const onDragUpdate = useCallback((absoluteX: number, absoluteY: number) => {
    const key = draggingKeyRef.current;
    if (!key || finishingRef.current) return;

    const wrapNode = getWebHostNode(wrapRef.current);
    if (wrapNode) {
      const wrapRect = wrapNode.getBoundingClientRect();
      overlayX.value = absoluteX - wrapRect.left - grabOffsetRef.current.x;
      overlayY.value = absoluteY - wrapRect.top - grabOffsetRef.current.y;
    } else {
      overlayX.value = absoluteX - wrapOffsetRef.current.left - grabOffsetRef.current.x;
      overlayY.value = absoluteY - wrapOffsetRef.current.top - grabOffsetRef.current.y;
    }

    const dest = destinationIndexFromClient(
      absoluteX,
      absoluteY,
      itemsRef.current,
      getWebHostNode(rowRef.current),
      canAddRef.current,
      key,
    );

    if (dest === lastDestRef.current) return;
    lastDestRef.current = dest;
    setHoverDestIndex(dest);
  }, [overlayX, overlayY]);

  const commitDrag = useCallback(() => {
    const nextUris = itemsRef.current.map((item) => item.uri);
    finishingRef.current = false;
    draggingKeyRef.current = null;
    originRef.current = null;
    lastDestRef.current = null;
    pendingOrderRef.current = nextUris;
    overlayOpacity.value = 0;
    overlayScale.value = 1;
    overlayRotate.value = 0;
    overlayLift.value = 0;
    setDraggingKey(null);
    setOverlayUri(null);
    setHoverDestIndex(null);
    onDraggingChange?.(false);

    const unchanged =
      nextUris.length === uris.length && nextUris.every((uri, index) => uri === uris[index]);
    if (!unchanged) {
      onReorder(nextUris);
    }
  }, [onDraggingChange, onReorder, overlayLift, overlayOpacity, overlayRotate, overlayScale, uris]);

  const onDragEnd = useCallback(() => {
    const key = draggingKeyRef.current;
    if (!key || finishingRef.current) return;
    finishingRef.current = true;

    const from = itemsRef.current.findIndex((item) => item.key === key);
    const dest = lastDestRef.current ?? from;
    if (from >= 0 && dest != null && from !== dest) {
      const next = moveItem(itemsRef.current, from, dest);
      itemsRef.current = next;
      setItems(next);
    }
    setHoverDestIndex(null);
    commitDrag();
  }, [commitDrag]);

  const insertIndex =
    fileDropTarget?.mode === 'insert' ? fileDropTarget.index : null;
  const replaceIndex =
    fileDropTarget?.mode === 'replace' ? fileDropTarget.index : null;
  const fileDropActive = fileDropTarget != null;
  const fromIndex = draggingKey
    ? items.findIndex((item) => item.key === draggingKey)
    : -1;
  const markerIndex =
    insertIndex ??
    (hoverDestIndex != null && hoverDestIndex !== fromIndex ? hoverDestIndex : null);

  const insertBar =
    markerIndex == null
      ? null
      : (() => {
          const wrapRect = getWebHostNode(wrapRef.current)?.getBoundingClientRect();
          const rowNode = getWebHostNode(rowRef.current);
          const children = rowNode ? (Array.from(rowNode.children) as HTMLElement[]) : [];
          const el =
            markerIndex >= items.length
              ? children[children.length - 1]
              : children[markerIndex];
          const rect = el?.getBoundingClientRect();
          if (!wrapRect || !rect) return null;
          return {
            left: rect.left - wrapRect.left - 2,
            top: rect.top - wrapRect.top,
            height: rect.height,
          };
        })();

  return (
    <View
      ref={wrapRef}
      style={[
        styles.wrap,
        draggingKey && IS_WEB ? ({ cursor: 'grabbing', zIndex: 20 } as object) : null,
      ]}
      collapsable={false}>
      <View ref={rowRef} style={styles.row} collapsable={false}>
        {items.map((item, index) => (
          <GalleryThumb
            key={item.key}
            item={item}
            hostRef={(node) => {
              slotRefs.current[item.key] = node;
            }}
            disabled={disabled || fileDropActive || Boolean(draggingKey && draggingKey !== item.key)}
            coarse={coarse}
            isPlaceholder={draggingKey === item.key}
            isReplaceTarget={replaceIndex === index}
            styles={styles}
            onLayout={onItemLayout}
            onDragBegin={onDragBegin}
            onDragUpdate={onDragUpdate}
            onDragEnd={onDragEnd}
            onRemove={() => onRemove(index)}
          />
        ))}
        {canAdd ? (
          <Pressable
            style={[styles.add, insertIndex === items.length && styles.addActive]}
            onPress={onAdd}
            onLayout={(event) => onItemLayout(ADD_LAYOUT_KEY, event)}
            disabled={disabled || Boolean(draggingKey) || fileDropActive}>
            <Ionicons name="add" size={28} color={colors.primary} />
          </Pressable>
        ) : null}
      </View>
      {insertBar ? (
        <View pointerEvents="none" style={[styles.insertBar, insertBar]} />
      ) : null}
      {overlayUri ? (
        <Animated.View pointerEvents="none" style={[styles.overlay, overlayStyle]}>
          <Image source={{ uri: overlayUri }} style={styles.overlayImage} contentFit="cover" />
        </Animated.View>
      ) : null}
    </View>
  );
}
