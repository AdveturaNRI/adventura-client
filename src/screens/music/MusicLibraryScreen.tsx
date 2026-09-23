import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import { useCallback, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { MobileScreenHeader } from '@/components/navigation/MobileScreenHeader';
import {
  useIsDesktopSidebarVisible,
  useIsDesktopWeb,
} from '@/components/navigation/DesktopThemeToggle';
import { ScreenTransition } from '@/components/navigation/ScreenTransition';
import { Button, Input, toast } from '@/components/ui';
import { FontSize, Spacing, type ThemeColors } from '@/constants/theme';
import { useMusicPlayer } from '@/context/MusicPlayerContext';
import { useTheme } from '@/hooks/use-theme';
import { useThemedStyles } from '@/hooks/use-themed-styles';
import { useMainScreenStyles } from '@/screens/main/main-screen.styles';
import {
  addTrackToPlaylist,
  createMusicPlaylist,
  createMusicTrackFromUrl,
  deleteMusicPlaylist,
  deleteMusicTrack,
  fetchMusicQuota,
  getMusicPlaylist,
  listMusicPlaylists,
  listMusicTracks,
  quotaFromTracks,
  removeTrackFromPlaylist,
  uploadMusicTrack,
  type MusicPlaylistDetail,
  type MusicPlaylistSummary,
  type MusicQuota,
  type MusicTrack,
} from '@/services/music/musicApi';
import { localizeErrorMessage } from '@/utils/localizeError';

const MAX_MUSIC_BYTES = 20 * 1024 * 1024;
const LIBRARY_LIMIT_BYTES = 300 * 1024 * 1024;
const DESKTOP_CONTENT_MAX = 1080;
const FOLDER_CARD_WIDTH_DESKTOP = 168;
const FOLDER_CARD_WIDTH_MOBILE = '47%' as const;
const DRAG_MIME = 'application/x-adventura-music-track';
const IS_WEB = Platform.OS === 'web';

type LinkSourceKind = 'yandex' | 'direct';

const LINK_SOURCES: {
  key: LinkSourceKind;
  label: string;
  hint: string;
  placeholder: string;
}[] = [
  {
    key: 'yandex',
    label: 'Яндекс Диск',
    hint: 'Публичная ссылка на файл — играет напрямую с Диска',
    placeholder: 'https://disk.yandex.ru/d/…',
  },
  {
    key: 'direct',
    label: 'Прямая ссылка',
    hint: 'Чистый URL на mp3, ogg или wav',
    placeholder: 'https://example.com/track.mp3',
  },
];

function looksLikeLinkSource(url: string, kind: LinkSourceKind): boolean {
  try {
    const host = new URL(url.trim()).hostname.toLowerCase().replace(/^www\./, '');
    const isYandex =
      host === 'disk.yandex.ru' ||
      host === 'disk.yandex.com' ||
      host === 'yadi.sk' ||
      host.endsWith('.disk.yandex.net');
    if (kind === 'yandex') return isYandex;
    return !isYandex;
  } catch {
    return false;
  }
}

function asDomElement(node: unknown): HTMLElement | null {
  if (!node || typeof node !== 'object') return null;
  const candidate = node as {
    addEventListener?: unknown;
    nodeType?: number;
    getNode?: () => unknown;
    _nativeNode?: unknown;
  };
  if (typeof candidate.addEventListener === 'function') {
    return candidate as HTMLElement;
  }
  if (typeof candidate.getNode === 'function') {
    return asDomElement(candidate.getNode());
  }
  if (candidate._nativeNode) {
    return asDomElement(candidate._nativeNode);
  }
  return null;
}

function useWebDragSource(
  enabled: boolean,
  trackId: string,
  onStart: (trackId: string) => void,
  onEnd: () => void,
) {
  const ref = useRef<View>(null);
  const onStartRef = useRef(onStart);
  const onEndRef = useRef(onEnd);
  onStartRef.current = onStart;
  onEndRef.current = onEnd;

  useLayoutEffect(() => {
    if (!IS_WEB || !enabled) return;
    const el = asDomElement(ref.current);
    if (!el) return;

    el.draggable = true;
    el.style.cursor = 'grab';

    let ghost: HTMLElement | null = null;

    const onDragStart = (event: DragEvent) => {
      event.dataTransfer?.setData('text/plain', trackId);
      event.dataTransfer?.setData(DRAG_MIME, trackId);
      if (event.dataTransfer) {
        event.dataTransfer.effectAllowed = 'copy';
      }

      // RN-web + overflow/scroll clips the default drag preview; paint a full-size ghost.
      const rect = el.getBoundingClientRect();
      ghost = el.cloneNode(true) as HTMLElement;
      ghost.style.position = 'fixed';
      ghost.style.top = '0';
      ghost.style.left = '-10000px';
      ghost.style.width = `${Math.max(rect.width, 1)}px`;
      ghost.style.height = `${Math.max(rect.height, 1)}px`;
      ghost.style.margin = '0';
      ghost.style.opacity = '0.92';
      ghost.style.overflow = 'visible';
      ghost.style.pointerEvents = 'none';
      ghost.style.boxSizing = 'border-box';
      ghost.style.zIndex = '100000';
      document.body.appendChild(ghost);
      const offsetX = Math.min(Math.max(event.clientX - rect.left, 24), rect.width - 24);
      const offsetY = Math.min(Math.max(event.clientY - rect.top, 16), rect.height - 16);
      try {
        event.dataTransfer?.setDragImage(ghost, offsetX, offsetY);
      } catch {
        // Older engines may reject custom drag images — fall back to default.
      }

      el.style.cursor = 'grabbing';
      onStartRef.current(trackId);
    };
    const onDragEnd = () => {
      if (ghost?.parentNode) ghost.parentNode.removeChild(ghost);
      ghost = null;
      el.style.cursor = 'grab';
      onEndRef.current();
    };

    el.addEventListener('dragstart', onDragStart);
    el.addEventListener('dragend', onDragEnd);
    return () => {
      if (ghost?.parentNode) ghost.parentNode.removeChild(ghost);
      ghost = null;
      el.draggable = false;
      el.style.cursor = '';
      el.removeEventListener('dragstart', onDragStart);
      el.removeEventListener('dragend', onDragEnd);
    };
  }, [enabled, trackId]);

  return ref;
}

function useWebDropTarget(
  enabled: boolean,
  playlistId: string,
  onHover: (playlistId: string | null) => void,
  onDropTrack: (playlistId: string, trackId: string) => void,
) {
  const ref = useRef<View>(null);
  const onHoverRef = useRef(onHover);
  const onDropRef = useRef(onDropTrack);
  onHoverRef.current = onHover;
  onDropRef.current = onDropTrack;

  useLayoutEffect(() => {
    if (!IS_WEB || !enabled) return;
    const el = asDomElement(ref.current);
    if (!el) return;

    const onDragOver = (event: DragEvent) => {
      event.preventDefault();
      if (event.dataTransfer) event.dataTransfer.dropEffect = 'copy';
      onHoverRef.current(playlistId);
    };
    const onDragLeave = (event: DragEvent) => {
      const related = event.relatedTarget as Node | null;
      if (related && el.contains(related)) return;
      onHoverRef.current(null);
    };
    const onDrop = (event: DragEvent) => {
      event.preventDefault();
      event.stopPropagation();
      const trackId =
        event.dataTransfer?.getData(DRAG_MIME) ||
        event.dataTransfer?.getData('text/plain');
      onHoverRef.current(null);
      if (trackId) onDropRef.current(playlistId, trackId);
    };

    el.addEventListener('dragenter', onDragOver);
    el.addEventListener('dragover', onDragOver);
    el.addEventListener('dragleave', onDragLeave);
    el.addEventListener('drop', onDrop);
    return () => {
      el.removeEventListener('dragenter', onDragOver);
      el.removeEventListener('dragover', onDragOver);
      el.removeEventListener('dragleave', onDragLeave);
      el.removeEventListener('drop', onDrop);
    };
  }, [enabled, playlistId]);

  return ref;
}


function formatBytes(size: number) {
  if (size < 1024) return `${size} Б`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(0)} КБ`;
  return `${(size / (1024 * 1024)).toFixed(1)} МБ`;
}

function formatDuration(sec: number | null) {
  if (!sec || sec <= 0) return null;
  const minutes = Math.floor(sec / 60);
  const seconds = sec % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

function trackWord(count: number) {
  const mod10 = count % 10;
  const mod100 = count % 100;
  if (mod10 === 1 && mod100 !== 11) return 'трек';
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return 'трека';
  return 'треков';
}

function confirmDelete(title: string, message: string): Promise<boolean> {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    return Promise.resolve(window.confirm(`${title}\n\n${message}`));
  }
  return new Promise((resolve) => {
    Alert.alert(title, message, [
      { text: 'Отмена', style: 'cancel', onPress: () => resolve(false) },
      { text: 'Удалить', style: 'destructive', onPress: () => resolve(true) },
    ]);
  });
}

function createStyles(colors: ThemeColors, isDesktopWeb: boolean) {
  return StyleSheet.create({
    shell: {
      flex: 1,
      width: '100%',
      maxWidth: isDesktopWeb ? DESKTOP_CONTENT_MAX : undefined,
      alignSelf: isDesktopWeb ? 'center' : undefined,
    },
    headerBlock: {
      gap: Spacing.sm,
      marginBottom: isDesktopWeb ? Spacing.md : Spacing.sm,
    },
    headerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: Spacing.md,
    },
    headerCopy: {
      flex: 1,
      minWidth: 0,
      gap: 6,
    },
    pageTitle: {
      fontSize: isDesktopWeb ? 32 : FontSize.h1,
      fontWeight: '700',
      color: colors.text,
      letterSpacing: -0.4,
    },
    subtitle: {
      fontSize: FontSize.label,
      color: colors.textMuted,
      lineHeight: FontSize.label * 1.45,
      maxWidth: isDesktopWeb ? 560 : undefined,
    },
    quotaRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.sm,
      flexWrap: 'wrap',
      marginTop: 4,
    },
    quotaChip: {
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: 999,
      backgroundColor: 'rgba(21, 122, 254, 0.12)',
    },
    quotaChipText: {
      fontSize: FontSize.caption,
      fontWeight: '700',
      color: colors.primary,
    },
    quotaHint: {
      fontSize: FontSize.caption,
      color: colors.textMuted,
    },
    quotaBarTrack: {
      width: isDesktopWeb ? 220 : '100%',
      height: 6,
      borderRadius: 999,
      backgroundColor: 'rgba(21, 122, 254, 0.12)',
      overflow: 'hidden',
      marginTop: 8,
    },
    quotaBarFill: {
      height: '100%',
      borderRadius: 999,
      backgroundColor: colors.primary,
    },
    uploadBanner: {
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.borderLight,
      backgroundColor: 'rgba(21, 122, 254, 0.06)',
      padding: Spacing.md,
      gap: 8,
      marginBottom: Spacing.sm,
    },
    uploadBannerTop: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: Spacing.sm,
    },
    uploadBannerTitle: {
      flex: 1,
      fontSize: FontSize.label,
      fontWeight: '700',
      color: colors.text,
    },
    uploadBannerPercent: {
      fontSize: FontSize.label,
      fontWeight: '700',
      color: colors.primary,
      fontVariant: ['tabular-nums'],
    },
    uploadTrack: {
      height: 8,
      borderRadius: 999,
      backgroundColor: 'rgba(21, 122, 254, 0.14)',
      overflow: 'hidden',
    },
    uploadFill: {
      height: '100%',
      borderRadius: 999,
      backgroundColor: colors.primary,
    },
    uploadHint: {
      fontSize: FontSize.caption,
      color: colors.textMuted,
    },
    toolbar: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      alignItems: 'center',
      justifyContent: isDesktopWeb ? 'flex-end' : 'flex-start',
      gap: Spacing.sm,
      marginBottom: Spacing.md,
    },
    mainPane: {
      flex: 1,
      minWidth: 0,
    },
    libraryContent: {
      gap: Spacing.lg,
      paddingBottom: Spacing.xl,
    },
    section: {
      gap: Spacing.sm,
    },
    sectionHeader: {
      flexDirection: 'row',
      alignItems: 'baseline',
      justifyContent: 'space-between',
      gap: Spacing.sm,
      marginBottom: 4,
    },
    sectionTitle: {
      fontSize: FontSize.label,
      fontWeight: '700',
      color: colors.text,
    },
    sectionHint: {
      fontSize: FontSize.caption,
      color: colors.textMuted,
      flexShrink: 1,
      textAlign: 'right',
    },
    folderGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: Spacing.md,
    },
    folderCard: {
      width: isDesktopWeb ? FOLDER_CARD_WIDTH_DESKTOP : FOLDER_CARD_WIDTH_MOBILE,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.borderLight,
      backgroundColor: colors.surface,
      overflow: 'hidden',
    },
    folderCardDropTarget: {
      borderColor: colors.primary,
      backgroundColor: 'rgba(21, 122, 254, 0.08)',
      transform: [{ scale: 1.02 }],
    },
    folderCardPressed: {
      opacity: 0.92,
      transform: [{ scale: 0.98 }],
    },
    folderPreview: {
      height: isDesktopWeb ? 110 : 96,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'rgba(21, 122, 254, 0.08)',
      position: 'relative',
    },
    folderBadge: {
      position: 'absolute',
      top: 10,
      right: 10,
      minWidth: 26,
      height: 26,
      paddingHorizontal: 7,
      borderRadius: 999,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'rgba(21, 122, 254, 0.14)',
    },
    folderBadgeText: {
      fontSize: FontSize.caption,
      fontWeight: '700',
      color: colors.primary,
    },
    folderBody: {
      paddingHorizontal: 12,
      paddingVertical: 12,
      gap: 4,
    },
    folderTitle: {
      fontSize: FontSize.label,
      fontWeight: '700',
      color: colors.text,
    },
    folderMeta: {
      fontSize: FontSize.caption,
      color: colors.textMuted,
    },
    folderDelete: {
      position: 'absolute',
      top: 6,
      left: 6,
      width: 30,
      height: 30,
      borderRadius: 15,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.borderLight,
    },
    createFolderCard: {
      width: isDesktopWeb ? FOLDER_CARD_WIDTH_DESKTOP : FOLDER_CARD_WIDTH_MOBILE,
      borderRadius: 16,
      borderWidth: 1,
      borderStyle: 'dashed',
      borderColor: colors.primaryLight,
      backgroundColor: 'rgba(21, 122, 254, 0.04)',
      minHeight: isDesktopWeb ? 168 : 152,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      padding: Spacing.md,
    },
    createFolderText: {
      fontSize: FontSize.label,
      fontWeight: '700',
      color: colors.primary,
      textAlign: 'center',
    },
    tracksList: {
      gap: Spacing.sm,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.sm,
      paddingVertical: isDesktopWeb ? 14 : Spacing.md,
      paddingHorizontal: Spacing.md,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.borderLight,
      backgroundColor: colors.surface,
      ...(IS_WEB
        ? ({
            userSelect: 'none',
            WebkitUserSelect: 'none',
            overflow: 'visible',
          } as object)
        : null),
    },
    rowDragging: {
      opacity: 0.45,
      borderColor: colors.primaryLight,
      borderStyle: 'dashed',
      overflow: 'visible',
    },
    rowBody: {
      flex: 1,
      minWidth: 0,
      gap: 3,
      ...(IS_WEB ? ({ cursor: 'grab' } as object) : null),
    },
    rowTitle: {
      fontSize: FontSize.button,
      fontWeight: '700',
      color: colors.text,
    },
    rowMeta: {
      fontSize: FontSize.caption,
      color: colors.textMuted,
    },
    rowActions: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 2,
    },
    iconBtn: {
      width: 36,
      height: 36,
      alignItems: 'center',
      justifyContent: 'center',
    },
    playChip: {
      width: 40,
      height: 40,
      borderRadius: 20,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'rgba(21, 122, 254, 0.12)',
    },
    playChipActive: {
      backgroundColor: colors.primary,
    },
    rowActive: {
      borderColor: 'rgba(21, 122, 254, 0.35)',
      backgroundColor: 'rgba(21, 122, 254, 0.06)',
    },
    rowTitleActive: {
      color: colors.primary,
    },
    empty: {
      paddingVertical: Spacing.xl,
      alignItems: 'center',
      gap: Spacing.md,
    },
    emptyText: {
      fontSize: FontSize.label,
      color: colors.textMuted,
      textAlign: 'center',
      maxWidth: 400,
      lineHeight: FontSize.label * 1.45,
    },
    explorerBar: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      marginBottom: Spacing.sm,
      paddingVertical: 4,
      flexWrap: 'wrap',
    },
    explorerCrumb: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      flexShrink: 1,
      flexWrap: 'wrap',
      flex: 1,
      minWidth: 0,
    },
    explorerCrumbBtn: {
      paddingVertical: 4,
      paddingHorizontal: 2,
      maxWidth: 180,
    },
    explorerCrumbText: {
      fontSize: FontSize.label,
      fontWeight: '600',
      color: colors.primary,
    },
    explorerCrumbCurrent: {
      fontSize: FontSize.label,
      fontWeight: '700',
      color: colors.text,
    },
    explorerSep: {
      fontSize: FontSize.caption,
      color: colors.textMuted,
    },
    explorerList: {
      gap: 6,
    },
    explorerFolderRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.sm,
      paddingVertical: isDesktopWeb ? 10 : 12,
      paddingHorizontal: Spacing.md,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.borderLight,
      backgroundColor: colors.surface,
    },
    explorerFolderRowDrop: {
      borderColor: colors.primary,
      backgroundColor: 'rgba(21, 122, 254, 0.08)',
    },
    explorerFolderIcon: {
      width: 36,
      height: 36,
      borderRadius: 10,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'rgba(21, 122, 254, 0.12)',
    },
    explorerFolderBody: {
      flex: 1,
      minWidth: 0,
      gap: 2,
    },
    modalOverlay: {
      flex: 1,
      backgroundColor: colors.overlay,
      justifyContent: isDesktopWeb ? 'center' : 'flex-end',
      alignItems: isDesktopWeb ? 'center' : 'stretch',
      padding: isDesktopWeb ? Spacing.lg : 0,
    },
    modalCard: {
      width: '100%',
      maxWidth: isDesktopWeb ? 480 : undefined,
      backgroundColor: colors.surface,
      borderTopLeftRadius: isDesktopWeb ? 16 : 20,
      borderTopRightRadius: isDesktopWeb ? 16 : 20,
      borderBottomLeftRadius: isDesktopWeb ? 16 : 0,
      borderBottomRightRadius: isDesktopWeb ? 16 : 0,
      padding: Spacing.lg,
      gap: Spacing.md,
      borderWidth: isDesktopWeb ? 1 : 0,
      borderColor: colors.borderLight,
    },
    modalTitle: {
      fontSize: 20,
      fontWeight: '700',
      color: colors.text,
    },
    modalHint: {
      fontSize: FontSize.caption,
      color: colors.textMuted,
      lineHeight: FontSize.caption * 1.45,
      marginTop: -4,
    },
    chipRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
    },
    chip: {
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: 'rgba(21, 122, 254, 0.28)',
      backgroundColor: 'rgba(21, 122, 254, 0.08)',
    },
    chipActive: {
      borderColor: colors.primary,
      backgroundColor: 'rgba(21, 122, 254, 0.18)',
    },
    chipLabel: {
      fontSize: FontSize.caption,
      fontWeight: '700',
      color: colors.primary,
    },
    chipLabelActive: {
      color: colors.primary,
    },
    urlFields: {
      gap: Spacing.md,
    },
    choiceList: {
      gap: Spacing.sm,
    },
    choiceRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.md,
      paddingVertical: 14,
      paddingHorizontal: 14,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.borderLight,
      backgroundColor: 'rgba(21, 122, 254, 0.06)',
    },
    choiceIcon: {
      width: 40,
      height: 40,
      borderRadius: 20,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'rgba(21, 122, 254, 0.14)',
    },
    choiceCopy: {
      flex: 1,
      minWidth: 0,
      gap: 2,
    },
    choiceTitle: {
      fontSize: FontSize.label,
      fontWeight: '700',
      color: colors.text,
    },
    choiceMeta: {
      fontSize: FontSize.caption,
      color: colors.textMuted,
      lineHeight: FontSize.caption * 1.4,
    },
    modalActions: {
      flexDirection: 'row',
      gap: Spacing.sm,
      justifyContent: 'flex-end',
    },
    pickGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: Spacing.sm,
      maxHeight: 340,
    },
    pickFolder: {
      width: isDesktopWeb ? 132 : '47%',
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.borderLight,
      backgroundColor: colors.surface,
      padding: 12,
      gap: 8,
      alignItems: 'center',
    },
    pickFolderTitle: {
      fontSize: FontSize.caption,
      fontWeight: '700',
      color: colors.text,
      textAlign: 'center',
    },
    pickFolderMeta: {
      fontSize: 11,
      color: colors.textMuted,
      textAlign: 'center',
    },
  });
}


type TrackRowProps = {
  track: MusicTrack;
  colors: ThemeColors;
  styles: ReturnType<typeof createStyles>;
  isActive?: boolean;
  isPlaying?: boolean;
  onRemoveFromPlaylist?: () => void;
  draggable?: boolean;
  dragging: boolean;
  onDragStart: (trackId: string) => void;
  onDragEnd: () => void;
  onPlay: () => void;
  onPickFolder?: () => void;
  onDelete: () => void;
};

function TrackRow({
  track,
  colors,
  styles,
  isActive,
  isPlaying,
  onRemoveFromPlaylist,
  draggable,
  dragging,
  onDragStart,
  onDragEnd,
  onPlay,
  onPickFolder,
  onDelete,
}: TrackRowProps) {
  const canDrag = Boolean(draggable && IS_WEB);
  const dragRef = useWebDragSource(canDrag, track.id, onDragStart, onDragEnd);
  const duration = formatDuration(track.durationSec);

  return (
    <View
      ref={canDrag ? dragRef : undefined}
      style={[
        styles.row,
        dragging ? styles.rowDragging : null,
        isActive ? styles.rowActive : null,
      ]}>
      {canDrag ? (
        <View pointerEvents="none" style={styles.iconBtn}>
          <Ionicons name="reorder-three" size={22} color={colors.textMuted} />
        </View>
      ) : null}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={
          isPlaying ? `Пауза ${track.title}` : `Играть ${track.title}`
        }
        onPress={onPlay}
        style={[styles.playChip, isActive ? styles.playChipActive : null]}>
        <Ionicons
          name={isPlaying ? 'pause' : 'play'}
          size={16}
          color={isActive ? '#FFFFFF' : colors.primary}
        />
      </Pressable>
      <View style={styles.rowBody} pointerEvents={canDrag ? 'none' : 'auto'}>
        <Text
          numberOfLines={1}
          style={[styles.rowTitle, isActive ? styles.rowTitleActive : null]}>
          {track.title}
        </Text>
        <Text style={styles.rowMeta}>
          {isActive && isPlaying ? 'Сейчас играет · ' : ''}
          {track.source === 'external'
            ? 'По ссылке'
            : formatBytes(track.sizeBytes)}
          {duration ? ` · ${duration}` : ''}
          {canDrag ? ' · потяните на папку' : ''}
        </Text>
      </View>
      <View style={styles.rowActions}>
        {!onRemoveFromPlaylist ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="В папку"
            onPress={onPickFolder}
            style={styles.iconBtn}>
            <Ionicons name="folder-outline" size={18} color={colors.textSecondary} />
          </Pressable>
        ) : (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Убрать из папки"
            onPress={onRemoveFromPlaylist}
            style={styles.iconBtn}>
            <Ionicons name="remove-circle-outline" size={20} color={colors.textSecondary} />
          </Pressable>
        )}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Удалить трек"
          onPress={onDelete}
          style={styles.iconBtn}>
          <Ionicons name="trash-outline" size={18} color={colors.destructive} />
        </Pressable>
      </View>
    </View>
  );
}

type FolderCardProps = {
  playlist: MusicPlaylistSummary;
  colors: ThemeColors;
  styles: ReturnType<typeof createStyles>;
  isDropTarget: boolean;
  isDraggingTrack: boolean;
  onHover: (playlistId: string | null) => void;
  onDropTrack: (playlistId: string, trackId: string) => void;
  onOpen: () => void;
  onDelete: () => void;
};

function FolderCard({
  playlist,
  colors,
  styles,
  isDropTarget,
  isDraggingTrack,
  onHover,
  onDropTrack,
  onOpen,
  onDelete,
}: FolderCardProps) {
  const dropRef = useWebDropTarget(IS_WEB, playlist.id, onHover, onDropTrack);
  const blockNestedPress = isDraggingTrack;

  return (
    <View
      ref={IS_WEB ? dropRef : undefined}
      style={[
        styles.folderCard,
        isDropTarget ? styles.folderCardDropTarget : null,
      ]}>
      <View style={styles.folderPreview} pointerEvents="box-none">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Папка ${playlist.title}`}
          onPress={onOpen}
          disabled={blockNestedPress}
          pointerEvents={blockNestedPress ? 'none' : 'auto'}
          style={({ pressed }) => [
            StyleSheet.absoluteFillObject,
            pressed && !isDropTarget ? styles.folderCardPressed : null,
          ]}
        />
        <Ionicons
          name={isDropTarget ? 'folder-open' : 'folder'}
          size={48}
          color={colors.primary}
          pointerEvents="none"
        />
        <View style={styles.folderBadge} pointerEvents="none">
          <Text style={styles.folderBadgeText}>{playlist.trackCount}</Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Удалить папку"
          hitSlop={8}
          onPress={onDelete}
          disabled={blockNestedPress}
          pointerEvents={blockNestedPress ? 'none' : 'auto'}
          style={styles.folderDelete}>
          <Ionicons name="trash-outline" size={14} color={colors.destructive} />
        </Pressable>
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Папка ${playlist.title}`}
        onPress={onOpen}
        disabled={blockNestedPress}
        pointerEvents={blockNestedPress ? 'none' : 'auto'}
        style={({ pressed }) => [
          styles.folderBody,
          pressed && !isDropTarget ? { opacity: 0.85 } : null,
        ]}>
        <Text numberOfLines={2} style={styles.folderTitle}>
          {playlist.title}
        </Text>
        <Text style={styles.folderMeta}>
          {isDropTarget
            ? 'Отпустите сюда'
            : [
                `${playlist.trackCount} ${trackWord(playlist.trackCount)}`,
                playlist.folderCount
                  ? `${playlist.folderCount} ${playlist.folderCount === 1 ? 'папка' : 'папок'}`
                  : null,
              ]
                .filter(Boolean)
                .join(' · ')}
        </Text>
      </Pressable>
    </View>
  );
}

type FolderRowProps = {
  playlist: MusicPlaylistSummary;
  colors: ThemeColors;
  styles: ReturnType<typeof createStyles>;
  isDropTarget: boolean;
  isDraggingTrack: boolean;
  onHover: (playlistId: string | null) => void;
  onDropTrack: (playlistId: string, trackId: string) => void;
  onOpen: () => void;
  onDelete: () => void;
};

function FolderRow({
  playlist,
  colors,
  styles,
  isDropTarget,
  isDraggingTrack,
  onHover,
  onDropTrack,
  onOpen,
  onDelete,
}: FolderRowProps) {
  const dropRef = useWebDropTarget(IS_WEB, playlist.id, onHover, onDropTrack);
  const blockNestedPress = isDraggingTrack;

  return (
    <View
      ref={IS_WEB ? dropRef : undefined}
      style={[
        styles.explorerFolderRow,
        isDropTarget ? styles.explorerFolderRowDrop : null,
      ]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Папка ${playlist.title}`}
        onPress={onOpen}
        disabled={blockNestedPress}
        style={({ pressed }) => [
          { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, flex: 1, minWidth: 0 },
          pressed && !isDropTarget ? { opacity: 0.85 } : null,
        ]}>
        <View style={styles.explorerFolderIcon}>
          <Ionicons
            name={isDropTarget ? 'folder-open' : 'folder'}
            size={20}
            color={colors.primary}
          />
        </View>
        <View style={styles.explorerFolderBody}>
          <Text numberOfLines={1} style={styles.rowTitle}>
            {playlist.title}
          </Text>
          <Text style={styles.rowMeta}>
            {isDropTarget
              ? 'Отпустите сюда'
              : [
                  `${playlist.trackCount} ${trackWord(playlist.trackCount)}`,
                  playlist.folderCount
                    ? `${playlist.folderCount} ${playlist.folderCount === 1 ? 'папка' : 'папок'}`
                    : null,
                ]
                  .filter(Boolean)
                  .join(' · ')}
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
      </Pressable>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Удалить папку"
        onPress={onDelete}
        disabled={blockNestedPress}
        style={styles.iconBtn}>
        <Ionicons name="trash-outline" size={18} color={colors.destructive} />
      </Pressable>
    </View>
  );
}

export default function MusicLibraryScreen() {
  const colors = useTheme();
  const isDesktopWeb = useIsDesktopWeb();
  const hideMobileChrome = useIsDesktopSidebarVisible();
  const mainStyles = useMainScreenStyles();
  const styles = useThemedStyles((theme) => createStyles(theme, isDesktopWeb));

  const [tracks, setTracks] = useState<MusicTrack[]>([]);
  const [playlists, setPlaylists] = useState<MusicPlaylistSummary[]>([]);
  const [quota, setQuota] = useState<MusicQuota | null>(null);
  const [activePlaylist, setActivePlaylist] = useState<MusicPlaylistDetail | null>(
    null,
  );
  /** Breadcrumb of open folders (root → … → current). */
  const [folderPath, setFolderPath] = useState<
    Array<{ id: string; title: string }>
  >([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [uploadFileName, setUploadFileName] = useState<string | null>(null);
  const { activePlayback, session, startPlayback } = useMusicPlayer();

  const [createOpen, setCreateOpen] = useState(false);
  const [playlistTitle, setPlaylistTitle] = useState('');
  const [addOpen, setAddOpen] = useState(false);
  const [urlOpen, setUrlOpen] = useState(false);
  const [linkSource, setLinkSource] = useState<LinkSourceKind | null>(null);
  const [externalUrl, setExternalUrl] = useState('');
  const [externalTitle, setExternalTitle] = useState('');
  const [pickTrackId, setPickTrackId] = useState<string | null>(null);
  const [draggingTrackId, setDraggingTrackId] = useState<string | null>(null);
  const [dropTargetId, setDropTargetId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [library, nextPlaylists] = await Promise.all([
        listMusicTracks(),
        listMusicPlaylists(),
      ]);
      setTracks(library.tracks);
      setPlaylists(nextPlaylists);
      if (library.quota) {
        setQuota(library.quota);
      } else {
        try {
          setQuota(await fetchMusicQuota());
        } catch {
          setQuota(quotaFromTracks(library.tracks));
        }
      }
    } catch (error) {
      toast.error(localizeErrorMessage(error, 'Не удалось загрузить музыку'));
    } finally {
      setLoading(false);
    }
  }, []);

  const refreshQuota = useCallback(async () => {
    try {
      setQuota(await fetchMusicQuota());
    } catch {
      setTracks((current) => {
        setQuota(quotaFromTracks(current));
        return current;
      });
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  /** Root list: only tracks that are not in any folder. */
  const rootTracks = useMemo(
    () => tracks.filter((track) => !track.inFolder),
    [tracks],
  );

  const rootPlaylists = useMemo(
    () => playlists.filter((playlist) => !playlist.parentId),
    [playlists],
  );

  const folderChildren = activePlaylist?.children ?? [];
  const createParentId = activePlaylist?.id ?? null;

  const putTrackInPlaylist = useCallback(
    async (playlistId: string, trackId: string) => {
      const detail = await addTrackToPlaylist(playlistId, trackId);
      setPlaylists((prev) =>
        prev.map((item) =>
          item.id === detail.id
            ? { ...item, trackCount: detail.trackCount }
            : item,
        ),
      );
      setTracks((prev) =>
        prev.map((track) =>
          track.id === trackId ? { ...track, inFolder: true } : track,
        ),
      );
      if (activePlaylist?.id === detail.id) {
        setActivePlaylist(detail);
      }
      return detail;
    },
    [activePlaylist],
  );

  const handleUpload = useCallback(() => {
    if (busy) return;
    void (async () => {
      try {
        const picked = await DocumentPicker.getDocumentAsync({
          type: ['audio/*'],
          copyToCacheDirectory: true,
          multiple: false,
        });
        if (picked.canceled || !picked.assets?.[0]) return;

        const asset = picked.assets[0];
        if (asset.size && asset.size > MAX_MUSIC_BYTES) {
          toast.error('Максимум 20 МБ на трек');
          return;
        }
        const remaining = quota?.remainingBytes ?? LIBRARY_LIMIT_BYTES;
        if (asset.size && asset.size > remaining) {
          toast.error(
            `В библиотеке свободно ${formatBytes(remaining)} из 300 МБ`,
          );
          return;
        }

        setBusy(true);
        setUploadProgress(0);
        setUploadFileName(asset.name || 'track.mp3');
        const track = await uploadMusicTrack(asset.uri, {
          fileName: asset.name || 'track.mp3',
          mimeType: asset.mimeType || 'audio/mpeg',
          title: asset.name?.replace(/\.[^.]+$/, '') || undefined,
          onProgress: (percent) => setUploadProgress(percent),
        });
        setTracks((prev) => [track, ...prev]);
        if (activePlaylist) {
          await putTrackInPlaylist(activePlaylist.id, track.id);
          toast.success('Трек загружен в папку');
        } else {
          toast.success('Трек загружен');
        }
        await refreshQuota();
      } catch (error) {
        toast.error(localizeErrorMessage(error, 'Не удалось загрузить трек'));
      } finally {
        setBusy(false);
        setUploadProgress(null);
        setUploadFileName(null);
      }
    })();
  }, [activePlaylist, busy, putTrackInPlaylist, quota, refreshQuota]);

  const closeUrlModal = useCallback(() => {
    setUrlOpen(false);
    setLinkSource(null);
    setExternalUrl('');
    setExternalTitle('');
  }, []);

  const openUrlModal = useCallback(() => {
    setAddOpen(false);
    setLinkSource(null);
    setExternalUrl('');
    setExternalTitle('');
    setUrlOpen(true);
  }, []);

  const handleCreateFromUrl = useCallback(() => {
    if (!linkSource) {
      toast.error('Выберите тип ссылки');
      return;
    }
    const url = externalUrl.trim();
    if (!url) {
      toast.error('Вставьте ссылку');
      return;
    }
    if (!looksLikeLinkSource(url, linkSource)) {
      const labels: Record<LinkSourceKind, string> = {
        yandex: 'Яндекс Диска',
        direct: 'прямую ссылку на файл',
      };
      toast.error(`Это не похоже на ссылку ${labels[linkSource]}`);
      return;
    }
    void (async () => {
      try {
        setBusy(true);
        const track = await createMusicTrackFromUrl(
          url,
          externalTitle.trim() || undefined,
        );
        setTracks((prev) => [track, ...prev]);
        if (activePlaylist) {
          await putTrackInPlaylist(activePlaylist.id, track.id);
          toast.success('Трек добавлен в папку');
        } else {
          toast.success('Трек добавлен по ссылке');
        }
        await refreshQuota();
        closeUrlModal();
      } catch (error) {
        toast.error(localizeErrorMessage(error, 'Не удалось добавить трек'));
      } finally {
        setBusy(false);
      }
    })();
  }, [
    activePlaylist,
    closeUrlModal,
    externalTitle,
    externalUrl,
    linkSource,
    putTrackInPlaylist,
    refreshQuota,
  ]);

  const handleDeleteTrack = useCallback(
    (track: MusicTrack) => {
      void (async () => {
        const ok = await confirmDelete(
          'Удалить трек?',
          `«${track.title}» пропадёт из библиотеки и папок.`,
        );
        if (!ok) return;
        try {
          setBusy(true);
          await deleteMusicTrack(track.id);
          setTracks((prev) => prev.filter((item) => item.id !== track.id));
          if (activePlaylist) {
            setActivePlaylist({
              ...activePlaylist,
              tracks: activePlaylist.tracks.filter((item) => item.id !== track.id),
              trackCount: Math.max(0, activePlaylist.trackCount - 1),
            });
          }
          setPlaylists((prev) =>
            prev.map((item) => {
              if (!activePlaylist || item.id !== activePlaylist.id) return item;
              return {
                ...item,
                trackCount: Math.max(0, item.trackCount - 1),
              };
            }),
          );
          await refreshQuota();
          toast.success('Трек удалён');
        } catch (error) {
          toast.error(localizeErrorMessage(error, 'Не удалось удалить трек'));
        } finally {
          setBusy(false);
        }
      })();
    },
    [activePlaylist, refreshQuota],
  );

  const handleCreatePlaylist = useCallback(() => {
    const title = playlistTitle.trim();
    if (!title) {
      toast.error('Укажите название');
      return;
    }
    const parentId = createParentId;
    void (async () => {
      try {
        setBusy(true);
        const playlist = await createMusicPlaylist(title, parentId);
        setPlaylists((prev) => {
          const without = prev.filter((item) => item.id !== playlist.id);
          return [...without, playlist];
        });
        if (parentId) {
          setActivePlaylist((current) => {
            if (!current || current.id !== parentId) {
              return current;
            }
            const children = [
              ...(current.children ?? []).filter((item) => item.id !== playlist.id),
              playlist,
            ];
            return {
              ...current,
              children,
              folderCount: children.length,
            };
          });
          setPlaylists((prev) =>
            prev.map((item) =>
              item.id === parentId
                ? { ...item, folderCount: (item.folderCount ?? 0) + 1 }
                : item,
            ),
          );
        }
        setPlaylistTitle('');
        setCreateOpen(false);
        setFolderPath((path) => [
          ...path,
          { id: playlist.id, title: playlist.title },
        ]);
        setActivePlaylist(playlist);
        toast.success('Папка создана');
      } catch (error) {
        toast.error(localizeErrorMessage(error, 'Не удалось создать папку'));
      } finally {
        setBusy(false);
      }
    })();
  }, [createParentId, playlistTitle]);

  const handleOpenPlaylist = useCallback(
    (playlistId: string, titleHint?: string) => {
      void (async () => {
        try {
          setBusy(true);
          const detail = await getMusicPlaylist(playlistId);
          setActivePlaylist(detail);
          setFolderPath((path) => {
            const idx = path.findIndex((item) => item.id === playlistId);
            if (idx >= 0) {
              return path.slice(0, idx + 1);
            }
            // Opening from root replaces the breadcrumb; nested open appends.
            if (path.length === 0) {
              return [
                {
                  id: detail.id,
                  title: detail.title || titleHint || 'Папка',
                },
              ];
            }
            return [
              ...path,
              {
                id: detail.id,
                title: detail.title || titleHint || 'Папка',
              },
            ];
          });
        } catch (error) {
          toast.error(localizeErrorMessage(error, 'Не удалось открыть папку'));
        } finally {
          setBusy(false);
        }
      })();
    },
    [],
  );

  const handleDeletePlaylist = useCallback(
    (playlist: MusicPlaylistSummary | MusicPlaylistDetail) => {
      void (async () => {
        const ok = await confirmDelete(
          'Удалить папку?',
          `«${playlist.title}» удалится, треки останутся в библиотеке.`,
        );
        if (!ok) return;
        try {
          setBusy(true);
          await deleteMusicPlaylist(playlist.id);
          setPlaylists((prev) =>
            prev.filter(
              (item) => item.id !== playlist.id && item.parentId !== playlist.id,
            ),
          );
          if (
            activePlaylist?.id === playlist.id ||
            folderPath.some((item) => item.id === playlist.id)
          ) {
            setActivePlaylist(null);
            setFolderPath([]);
          }
          void load();
          toast.success('Папка удалена');
        } catch (error) {
          toast.error(localizeErrorMessage(error, 'Не удалось удалить папку'));
        } finally {
          setBusy(false);
        }
      })();
    },
    [activePlaylist, folderPath, load],
  );

  const handleAddToPlaylist = useCallback(
    (playlistId: string) => {
      if (!pickTrackId) return;
      void (async () => {
        try {
          setBusy(true);
          await putTrackInPlaylist(playlistId, pickTrackId);
          setPickTrackId(null);
          toast.success('Добавлено в папку');
        } catch (error) {
          toast.error(localizeErrorMessage(error, 'Не удалось добавить в папку'));
        } finally {
          setBusy(false);
        }
      })();
    },
    [pickTrackId, putTrackInPlaylist],
  );

  const handleDropTrackOnPlaylist = useCallback(
    (playlistId: string, trackId: string) => {
      void (async () => {
        try {
          setBusy(true);
          await putTrackInPlaylist(playlistId, trackId);
          toast.success('Трек в папке');
        } catch (error) {
          toast.error(localizeErrorMessage(error, 'Не удалось положить в папку'));
        } finally {
          setBusy(false);
          setDraggingTrackId(null);
          setDropTargetId(null);
        }
      })();
    },
    [putTrackInPlaylist],
  );

  const handleRemoveFromPlaylist = useCallback(
    (trackId: string) => {
      if (!activePlaylist) return;
      void (async () => {
        try {
          setBusy(true);
          const detail = await removeTrackFromPlaylist(activePlaylist.id, trackId);
          setActivePlaylist(detail);
          setPlaylists((prev) =>
            prev.map((item) =>
              item.id === detail.id
                ? { ...item, trackCount: detail.trackCount }
                : item,
            ),
          );
          // Refresh so inFolder is correct if the track is still in another folder.
          const library = await listMusicTracks();
          setTracks(library.tracks);
        } catch (error) {
          toast.error(localizeErrorMessage(error, 'Не удалось убрать трек'));
        } finally {
          setBusy(false);
        }
      })();
    },
    [activePlaylist],
  );

  const clearDragState = useCallback(() => {
    setDraggingTrackId(null);
    setDropTargetId(null);
  }, []);

  const quotaPercent = useMemo(() => {
    if (!quota?.limitBytes) return 0;
    return Math.min(100, Math.round((quota.usedBytes / quota.limitBytes) * 100));
  }, [quota]);

  const quotaLabel = useMemo(() => {
    if (!quota) return null;
    return `${formatBytes(quota.usedBytes)} из ${formatBytes(quota.limitBytes)}`;
  }, [quota]);

  const handleFolderHover = useCallback((playlistId: string | null) => {
    setDropTargetId(playlistId);
  }, []);

  const toolbarActions = (
    <View style={styles.toolbar}>
      <Button
        label={
          uploadProgress != null
            ? `Загрузка ${uploadProgress}%`
            : busy
              ? 'Загрузка…'
              : 'Загрузить'
        }
        onPress={() => setAddOpen(true)}
        disabled={busy}
        variant="outline"
      />
      <Button
        label="Новая папка"
        onPress={() => setCreateOpen(true)}
        disabled={busy}
      />
    </View>
  );

  return (
    <ScreenTransition>
      <View style={[mainStyles.container, styles.shell]}>
        <View style={styles.headerBlock}>
          {hideMobileChrome ? (
            <View style={styles.headerRow}>
              <View style={styles.headerCopy}>
                <Text style={styles.pageTitle}>Музыка</Text>
                <Text style={styles.subtitle}>
                  Треки и папки для атмосферы за столом. Синхронный проигрыш —
                  позже.
                </Text>
                {quotaLabel ? (
                  <>
                    <View style={styles.quotaRow}>
                      <View style={styles.quotaChip}>
                        <Text style={styles.quotaChipText}>{quotaLabel}</Text>
                      </View>
                      <Text style={styles.quotaHint}>до 20 МБ на трек</Text>
                    </View>
                    <View style={styles.quotaBarTrack}>
                      <View
                        style={[
                          styles.quotaBarFill,
                          { width: `${quotaPercent}%` },
                        ]}
                      />
                    </View>
                  </>
                ) : null}
              </View>
              {isDesktopWeb ? toolbarActions : null}
            </View>
          ) : (
            <MobileScreenHeader title="Музыка" showBack />
          )}
          {!hideMobileChrome ? (
            <>
              <Text style={styles.subtitle}>
                Треки и папки для атмосферы за столом. Синхронный проигрыш —
                позже.
              </Text>
              {quotaLabel ? (
                <>
                  <View style={styles.quotaRow}>
                    <View style={styles.quotaChip}>
                      <Text style={styles.quotaChipText}>{quotaLabel}</Text>
                    </View>
                    <Text style={styles.quotaHint}>до 20 МБ на трек</Text>
                  </View>
                  <View style={styles.quotaBarTrack}>
                    <View
                      style={[
                        styles.quotaBarFill,
                        { width: `${quotaPercent}%` },
                      ]}
                    />
                  </View>
                </>
              ) : null}
            </>
          ) : null}
        </View>

        {!isDesktopWeb || !hideMobileChrome ? toolbarActions : null}

        {uploadProgress != null ? (
          <View style={styles.uploadBanner}>
            <View style={styles.uploadBannerTop}>
              <Text numberOfLines={1} style={styles.uploadBannerTitle}>
                {uploadFileName ?? 'Загрузка трека'}
              </Text>
              <Text style={styles.uploadBannerPercent}>{uploadProgress}%</Text>
            </View>
            <View style={styles.uploadTrack}>
              <View
                style={[
                  styles.uploadFill,
                  { width: `${Math.max(4, uploadProgress)}%` },
                ]}
              />
            </View>
            <Text style={styles.uploadHint}>
              {uploadProgress < 100
                ? 'Отправляем файл на сервер…'
                : 'Сохраняем в библиотеку…'}
            </Text>
          </View>
        ) : null}

        {activePlaylist ? (
          <View style={styles.explorerBar}>
            <View style={styles.explorerCrumb}>
              <Pressable
                accessibilityRole="button"
                onPress={() => {
                  setActivePlaylist(null);
                  setFolderPath([]);
                }}
                style={styles.explorerCrumbBtn}>
                <Text style={styles.explorerCrumbText}>Библиотека</Text>
              </Pressable>
              {folderPath.map((crumb, index) => {
                const isLast = index === folderPath.length - 1;
                return (
                  <View
                    key={crumb.id}
                    style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Text style={styles.explorerSep}>/</Text>
                    {isLast ? (
                      <Text numberOfLines={1} style={styles.explorerCrumbCurrent}>
                        {crumb.title}
                      </Text>
                    ) : (
                      <Pressable
                        accessibilityRole="button"
                        onPress={() =>
                          handleOpenPlaylist(crumb.id, crumb.title)
                        }
                        style={styles.explorerCrumbBtn}>
                        <Text numberOfLines={1} style={styles.explorerCrumbText}>
                          {crumb.title}
                        </Text>
                      </Pressable>
                    )}
                  </View>
                );
              })}
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Удалить папку"
              onPress={() => handleDeletePlaylist(activePlaylist)}
              style={styles.iconBtn}>
              <Ionicons
                name="trash-outline"
                size={18}
                color={colors.destructive}
              />
            </Pressable>
          </View>
        ) : null}

        {loading ? (
          <ActivityIndicator color={colors.primary} />
        ) : (
          <ScrollView
            style={styles.mainPane}
            contentContainerStyle={[
              styles.libraryContent,
              session ? { paddingBottom: 120 } : null,
            ]}>
            {activePlaylist ? (
              <View style={styles.section}>
                {IS_WEB && draggingTrackId ? (
                  <Text style={styles.sectionHint}>
                    Потяните трек на папку
                  </Text>
                ) : null}
                {!folderChildren.length && !activePlaylist.tracks.length ? (
                  <View style={styles.empty}>
                    <Ionicons
                      name="folder-open-outline"
                      size={36}
                      color={colors.primary}
                    />
                    <Text style={styles.emptyText}>
                      Папка пуста. Загрузите трек или создайте вложенную папку.
                    </Text>
                  </View>
                ) : (
                  <View style={styles.explorerList}>
                    {folderChildren.map((playlist) => (
                      <FolderRow
                        key={playlist.id}
                        playlist={playlist}
                        colors={colors}
                        styles={styles}
                        isDropTarget={dropTargetId === playlist.id}
                        isDraggingTrack={Boolean(draggingTrackId)}
                        onHover={handleFolderHover}
                        onDropTrack={handleDropTrackOnPlaylist}
                        onOpen={() =>
                          handleOpenPlaylist(playlist.id, playlist.title)
                        }
                        onDelete={() => handleDeletePlaylist(playlist)}
                      />
                    ))}
                    {activePlaylist.tracks.map((track) => {
                      const index = activePlaylist.tracks.findIndex(
                        (item) => item.id === track.id,
                      );
                      return (
                        <TrackRow
                          key={track.id}
                          track={track}
                          colors={colors}
                          styles={styles}
                          isActive={activePlayback?.trackId === track.id}
                          isPlaying={
                            activePlayback?.trackId === track.id &&
                            activePlayback.playing
                          }
                          dragging={false}
                          onDragStart={setDraggingTrackId}
                          onDragEnd={clearDragState}
                          onPlay={() =>
                            startPlayback(
                              activePlaylist.tracks,
                              Math.max(0, index),
                              activePlaylist.title,
                            )
                          }
                          onRemoveFromPlaylist={() =>
                            handleRemoveFromPlaylist(track.id)
                          }
                          onDelete={() => handleDeleteTrack(track)}
                        />
                      );
                    })}
                  </View>
                )}
              </View>
            ) : (
              <>
                <View style={styles.section}>
                  <View style={styles.sectionHeader}>
                    <Text style={styles.sectionTitle}>Папки</Text>
                    {IS_WEB && rootTracks.length > 0 ? (
                      <Text style={styles.sectionHint}>
                        Потяните трек на папку
                      </Text>
                    ) : null}
                  </View>
                  <View style={styles.folderGrid}>
                    {rootPlaylists.map((playlist) => (
                      <FolderCard
                        key={playlist.id}
                        playlist={playlist}
                        colors={colors}
                        styles={styles}
                        isDropTarget={dropTargetId === playlist.id}
                        isDraggingTrack={Boolean(draggingTrackId)}
                        onHover={handleFolderHover}
                        onDropTrack={handleDropTrackOnPlaylist}
                        onOpen={() =>
                          handleOpenPlaylist(playlist.id, playlist.title)
                        }
                        onDelete={() => handleDeletePlaylist(playlist)}
                      />
                    ))}
                    <Pressable
                      accessibilityRole="button"
                      onPress={() => setCreateOpen(true)}
                      style={({ pressed }) => [
                        styles.createFolderCard,
                        pressed ? { opacity: 0.85 } : null,
                      ]}>
                      <Ionicons name="add" size={28} color={colors.primary} />
                      <Text style={styles.createFolderText}>Новая папка</Text>
                    </Pressable>
                  </View>
                </View>

                <View style={styles.section}>
                  <View style={styles.sectionHeader}>
                    <Text style={styles.sectionTitle}>
                      Треки
                      {rootTracks.length ? ` · ${rootTracks.length}` : ''}
                    </Text>
                  </View>
                  {!tracks.length ? (
                    <View style={styles.empty}>
                      <Ionicons
                        name="musical-notes-outline"
                        size={40}
                        color={colors.primary}
                      />
                      <Text style={styles.emptyText}>
                        Пока пусто. Загрузите файл с устройства или добавьте
                        ссылку (Яндекс Диск или прямой mp3) — до 20 МБ
                        на файл.
                      </Text>
                      <Button
                        label="Загрузить"
                        onPress={() => setAddOpen(true)}
                      />
                    </View>
                  ) : !rootTracks.length ? (
                    <View style={styles.empty}>
                      <Text style={styles.emptyText}>
                        Все треки лежат в папках. Откройте папку или загрузите
                        новый файл.
                      </Text>
                    </View>
                  ) : (
                    <View style={styles.tracksList}>
                      {rootTracks.map((track) => {
                        const playableRoot = rootTracks.filter((item) =>
                          Boolean(item.url),
                        );
                        const index = playableRoot.findIndex(
                          (item) => item.id === track.id,
                        );
                        return (
                          <TrackRow
                            key={track.id}
                            track={track}
                            colors={colors}
                            styles={styles}
                            isActive={activePlayback?.trackId === track.id}
                            isPlaying={
                              activePlayback?.trackId === track.id &&
                              activePlayback.playing
                            }
                            draggable
                            dragging={draggingTrackId === track.id}
                            onDragStart={setDraggingTrackId}
                            onDragEnd={clearDragState}
                            onPlay={() =>
                              startPlayback(
                                playableRoot,
                                Math.max(0, index),
                                'Библиотека',
                              )
                            }
                            onPickFolder={() => setPickTrackId(track.id)}
                            onDelete={() => handleDeleteTrack(track)}
                          />
                        );
                      })}
                    </View>
                  )}
                </View>
              </>
            )}
          </ScrollView>
        )}
      </View>

      <Modal
        visible={addOpen}
        transparent
        animationType={isDesktopWeb ? 'fade' : 'slide'}
        onRequestClose={() => setAddOpen(false)}>
        <Pressable style={styles.modalOverlay} onPress={() => setAddOpen(false)}>
          <Pressable
            style={styles.modalCard}
            onPress={(e) => e.stopPropagation?.()}>
            <Text style={styles.modalTitle}>Добавить трек</Text>
            <View style={styles.choiceList}>
              <Pressable
                accessibilityRole="button"
                onPress={() => {
                  setAddOpen(false);
                  handleUpload();
                }}
                style={({ pressed }) => [
                  styles.choiceRow,
                  pressed ? { opacity: 0.85 } : null,
                ]}>
                <View style={styles.choiceIcon}>
                  <Ionicons name="phone-portrait-outline" size={20} color={colors.primary} />
                </View>
                <View style={styles.choiceCopy}>
                  <Text style={styles.choiceTitle}>С устройства</Text>
                  <Text style={styles.choiceMeta}>
                    Файл mp3/ogg/wav — до 20 МБ
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={colors.primary} />
              </Pressable>
              <Pressable
                accessibilityRole="button"
                onPress={openUrlModal}
                style={({ pressed }) => [
                  styles.choiceRow,
                  pressed ? { opacity: 0.85 } : null,
                ]}>
                <View style={styles.choiceIcon}>
                  <Ionicons name="link-outline" size={20} color={colors.primary} />
                </View>
                <View style={styles.choiceCopy}>
                  <Text style={styles.choiceTitle}>По ссылке</Text>
                  <Text style={styles.choiceMeta}>
                    Яндекс Диск или прямая ссылка на mp3
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={colors.primary} />
              </Pressable>
            </View>
            <View style={styles.modalActions}>
              <Button
                label="Отмена"
                variant="outline"
                onPress={() => setAddOpen(false)}
              />
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal
        visible={createOpen}
        transparent
        animationType={isDesktopWeb ? 'fade' : 'slide'}
        onRequestClose={() => setCreateOpen(false)}>
        <Pressable style={styles.modalOverlay} onPress={() => setCreateOpen(false)}>
          <Pressable
            style={styles.modalCard}
            onPress={(e) => e.stopPropagation?.()}>
            <Text style={styles.modalTitle}>Новая папка</Text>
            <Input
              label="Название"
              value={playlistTitle}
              onChangeText={setPlaylistTitle}
              placeholder="Таверна, бой, исследование…"
              autoFocus
            />
            <View style={styles.modalActions}>
              <Button
                label="Отмена"
                variant="outline"
                onPress={() => setCreateOpen(false)}
              />
              <Button
                label="Создать"
                onPress={handleCreatePlaylist}
                disabled={busy}
              />
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal
        visible={urlOpen}
        transparent
        animationType={isDesktopWeb ? 'fade' : 'slide'}
        onRequestClose={closeUrlModal}>
        <Pressable style={styles.modalOverlay} onPress={closeUrlModal}>
          <Pressable
            style={styles.modalCard}
            onPress={(e) => e.stopPropagation?.()}>
            <Text style={styles.modalTitle}>Трек по ссылке</Text>
            <Text style={styles.modalHint}>
              Выберите тип — поле появится после нажатия.
            </Text>
            <View style={styles.chipRow}>
              {LINK_SOURCES.map((source) => {
                const active = linkSource === source.key;
                return (
                  <Pressable
                    key={source.key}
                    accessibilityRole="button"
                    accessibilityState={{ selected: active }}
                    onPress={() => setLinkSource(source.key)}
                    style={[styles.chip, active ? styles.chipActive : null]}>
                    <Text
                      style={[
                        styles.chipLabel,
                        active ? styles.chipLabelActive : null,
                      ]}>
                      {source.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
            {linkSource ? (
              <View style={styles.urlFields}>
                <Text style={styles.modalHint}>
                  {LINK_SOURCES.find((item) => item.key === linkSource)?.hint}
                </Text>
                <Input
                  label="Ссылка"
                  value={externalUrl}
                  onChangeText={setExternalUrl}
                  placeholder={
                    LINK_SOURCES.find((item) => item.key === linkSource)
                      ?.placeholder
                  }
                  autoCapitalize="none"
                  autoCorrect={false}
                  autoFocus
                />
                <Input
                  label="Название (необязательно)"
                  value={externalTitle}
                  onChangeText={setExternalTitle}
                  placeholder="Атмосфера таверны"
                />
              </View>
            ) : null}
            <View style={styles.modalActions}>
              <Button
                label="Отмена"
                variant="outline"
                onPress={closeUrlModal}
              />
              <Button
                label={busy ? 'Загрузка…' : 'Добавить'}
                onPress={handleCreateFromUrl}
                disabled={busy || !linkSource}
              />
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal
        visible={Boolean(pickTrackId)}
        transparent
        animationType={isDesktopWeb ? 'fade' : 'slide'}
        onRequestClose={() => setPickTrackId(null)}>
        <Pressable style={styles.modalOverlay} onPress={() => setPickTrackId(null)}>
          <Pressable
            style={styles.modalCard}
            onPress={(e) => e.stopPropagation?.()}>
            <Text style={styles.modalTitle}>Куда положить трек?</Text>
            {!playlists.length ? (
              <Text style={styles.emptyText}>
                Сначала создайте папку в библиотеке.
              </Text>
            ) : (
              <ScrollView contentContainerStyle={styles.pickGrid}>
                {playlists.map((playlist) => (
                  <Pressable
                    key={playlist.id}
                    onPress={() => handleAddToPlaylist(playlist.id)}
                    style={styles.pickFolder}>
                    <Ionicons name="folder" size={32} color={colors.primary} />
                    <Text numberOfLines={2} style={styles.pickFolderTitle}>
                      {playlist.title}
                    </Text>
                    <Text style={styles.pickFolderMeta}>
                      {playlist.trackCount} {trackWord(playlist.trackCount)}
                    </Text>
                  </Pressable>
                ))}
              </ScrollView>
            )}
            <View style={styles.modalActions}>
              <Button
                label="Закрыть"
                variant="outline"
                onPress={() => setPickTrackId(null)}
              />
              {!playlists.length ? (
                <Button
                  label="Создать"
                  onPress={() => {
                    setPickTrackId(null);
                    setCreateOpen(true);
                  }}
                />
              ) : null}
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </ScreenTransition>
  );
}
