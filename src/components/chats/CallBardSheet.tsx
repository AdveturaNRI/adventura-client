import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  PanResponder,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
  type LayoutChangeEvent,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useIsDesktopWeb } from '@/components/navigation/DesktopThemeToggle';
import { toast } from '@/components/ui';
import { FontSize, Spacing } from '@/constants/theme';
import type { CallMusicLayerLive, CallMusicQueueEntry } from '@/hooks/use-call-shared-music';
import {
  addTrackToPlaylist,
  createMusicPlaylist,
  createMusicTrackFromUrl,
  getMusicPlaylist,
  listMusicPlaylists,
  listMusicTracks,
  uploadMusicTrack,
  type MusicPlaylistSummary,
  type MusicTrack,
} from '@/services/music/musicApi';
import { localizeErrorMessage } from '@/utils/localizeError';
import { warmPlayableMusicUrl } from '@/utils/music-playable-url';
import {
  filesFromDataTransfer,
  isFileDragEvent,
  isInsideWebNode,
} from '@/utils/web-file-drop';

const MAX_MUSIC_BYTES = 20 * 1024 * 1024;

const AUDIO_EXT = /\.(mp3|wav|ogg|oga|m4a|aac|flac|opus|webm)$/i;

type LinkSourceKind = 'yandex' | 'direct';

const LINK_SOURCES: {
  key: LinkSourceKind;
  label: string;
  placeholder: string;
}[] = [
  {
    key: 'yandex',
    label: 'Яндекс Диск',
    placeholder: 'https://disk.yandex.ru/d/…',
  },
  {
    key: 'direct',
    label: 'Прямая ссылка',
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
    if (kind === 'yandex') {
      return isYandex;
    }
    return !isYandex;
  } catch {
    return false;
  }
}

function isAudioFile(file: File) {
  if (file.type.startsWith('audio/')) {
    return true;
  }
  return AUDIO_EXT.test(file.name);
}

type Props = {
  visible: boolean;
  canControl: boolean;
  localDisplayName: string;
  trackTitle: string | null;
  globalVolume: number;
  queue: CallMusicQueueEntry[];
  layerLive?: Record<string, CallMusicLayerLive>;
  onClose: () => void;
  onEnqueueTrack: (
    trackId: string,
    title: string,
    durationSec: number | null,
    playUrl?: string | null,
  ) => void;
  onRemoveQueueEntry: (entryId: string) => void;
  onToggleLayerPlay: (entryId: string) => void;
  onSeekLayer: (entryId: string, positionSec: number) => void;
  onLayerVolumeChange: (entryId: string, volume: number) => void;
  onToggleLayerLoop: (entryId: string) => void;
  onPauseAll?: () => void;
  /** True when at least one layer is playing — button shows Пауза vs Играть. */
  anyPlaying?: boolean;
  onGlobalVolumeChange: (volume: number) => void;
  onDismissBard?: () => void;
  onRequestSync?: () => void;
  /** Unlock web audio inside press-in (iOS Safari). */
  onAudioGesture?: () => void;
};

type LibraryBrowse =
  | { kind: 'root' }
  | { kind: 'loose' }
  | {
      kind: 'folder';
      id: string;
      title: string;
      /** Breadcrumb root → current for nested back. */
      path: Array<{ id: string; title: string }>;
    };

function clamp01(value: number) {
  return Math.min(1, Math.max(0, value));
}

/** Global call volume: 1% … 100%. */
function clampVolumePercent(value: number) {
  if (!Number.isFinite(value)) {
    return 100;
  }
  return Math.min(100, Math.max(1, Math.round(value)));
}

function formatTime(value: number) {
  const seconds = Math.max(0, Math.floor(Number.isFinite(value) ? value : 0));
  return `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
}

function trackWord(count: number) {
  const mod10 = count % 10;
  const mod100 = count % 100;
  if (mod10 === 1 && mod100 !== 11) {
    return 'трек';
  }
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) {
    return 'трека';
  }
  return 'треков';
}

function LayerPlayerCard({
  entry,
  live,
  canControl,
  canRemove,
  onTogglePlay,
  onSeek,
  onVolumeChange,
  onToggleLoop,
  onRemove,
  onAudioGesture,
}: {
  entry: CallMusicQueueEntry;
  live: CallMusicLayerLive | undefined;
  canControl: boolean;
  canRemove: boolean;
  onTogglePlay: () => void;
  onSeek: (positionSec: number) => void;
  onVolumeChange: (volume: number) => void;
  onToggleLoop: () => void;
  onRemove: () => void;
  onAudioGesture?: () => void;
}) {
  const [scrubbing, setScrubbing] = useState(false);
  const [scrubRatio, setScrubRatio] = useState(0);
  const [seekWidth, setSeekWidth] = useState(0);
  const [volWidth, setVolWidth] = useState(0);
  const [volDragging, setVolDragging] = useState(false);
  const [volDraftPercent, setVolDraftPercent] = useState(100);
  const seekWidthRef = useRef(0);
  const durationRef = useRef(0);
  const scrubRatioRef = useRef(0);
  const canSeekRef = useRef(false);
  const onSeekRef = useRef(onSeek);
  onSeekRef.current = onSeek;
  const trackDomRef = useRef<HTMLElement | null>(null);
  const volWidthRef = useRef(0);
  const volPercentRef = useRef(100);
  const onVolumeChangeRef = useRef(onVolumeChange);
  onVolumeChangeRef.current = onVolumeChange;
  const volTrackDomRef = useRef<HTMLElement | null>(null);

  const wantsPlay = entry.playing !== false;
  const playing = live?.playing ?? wantsPlay;
  const buffering = Boolean(live?.buffering);
  const positionSec = live?.positionSec ?? entry.positionSec ?? 0;
  const duration = Math.max(
    0,
    live?.durationSec ||
      (typeof entry.durationSec === 'number' && entry.durationSec > 0 ? entry.durationSec : 0),
  );
  durationRef.current = duration;
  const canSeek = canControl && duration > 0;
  canSeekRef.current = canSeek;

  const entryVolume =
    typeof entry.volume === 'number' && Number.isFinite(entry.volume)
      ? Math.min(1, Math.max(0, entry.volume))
      : 1;
  const looping = entry.loop === true;
  const volumePercent = clampVolumePercent(entryVolume * 100);
  const displayVolPercent = volDragging ? volDraftPercent : volumePercent;
  volPercentRef.current = displayVolPercent;

  const liveRatio = duration > 0 ? Math.min(1, Math.max(0, positionSec / duration)) : 0;
  const progressRatio = scrubbing ? scrubRatio : liveRatio;
  const displayTime = scrubbing
    ? scrubRatio * duration
    : Math.min(positionSec, duration || positionSec);

  const ratioFromNativeEvent = useCallback((nativeEvent: {
    locationX?: number;
    pageX?: number;
    clientX?: number;
  }) => {
    if (Platform.OS === 'web' && trackDomRef.current) {
      const rect = trackDomRef.current.getBoundingClientRect();
      const clientX =
        typeof nativeEvent.clientX === 'number'
          ? nativeEvent.clientX
          : typeof nativeEvent.pageX === 'number'
            ? nativeEvent.pageX - (typeof window !== 'undefined' ? window.scrollX : 0)
            : null;
      if (rect.width > 0 && clientX != null) {
        return Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
      }
    }
    const width = seekWidthRef.current;
    if (width <= 0) {
      return null;
    }
    const locationX = nativeEvent.locationX;
    if (typeof locationX !== 'number' || !Number.isFinite(locationX)) {
      return null;
    }
    return Math.min(1, Math.max(0, locationX / width));
  }, []);

  const applyScrubFromEvent = useCallback(
    (nativeEvent: { locationX?: number; pageX?: number; clientX?: number }) => {
      const ratio = ratioFromNativeEvent(nativeEvent);
      if (ratio == null) {
        return;
      }
      scrubRatioRef.current = ratio;
      setScrubRatio(ratio);
    },
    [ratioFromNativeEvent],
  );

  const commitScrub = useCallback(() => {
    const target = scrubRatioRef.current * durationRef.current;
    setScrubbing(false);
    if (durationRef.current <= 0 || !Number.isFinite(target)) {
      return;
    }
    onSeekRef.current(target);
  }, []);

  const seekPan = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => canSeekRef.current,
        onStartShouldSetPanResponderCapture: () => canSeekRef.current,
        onMoveShouldSetPanResponder: (_event, gesture) =>
          canSeekRef.current && Math.abs(gesture.dx) >= Math.abs(gesture.dy),
        onPanResponderGrant: (event) => {
          if (!canSeekRef.current) {
            return;
          }
          setScrubbing(true);
          applyScrubFromEvent(event.nativeEvent);
        },
        onPanResponderMove: (event) => {
          applyScrubFromEvent(event.nativeEvent);
        },
        onPanResponderRelease: () => {
          commitScrub();
        },
        onPanResponderTerminate: () => {
          setScrubbing(false);
        },
      }),
    [applyScrubFromEvent, commitScrub],
  );

  const thumbLeft = seekWidth * progressRatio;
  const volRatio = (displayVolPercent - 1) / 99;
  const volThumbLeft = volWidth * volRatio;

  const bindTrackDom = useCallback((node: View | null) => {
    if (Platform.OS !== 'web' || !node) {
      trackDomRef.current = null;
      return;
    }
    const maybe = node as unknown as HTMLElement & { _nativeNode?: HTMLElement };
    trackDomRef.current =
      typeof maybe.getBoundingClientRect === 'function'
        ? maybe
        : (maybe._nativeNode ?? null);
  }, []);

  const bindVolDom = useCallback((node: View | null) => {
    if (Platform.OS !== 'web' || !node) {
      volTrackDomRef.current = null;
      return;
    }
    const maybe = node as unknown as HTMLElement & { _nativeNode?: HTMLElement };
    volTrackDomRef.current =
      typeof maybe.getBoundingClientRect === 'function'
        ? maybe
        : (maybe._nativeNode ?? null);
  }, []);

  const volRatioFromNativeEvent = useCallback(
    (nativeEvent: { locationX?: number; pageX?: number; clientX?: number }) => {
      if (Platform.OS === 'web' && volTrackDomRef.current) {
        const rect = volTrackDomRef.current.getBoundingClientRect();
        const clientX =
          typeof nativeEvent.clientX === 'number'
            ? nativeEvent.clientX
            : typeof nativeEvent.pageX === 'number'
              ? nativeEvent.pageX - (typeof window !== 'undefined' ? window.scrollX : 0)
              : null;
        if (rect.width > 0 && clientX != null) {
          return Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
        }
      }
      const width = volWidthRef.current;
      if (width <= 0) {
        return null;
      }
      const locationX = nativeEvent.locationX;
      if (typeof locationX !== 'number' || !Number.isFinite(locationX)) {
        return null;
      }
      return Math.min(1, Math.max(0, locationX / width));
    },
    [],
  );

  const applyVolFromEvent = useCallback(
    (nativeEvent: { locationX?: number; pageX?: number; clientX?: number }) => {
      const ratio = volRatioFromNativeEvent(nativeEvent);
      if (ratio == null) {
        return;
      }
      const percent = clampVolumePercent(1 + ratio * 99);
      volPercentRef.current = percent;
      setVolDraftPercent(percent);
    },
    [volRatioFromNativeEvent],
  );

  const commitVol = useCallback(() => {
    setVolDragging(false);
    onVolumeChangeRef.current(volPercentRef.current / 100);
  }, []);

  const layerVolPan = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => canControl,
        onStartShouldSetPanResponderCapture: () => canControl,
        onMoveShouldSetPanResponder: (_event, gesture) =>
          canControl && Math.abs(gesture.dx) >= Math.abs(gesture.dy),
        onPanResponderGrant: (event) => {
          if (!canControl) {
            return;
          }
          setVolDragging(true);
          applyVolFromEvent(event.nativeEvent);
        },
        onPanResponderMove: (event) => {
          applyVolFromEvent(event.nativeEvent);
        },
        onPanResponderRelease: () => {
          commitVol();
        },
        onPanResponderTerminate: () => {
          setVolDragging(false);
        },
      }),
    [applyVolFromEvent, canControl, commitVol],
  );

  const webVolClickProps =
    Platform.OS === 'web' && canControl
      ? ({
          onClick: (event: {
            clientX?: number;
            pageX?: number;
            stopPropagation?: () => void;
            preventDefault?: () => void;
          }) => {
            event.preventDefault?.();
            event.stopPropagation?.();
            const ratio = volRatioFromNativeEvent({
              clientX: event.clientX,
              pageX: event.pageX,
            });
            if (ratio == null) {
              return;
            }
            const percent = clampVolumePercent(1 + ratio * 99);
            volPercentRef.current = percent;
            setVolDraftPercent(percent);
            setVolDragging(false);
            onVolumeChangeRef.current(percent / 100);
          },
        } as object)
      : null;

  const webSeekClickProps =
    Platform.OS === 'web'
      ? ({
          onClick: (event: {
            clientX?: number;
            pageX?: number;
            stopPropagation?: () => void;
            preventDefault?: () => void;
          }) => {
            if (!canSeekRef.current) {
              return;
            }
            event.preventDefault?.();
            event.stopPropagation?.();
            onAudioGesture?.();
            const ratio = ratioFromNativeEvent({
              clientX: event.clientX,
              pageX: event.pageX,
            });
            if (ratio == null || durationRef.current <= 0) {
              return;
            }
            scrubRatioRef.current = ratio;
            setScrubRatio(ratio);
            setScrubbing(false);
            onSeekRef.current(ratio * durationRef.current);
          },
        } as object)
      : null;

  return (
    <View style={[styles.layerCard, playing && styles.layerCardPlaying]}>
      <View style={styles.layerTop}>
        <View style={styles.layerCopy}>
          <Text style={styles.layerTitle} numberOfLines={1}>
            {entry.title}
          </Text>
          <Text style={styles.layerMeta} numberOfLines={1}>
            от {entry.addedBy}
          </Text>
        </View>
        <View style={styles.layerTopActions}>
          {canControl ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={looping ? 'Выключить повтор' : 'Зациклить трек'}
              accessibilityState={{ selected: looping }}
              hitSlop={6}
              onPress={onToggleLoop}
              style={({ pressed }) => [
                styles.loopBtn,
                looping && styles.loopBtnOn,
                pressed && styles.pressed,
              ]}>
              <Ionicons
                name="repeat"
                size={16}
                color={looping ? '#E8F2FF' : '#84B9FF'}
              />
            </Pressable>
          ) : looping ? (
            <View style={[styles.loopBtn, styles.loopBtnOn]}>
              <Ionicons name="repeat" size={16} color="#E8F2FF" />
            </View>
          ) : null}
          {canRemove ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Убрать трек"
              hitSlop={6}
              onPress={onRemove}
              style={({ pressed }) => [styles.rowAction, pressed && styles.pressed]}>
              <Ionicons name="close" size={16} color="#ED4245" />
            </Pressable>
          ) : null}
        </View>
      </View>

      <View style={styles.layerTransport}>
        {canControl ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={buffering ? 'Загрузка' : playing ? 'Пауза' : 'Играть'}
            disabled={buffering}
            onPressIn={() => onAudioGesture?.()}
            onPress={onTogglePlay}
            style={({ pressed }) => [
              styles.layerPlayBtn,
              buffering && styles.dimmed,
              pressed && styles.pressed,
            ]}>
            {buffering ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Ionicons name={playing ? 'pause' : 'play'} size={16} color="#FFFFFF" />
            )}
          </Pressable>
        ) : (
          <View style={[styles.layerPlayBtn, styles.dimmed]}>
            <Ionicons name={playing ? 'musical-notes' : 'musical-note'} size={14} color="#FFFFFF" />
          </View>
        )}

        <View
          ref={bindTrackDom}
          style={[styles.layerSeek, !canSeek && styles.dimmed]}
          onLayout={(event) => {
            const width = event.nativeEvent.layout.width;
            seekWidthRef.current = width;
            setSeekWidth(width);
          }}
          {...(canSeek ? seekPan.panHandlers : null)}
          {...webSeekClickProps}
          accessibilityRole="adjustable"
          accessibilityLabel={`Позиция ${entry.title}`}>
          <View style={styles.rail} pointerEvents="none">
            <View style={[styles.railFill, { width: `${progressRatio * 100}%` }]} />
          </View>
          {duration > 0 ? (
            <View style={[styles.thumb, { left: thumbLeft }]} pointerEvents="none" />
          ) : null}
        </View>

        <Text style={styles.layerTime}>
          {formatTime(displayTime)}
          {duration > 0 ? `/${formatTime(duration)}` : ''}
        </Text>
      </View>

      <View style={styles.layerVolRow}>
        <Ionicons name="volume-medium" size={14} color="#84B9FF" />
        <View
          ref={bindVolDom}
          style={[styles.layerVolTrack, !canControl && styles.dimmed]}
          onLayout={(event) => {
            const width = event.nativeEvent.layout.width;
            volWidthRef.current = width;
            setVolWidth(width);
          }}
          {...(canControl ? layerVolPan.panHandlers : null)}
          {...webVolClickProps}
          accessibilityRole="adjustable"
          accessibilityLabel={`Громкость ${entry.title}`}
          accessibilityValue={{
            min: 1,
            max: 100,
            now: displayVolPercent,
            text: `${displayVolPercent}%`,
          }}>
          <View style={styles.rail} pointerEvents="none">
            <View style={[styles.railFill, { width: `${volRatio * 100}%` }]} />
          </View>
          <View style={[styles.thumb, { left: volThumbLeft }]} pointerEvents="none" />
        </View>
        <Text style={styles.layerVolValue}>{displayVolPercent}</Text>
      </View>
    </View>
  );
}

export function CallBardSheet({
  visible,
  canControl,
  localDisplayName,
  trackTitle,
  globalVolume,
  queue,
  layerLive = {},
  onClose,
  onEnqueueTrack,
  onRemoveQueueEntry,
  onToggleLayerPlay,
  onSeekLayer,
  onLayerVolumeChange,
  onToggleLayerLoop,
  onPauseAll,
  anyPlaying = false,
  onGlobalVolumeChange,
  onDismissBard,
  onRequestSync,
  onAudioGesture,
}: Props) {
  const isDesktop = useIsDesktopWeb();
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const bodyScrollMaxHeight = Math.max(
    280,
    Math.min(isDesktop ? 560 : 520, Math.round(windowHeight * (isDesktop ? 0.58 : 0.62))),
  );
  const [tracks, setTracks] = useState<MusicTrack[]>([]);
  const [playlists, setPlaylists] = useState<MusicPlaylistSummary[]>([]);
  const [folderTracks, setFolderTracks] = useState<MusicTrack[]>([]);
  const [folderChildren, setFolderChildren] = useState<MusicPlaylistSummary[]>(
    [],
  );
  const [browse, setBrowse] = useState<LibraryBrowse>({ kind: 'root' });
  const [loading, setLoading] = useState(false);
  const [folderLoading, setFolderLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [createFolderOpen, setCreateFolderOpen] = useState(false);
  const [folderTitle, setFolderTitle] = useState('');
  const [addOpen, setAddOpen] = useState(false);
  const [urlOpen, setUrlOpen] = useState(false);
  const [linkSource, setLinkSource] = useState<LinkSourceKind | null>(null);
  const [externalUrl, setExternalUrl] = useState('');
  const [externalTitle, setExternalTitle] = useState('');
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [uploadFileName, setUploadFileName] = useState<string | null>(null);
  const [fileDragOver, setFileDragOver] = useState(false);
  const libDropRef = useRef<View | null>(null);
  const [volWidth, setVolWidth] = useState(0);
  const [volDragging, setVolDragging] = useState(false);
  const [volDraftPercent, setVolDraftPercent] = useState(100);
  const volWidthRef = useRef(0);
  const volPercentRef = useRef(100);
  const onGlobalVolumeChangeRef = useRef(onGlobalVolumeChange);
  onGlobalVolumeChangeRef.current = onGlobalVolumeChange;

  const volumePercent = clampVolumePercent(clamp01(globalVolume) * 100);
  const displayVolPercent = volDragging ? volDraftPercent : volumePercent;

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [tracksPayload, nextPlaylists] = await Promise.all([
        listMusicTracks(),
        listMusicPlaylists(),
      ]);
      setTracks(tracksPayload.tracks);
      setPlaylists(nextPlaylists);
      for (const track of tracksPayload.tracks) {
        if (track.url) {
          warmPlayableMusicUrl(track.url);
        }
      }
    } catch (err) {
      setError(localizeErrorMessage(err, 'Не удалось загрузить библиотеку'));
      setTracks([]);
      setPlaylists([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!visible) {
      return;
    }
    setBrowse({ kind: 'root' });
    setFolderTracks([]);
    setFolderChildren([]);
    void load();
    onRequestSync?.();
    // Sync once when sheet opens; avoid re-request on parent re-renders.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- onRequestSync identity is unstable
  }, [load, visible]);

  const openFolder = useCallback(
    async (
      playlist: MusicPlaylistSummary,
      pathPrefix: Array<{ id: string; title: string }> = [],
    ) => {
      const path = [
        ...pathPrefix,
        { id: playlist.id, title: playlist.title },
      ];
      setBrowse({
        kind: 'folder',
        id: playlist.id,
        title: playlist.title,
        path,
      });
      setFolderLoading(true);
      setError(null);
      try {
        const detail = await getMusicPlaylist(playlist.id);
        setFolderTracks(detail.tracks);
        setFolderChildren(detail.children ?? []);
      } catch (err) {
        setError(localizeErrorMessage(err, 'Не удалось открыть папку'));
        setFolderTracks([]);
        setFolderChildren([]);
      } finally {
        setFolderLoading(false);
      }
    },
    [],
  );

  const goBackBrowse = useCallback(() => {
    if (browse.kind !== 'folder') {
      setBrowse({ kind: 'root' });
      setFolderTracks([]);
      setFolderChildren([]);
      setError(null);
      return;
    }
    if (browse.path.length <= 1) {
      setBrowse({ kind: 'root' });
      setFolderTracks([]);
      setFolderChildren([]);
      setError(null);
      return;
    }
    const parent = browse.path[browse.path.length - 2];
    const parentPath = browse.path.slice(0, -1);
    void openFolder(
      {
        id: parent.id,
        title: parent.title,
        sortOrder: 0,
        trackCount: 0,
        createdAt: '',
        updatedAt: '',
      },
      parentPath.slice(0, -1),
    );
  }, [browse, openFolder]);

  const currentFolderId = browse.kind === 'folder' ? browse.id : null;

  const handleCreateFolder = useCallback(() => {
    const title = folderTitle.trim();
    if (!title) {
      toast.error('Укажи название папки');
      return;
    }
    if (busy) {
      return;
    }
    void (async () => {
      try {
        setBusy(true);
        const playlist = await createMusicPlaylist(title, currentFolderId);
        setPlaylists((prev) => {
          const without = prev.filter((item) => item.id !== playlist.id);
          return [...without, playlist];
        });
        if (currentFolderId) {
          setFolderChildren((prev) => {
            const without = prev.filter((item) => item.id !== playlist.id);
            return [...without, playlist];
          });
          setPlaylists((prev) =>
            prev.map((item) =>
              item.id === currentFolderId
                ? { ...item, folderCount: (item.folderCount ?? 0) + 1 }
                : item,
            ),
          );
        }
        setFolderTitle('');
        setCreateFolderOpen(false);
        toast.success('Папка создана');
        const pathPrefix =
          browse.kind === 'folder' ? browse.path : ([] as Array<{ id: string; title: string }>);
        await openFolder(playlist, pathPrefix);
      } catch (err) {
        toast.error(localizeErrorMessage(err, 'Не удалось создать папку'));
      } finally {
        setBusy(false);
      }
    })();
  }, [browse, busy, currentFolderId, folderTitle, openFolder]);

  const uploadFromSource = useCallback(
    async (source: {
      uri: string;
      fileName: string;
      mimeType: string;
      size?: number | null;
    }) => {
      if (busy) {
        return;
      }
      if (source.size && source.size > MAX_MUSIC_BYTES) {
        toast.error('Максимум 20 МБ на трек');
        return;
      }

      try {
        setBusy(true);
        setUploadProgress(0);
        setUploadFileName(source.fileName);
        const track = await uploadMusicTrack(source.uri, {
          fileName: source.fileName,
          mimeType: source.mimeType,
          title: source.fileName.replace(/\.[^.]+$/, '') || undefined,
          onProgress: (percent) => setUploadProgress(percent),
        });

        if (currentFolderId) {
          const detail = await addTrackToPlaylist(currentFolderId, track.id);
          setFolderTracks(detail.tracks);
          setFolderChildren(detail.children ?? []);
          setPlaylists((prev) =>
            prev.map((item) =>
              item.id === currentFolderId
                ? { ...item, trackCount: detail.trackCount }
                : item,
            ),
          );
          toast.success('Трек загружен в папку');
        } else {
          setTracks((prev) => [track, ...prev]);
          toast.success('Трек загружен');
          setBrowse({ kind: 'loose' });
        }
        if (track.url) {
          warmPlayableMusicUrl(track.url);
        }
      } catch (err) {
        toast.error(localizeErrorMessage(err, 'Не удалось загрузить трек'));
      } finally {
        setBusy(false);
        setUploadProgress(null);
        setUploadFileName(null);
      }
    },
    [busy, currentFolderId],
  );

  const openAddChoice = useCallback(() => {
    setCreateFolderOpen(false);
    setUrlOpen(false);
    setAddOpen(true);
  }, []);

  const openUrlForm = useCallback(() => {
    setAddOpen(false);
    setLinkSource(null);
    setExternalUrl('');
    setExternalTitle('');
    setUrlOpen(true);
  }, []);

  const closeUrlForm = useCallback(() => {
    setUrlOpen(false);
    setLinkSource(null);
    setExternalUrl('');
    setExternalTitle('');
  }, []);

  const handleCreateFromUrl = useCallback(() => {
    if (!linkSource) {
      toast.error('Выбери тип ссылки');
      return;
    }
    const url = externalUrl.trim();
    if (!url) {
      toast.error('Вставь ссылку');
      return;
    }
    if (!looksLikeLinkSource(url, linkSource)) {
      toast.error(
        linkSource === 'yandex'
          ? 'Это не похоже на ссылку Яндекс Диска'
          : 'Нужна прямая ссылка на файл',
      );
      return;
    }
    if (busy) {
      return;
    }
    void (async () => {
      try {
        setBusy(true);
        const track = await createMusicTrackFromUrl(
          url,
          externalTitle.trim() || undefined,
        );
        if (currentFolderId) {
          const detail = await addTrackToPlaylist(currentFolderId, track.id);
          setFolderTracks(detail.tracks);
          setFolderChildren(detail.children ?? []);
          setPlaylists((prev) =>
            prev.map((item) =>
              item.id === currentFolderId
                ? { ...item, trackCount: detail.trackCount }
                : item,
            ),
          );
          toast.success('Трек добавлен в папку');
        } else {
          setTracks((prev) => [track, ...prev]);
          toast.success('Трек добавлен по ссылке');
          setBrowse({ kind: 'loose' });
        }
        if (track.url) {
          warmPlayableMusicUrl(track.url);
        }
        closeUrlForm();
      } catch (err) {
        toast.error(localizeErrorMessage(err, 'Не удалось добавить трек'));
      } finally {
        setBusy(false);
      }
    })();
  }, [
    busy,
    closeUrlForm,
    currentFolderId,
    externalTitle,
    externalUrl,
    linkSource,
  ]);

  const handleUpload = useCallback(() => {
    if (busy) {
      return;
    }
    setAddOpen(false);
    void (async () => {
      const picked = await DocumentPicker.getDocumentAsync({
        type: ['audio/*'],
        copyToCacheDirectory: true,
        multiple: false,
      });
      if (picked.canceled || !picked.assets?.[0]) {
        return;
      }
      const asset = picked.assets[0];
      await uploadFromSource({
        uri: asset.uri,
        fileName: asset.name || 'track.mp3',
        mimeType: asset.mimeType || 'audio/mpeg',
        size: asset.size,
      });
    })();
  }, [busy, uploadFromSource]);

  const handleDroppedFiles = useCallback(
    (files: File[]) => {
      const audio = files.find(isAudioFile);
      if (!audio) {
        toast.error('Нужен аудиофайл (mp3/ogg/wav/m4a/flac)');
        return;
      }
      const objectUrl = URL.createObjectURL(audio);
      void uploadFromSource({
        uri: objectUrl,
        fileName: audio.name || 'track.mp3',
        mimeType: audio.type || 'audio/mpeg',
        size: audio.size,
      }).finally(() => {
        try {
          URL.revokeObjectURL(objectUrl);
        } catch {
          // ignore
        }
      });
    },
    [uploadFromSource],
  );

  useEffect(() => {
    if (Platform.OS !== 'web' || !visible || typeof document === 'undefined') {
      return;
    }

    const onDragOver = (event: DragEvent) => {
      if (!isFileDragEvent(event)) {
        return;
      }
      event.preventDefault();
      const over = isInsideWebNode(libDropRef.current, event.target);
      if (event.dataTransfer && over) {
        event.dataTransfer.dropEffect = 'copy';
      }
      setFileDragOver(over);
    };

    const onDragLeave = (event: DragEvent) => {
      if (event.relatedTarget == null) {
        setFileDragOver(false);
      }
    };

    const onDrop = (event: DragEvent) => {
      if (!isFileDragEvent(event)) {
        return;
      }
      event.preventDefault();
      setFileDragOver(false);
      if (!isInsideWebNode(libDropRef.current, event.target)) {
        return;
      }
      const files = filesFromDataTransfer(event.dataTransfer);
      if (files.length) {
        handleDroppedFiles(files);
      }
    };

    document.addEventListener('dragenter', onDragOver);
    document.addEventListener('dragover', onDragOver);
    document.addEventListener('dragleave', onDragLeave);
    document.addEventListener('drop', onDrop);
    return () => {
      document.removeEventListener('dragenter', onDragOver);
      document.removeEventListener('dragover', onDragOver);
      document.removeEventListener('dragleave', onDragLeave);
      document.removeEventListener('drop', onDrop);
      setFileDragOver(false);
    };
  }, [handleDroppedFiles, visible]);

  const applyVolX = useCallback((locationX: number) => {
    const width = volWidthRef.current;
    if (width <= 0) {
      return;
    }
    const ratio = Math.min(1, Math.max(0, locationX / width));
    // Map 0…1 rail → 1…100 percent
    const percent = clampVolumePercent(1 + ratio * 99);
    volPercentRef.current = percent;
    setVolDraftPercent(percent);
  }, []);

  const commitVol = useCallback(() => {
    setVolDragging(false);
    onGlobalVolumeChangeRef.current(volPercentRef.current / 100);
  }, []);

  const volPan = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: (_event, gesture) =>
          Math.abs(gesture.dx) > Math.abs(gesture.dy) && Math.abs(gesture.dx) > 3,
        onPanResponderTerminationRequest: () => true,
        onPanResponderGrant: (event) => {
          setVolDragging(true);
          applyVolX(event.nativeEvent.locationX);
        },
        onPanResponderMove: (event) => {
          applyVolX(event.nativeEvent.locationX);
        },
        onPanResponderRelease: () => {
          commitVol();
        },
        onPanResponderTerminate: () => {
          setVolDragging(false);
        },
      }),
    [applyVolX, commitVol],
  );

  const handleVolLayout = (event: LayoutChangeEvent) => {
    const width = event.nativeEvent.layout.width;
    volWidthRef.current = width;
    setVolWidth(width);
  };

  // percent 1…100 → thumb on rail (0 at 1%, 1 at 100%)
  const volRatio = (displayVolPercent - 1) / 99;
  const volThumbLeft = volWidth * volRatio;
  const me = localDisplayName.trim();

  const rootPlaylists = playlists.filter((playlist) => !playlist.parentId);
  const looseTracks = tracks.filter((track) => !track.inFolder);
  const libraryTracks =
    browse.kind === 'folder'
      ? folderTracks
      : browse.kind === 'loose'
        ? looseTracks
        : [];
  const libraryBusy = browse.kind === 'folder' ? folderLoading : loading;

  const renderEnqueueRow = (track: MusicTrack) => (
    <Pressable
      key={track.id}
      accessibilityRole="button"
      accessibilityLabel={
        canControl
          ? `Включить ${track.title}`
          : `Предложить ${track.title}`
      }
      onPressIn={() => {
        if (canControl && Platform.OS === 'web') {
          onEnqueueTrack(track.id, track.title, track.durationSec ?? null, track.url);
          return;
        }
        onAudioGesture?.();
      }}
      onPress={() => {
        if (Platform.OS === 'web' && canControl) {
          return;
        }
        onEnqueueTrack(track.id, track.title, track.durationSec ?? null, track.url);
      }}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}>
      <Ionicons
        name={canControl ? 'play-circle-outline' : 'add-circle-outline'}
        size={18}
        color="#84B9FF"
      />
      <Text style={styles.rowTitle} numberOfLines={1}>
        {track.title}
      </Text>
      {track.durationSec != null ? (
        <Text style={styles.rowMeta}>{formatTime(track.durationSec)}</Text>
      ) : null}
    </Pressable>
  );

  return (
    <Modal
      visible={visible}
      transparent
      animationType={isDesktop ? 'fade' : 'slide'}
      onRequestClose={onClose}>
      <View style={[styles.backdrop, isDesktop && styles.backdropDesktop]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityRole="button" />
        <View
          style={[
            styles.sheet,
            isDesktop ? styles.sheetDesktop : styles.sheetMobile,
            !isDesktop && { paddingBottom: Math.max(insets.bottom, Spacing.sm) },
          ]}>
          {!isDesktop ? <View style={styles.handle} /> : null}

          <View style={styles.header}>
            <View style={styles.headerCopy}>
              <Text style={styles.title}>Бард</Text>
              <Text style={styles.subtitle} numberOfLines={1}>
                {queue.length > 1
                  ? `${queue.length} ${trackWord(queue.length)} вместе`
                  : trackTitle?.trim() || (queue.length === 1 ? 'Играет' : 'Тишина')}
              </Text>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Закрыть"
              hitSlop={8}
              onPress={onClose}
              style={({ pressed }) => [styles.iconBtn, pressed && styles.pressed]}>
              <Ionicons name="close" size={20} color="#C4C8CE" />
            </Pressable>
          </View>

          <ScrollView
            style={[styles.bodyScroll, { maxHeight: bodyScrollMaxHeight }]}
            contentContainerStyle={styles.bodyScrollContent}
            keyboardShouldPersistTaps="handled"
            nestedScrollEnabled
            showsVerticalScrollIndicator>
            <View style={styles.playerBlock}>
              {canControl ? (
                <View style={styles.volBlock}>
                  <View style={styles.volHeaderRow}>
                    <View style={styles.volCopy}>
                      <Text style={styles.volCaption}>Громкость для всех</Text>
                      <Text style={styles.volHint}>Слышно каждому в звонке</Text>
                    </View>
                    {queue.length > 0 && onPauseAll ? (
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={anyPlaying ? 'Пауза всех треков' : 'Играть все треки'}
                        onPressIn={() => onAudioGesture?.()}
                        onPress={onPauseAll}
                        style={({ pressed }) => [styles.pauseAllBtn, pressed && styles.pressed]}>
                        <Ionicons
                          name={anyPlaying ? 'pause' : 'play'}
                          size={14}
                          color="#FFFFFF"
                        />
                        <Text style={styles.pauseAllLabel}>
                          {anyPlaying ? 'Пауза' : 'Играть'}
                        </Text>
                      </Pressable>
                    ) : null}
                  </View>
                  <View
                    style={styles.volRow}
                    {...(Platform.OS === 'web'
                      ? ({ title: 'Громкость для всех' } as object)
                      : null)}>
                    <Ionicons name="volume-medium" size={16} color="#84B9FF" />
                    <View
                      style={styles.volTrack}
                      onLayout={handleVolLayout}
                      {...volPan.panHandlers}
                      accessibilityRole="adjustable"
                      accessibilityLabel="Громкость для всех"
                      accessibilityHint="Меняет громкость Барда у всех участников"
                      accessibilityValue={{
                        min: 1,
                        max: 100,
                        now: displayVolPercent,
                        text: `${displayVolPercent}%`,
                      }}>
                      <View style={styles.rail}>
                        <View style={[styles.railFill, { width: `${volRatio * 100}%` }]} />
                      </View>
                      <View style={[styles.thumb, { left: volThumbLeft }]} pointerEvents="none" />
                    </View>
                    <Text style={styles.volValue}>{displayVolPercent}</Text>
                  </View>
                </View>
              ) : (
                <Text style={styles.hint}>
                  Свою громкость Барда крути на его плитке. Включить трек может ведущий.
                </Text>
              )}
            </View>

            <Text style={styles.sectionLabel}>
              Сейчас играет{queue.length > 0 ? ` · ${queue.length}` : ''}
            </Text>
            {queue.length === 0 ? (
              <Text style={styles.emptyInline}>Ничего не играет — ткни трек в библиотеке</Text>
            ) : (
              <View style={styles.queueList}>
                {queue.map((entry) => {
                  const canRemove = canControl || entry.addedBy === me;
                  return (
                    <LayerPlayerCard
                      key={entry.entryId}
                      entry={entry}
                      live={layerLive[entry.entryId]}
                      canControl={canControl}
                      canRemove={canRemove}
                      onAudioGesture={onAudioGesture}
                      onTogglePlay={() => onToggleLayerPlay(entry.entryId)}
                      onSeek={(position) => onSeekLayer(entry.entryId, position)}
                      onVolumeChange={(volume) => onLayerVolumeChange(entry.entryId, volume)}
                      onToggleLoop={() => onToggleLayerLoop(entry.entryId)}
                      onRemove={() => onRemoveQueueEntry(entry.entryId)}
                    />
                  );
                })}
              </View>
            )}

            <View
              ref={libDropRef}
              style={[styles.libDropZone, fileDragOver && styles.libDropZoneActive]}>
              {fileDragOver ? (
                <View style={styles.libDropOverlay} pointerEvents="none">
                  <Ionicons name="cloud-upload-outline" size={28} color="#84B9FF" />
                  <Text style={styles.libDropLabel}>
                    {currentFolderId ? 'Отпусти — загрузим в эту папку' : 'Отпусти — загрузим трек'}
                  </Text>
                </View>
              ) : null}

              <View style={styles.libHeader}>
                {browse.kind !== 'root' ? (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Назад"
                    hitSlop={8}
                    onPress={() => goBackBrowse()}
                    style={({ pressed }) => [styles.backBtn, pressed && styles.pressed]}>
                    <Ionicons name="chevron-back" size={18} color="#84B9FF" />
                  </Pressable>
                ) : null}
                <Text style={styles.sectionLabelGrow}>
                  {browse.kind === 'root'
                    ? 'Моя библиотека'
                    : browse.kind === 'loose'
                      ? 'Без папки'
                      : browse.title}
                </Text>
              </View>

          {browse.kind !== 'loose' ? (
            <View style={styles.libActions}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Новая папка"
                disabled={busy}
                onPress={() => {
                  setFolderTitle('');
                  setAddOpen(false);
                  setUrlOpen(false);
                  setCreateFolderOpen(true);
                }}
                style={({ pressed }) => [
                  styles.libActionBtn,
                  busy && styles.dimmed,
                  pressed && styles.pressed,
                ]}>
                <Ionicons name="folder-open-outline" size={16} color="#84B9FF" />
                <Text style={styles.libActionLabel}>Папка</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Добавить трек"
                disabled={busy}
                onPress={openAddChoice}
                style={({ pressed }) => [
                  styles.libActionBtn,
                  busy && styles.dimmed,
                  pressed && styles.pressed,
                ]}>
                <Ionicons name="cloud-upload-outline" size={16} color="#84B9FF" />
                <Text style={styles.libActionLabel}>Загрузить</Text>
              </Pressable>
            </View>
          ) : (
            <View style={styles.libActions}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Добавить трек"
                disabled={busy}
                onPress={openAddChoice}
                style={({ pressed }) => [
                  styles.libActionBtn,
                  busy && styles.dimmed,
                  pressed && styles.pressed,
                ]}>
                <Ionicons name="cloud-upload-outline" size={16} color="#84B9FF" />
                <Text style={styles.libActionLabel}>Загрузить трек</Text>
              </Pressable>
            </View>
          )}

          {Platform.OS === 'web' ? (
            <Text style={styles.dropHint}>
              {currentFolderId
                ? 'Или перетащи аудиофайл в эту папку'
                : 'Или перетащи аудиофайл сюда'}
            </Text>
          ) : null}

          {uploadProgress != null ? (
            <View style={styles.uploadBanner}>
              <View style={styles.uploadBannerTop}>
                <Text style={styles.uploadBannerTitle} numberOfLines={1}>
                  {uploadFileName ?? 'Загрузка'}
                </Text>
                <Text style={styles.uploadBannerPercent}>{uploadProgress}%</Text>
              </View>
              <View style={styles.uploadTrack}>
                <View
                  style={[styles.uploadFill, { width: `${Math.max(4, uploadProgress)}%` }]}
                />
              </View>
            </View>
          ) : null}

          {createFolderOpen ? (
            <View style={styles.createFolderBox}>
              <Text style={styles.createFolderTitle}>
                {currentFolderId ? 'Подпапка' : 'Новая папка'}
              </Text>
              <TextInput
                value={folderTitle}
                onChangeText={setFolderTitle}
                placeholder="Название"
                placeholderTextColor="#6D7178"
                autoFocus
                maxLength={80}
                returnKeyType="done"
                onSubmitEditing={handleCreateFolder}
                style={styles.createFolderInput}
              />
              <View style={styles.createFolderActions}>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => {
                    setCreateFolderOpen(false);
                    setFolderTitle('');
                  }}
                  style={({ pressed }) => [styles.createFolderCancel, pressed && styles.pressed]}>
                  <Text style={styles.createFolderCancelLabel}>Отмена</Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  disabled={busy}
                  onPress={handleCreateFolder}
                  style={({ pressed }) => [
                    styles.createFolderSubmit,
                    busy && styles.dimmed,
                    pressed && styles.pressed,
                  ]}>
                  {busy ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <Text style={styles.createFolderSubmitLabel}>Создать</Text>
                  )}
                </Pressable>
              </View>
            </View>
          ) : null}

          {addOpen ? (
            <View style={styles.createFolderBox}>
              <Text style={styles.createFolderTitle}>Добавить трек</Text>
              <Pressable
                accessibilityRole="button"
                disabled={busy}
                onPress={handleUpload}
                style={({ pressed }) => [styles.choiceRow, pressed && styles.pressed]}>
                <View style={styles.choiceIcon}>
                  <Ionicons name="phone-portrait-outline" size={18} color="#84B9FF" />
                </View>
                <View style={styles.choiceCopy}>
                  <Text style={styles.choiceTitle}>С устройства</Text>
                  <Text style={styles.choiceMeta}>Файл mp3/ogg/wav — до 20 МБ</Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color="#84B9FF" />
              </Pressable>
              <Pressable
                accessibilityRole="button"
                disabled={busy}
                onPress={openUrlForm}
                style={({ pressed }) => [styles.choiceRow, pressed && styles.pressed]}>
                <View style={styles.choiceIcon}>
                  <Ionicons name="link-outline" size={18} color="#84B9FF" />
                </View>
                <View style={styles.choiceCopy}>
                  <Text style={styles.choiceTitle}>По ссылке</Text>
                  <Text style={styles.choiceMeta}>Яндекс Диск или прямая ссылка на mp3</Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color="#84B9FF" />
              </Pressable>
              <View style={styles.createFolderActions}>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => setAddOpen(false)}
                  style={({ pressed }) => [styles.createFolderCancel, pressed && styles.pressed]}>
                  <Text style={styles.createFolderCancelLabel}>Отмена</Text>
                </Pressable>
              </View>
            </View>
          ) : null}

          {urlOpen ? (
            <View style={styles.createFolderBox}>
              <Text style={styles.createFolderTitle}>Трек по ссылке</Text>
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
                      <Text style={[styles.chipLabel, active ? styles.chipLabelActive : null]}>
                        {source.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
              {linkSource ? (
                <>
                  <TextInput
                    value={externalUrl}
                    onChangeText={setExternalUrl}
                    placeholder={
                      LINK_SOURCES.find((item) => item.key === linkSource)?.placeholder ??
                      'https://…'
                    }
                    placeholderTextColor="#6D7178"
                    autoCapitalize="none"
                    autoCorrect={false}
                    keyboardType="url"
                    style={styles.createFolderInput}
                  />
                  <TextInput
                    value={externalTitle}
                    onChangeText={setExternalTitle}
                    placeholder="Название (необязательно)"
                    placeholderTextColor="#6D7178"
                    style={styles.createFolderInput}
                  />
                </>
              ) : (
                <Text style={styles.choiceMeta}>Сначала выбери тип ссылки</Text>
              )}
              <View style={styles.createFolderActions}>
                <Pressable
                  accessibilityRole="button"
                  onPress={closeUrlForm}
                  style={({ pressed }) => [styles.createFolderCancel, pressed && styles.pressed]}>
                  <Text style={styles.createFolderCancelLabel}>Отмена</Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  disabled={busy || !linkSource}
                  onPress={handleCreateFromUrl}
                  style={({ pressed }) => [
                    styles.createFolderSubmit,
                    (busy || !linkSource) && styles.dimmed,
                    pressed && styles.pressed,
                  ]}>
                  {busy ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <Text style={styles.createFolderSubmitLabel}>Добавить</Text>
                  )}
                </Pressable>
              </View>
            </View>
          ) : null}

          {libraryBusy && browse.kind === 'root' ? (
            <View style={styles.center}>
              <ActivityIndicator color="#84B9FF" />
            </View>
          ) : error && browse.kind === 'root' ? (
            <View style={styles.center}>
              <Text style={styles.errorText}>{error}</Text>
              <Pressable onPress={() => void load()} style={styles.retryBtn}>
                <Text style={styles.retryLabel}>Повторить</Text>
              </Pressable>
            </View>
          ) : browse.kind === 'root' ? (
            <View style={styles.listContent}>
              {rootPlaylists.length === 0 && looseTracks.length === 0 ? (
                <View style={styles.center}>
                  <Text style={styles.emptyInline}>
                    Пока пусто — создай папку или загрузи трек
                  </Text>
                </View>
              ) : (
                <>
                  {rootPlaylists.map((playlist) => (
                    <Pressable
                      key={playlist.id}
                      accessibilityRole="button"
                      accessibilityLabel={`Папка ${playlist.title}`}
                      onPress={() => void openFolder(playlist)}
                      style={({ pressed }) => [styles.row, pressed && styles.pressed]}>
                      <Ionicons name="folder" size={18} color="#84B9FF" />
                      <View style={styles.rowCopy}>
                        <Text style={styles.rowTitle} numberOfLines={1}>
                          {playlist.title}
                        </Text>
                        <Text style={styles.rowMeta}>
                          {[
                            `${playlist.trackCount} ${trackWord(playlist.trackCount)}`,
                            playlist.folderCount
                              ? `${playlist.folderCount} ${playlist.folderCount === 1 ? 'папка' : 'папок'}`
                              : null,
                          ]
                            .filter(Boolean)
                            .join(' · ')}
                        </Text>
                      </View>
                      <Ionicons name="chevron-forward" size={16} color="#949BA4" />
                    </Pressable>
                  ))}
                  {looseTracks.length > 0 ? (
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel="Треки без папки"
                      onPress={() => setBrowse({ kind: 'loose' })}
                      style={({ pressed }) => [styles.row, pressed && styles.pressed]}>
                      <Ionicons name="musical-notes-outline" size={18} color="#C4C8CE" />
                      <View style={styles.rowCopy}>
                        <Text style={styles.rowTitle} numberOfLines={1}>
                          Без папки
                        </Text>
                        <Text style={styles.rowMeta}>
                          {looseTracks.length} {trackWord(looseTracks.length)}
                        </Text>
                      </View>
                      <Ionicons name="chevron-forward" size={16} color="#949BA4" />
                    </Pressable>
                  ) : null}
                </>
              )}
            </View>
          ) : libraryBusy ? (
            <View style={styles.center}>
              <ActivityIndicator color="#84B9FF" />
            </View>
          ) : error ? (
            <View style={styles.center}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : browse.kind === 'folder' ? (
            <View style={styles.listContent}>
              {folderChildren.map((playlist) => (
                <Pressable
                  key={playlist.id}
                  accessibilityRole="button"
                  accessibilityLabel={`Папка ${playlist.title}`}
                  onPress={() => void openFolder(playlist, browse.path)}
                  style={({ pressed }) => [styles.row, pressed && styles.pressed]}>
                  <Ionicons name="folder" size={18} color="#84B9FF" />
                  <View style={styles.rowCopy}>
                    <Text style={styles.rowTitle} numberOfLines={1}>
                      {playlist.title}
                    </Text>
                    <Text style={styles.rowMeta}>
                      {[
                        `${playlist.trackCount} ${trackWord(playlist.trackCount)}`,
                        playlist.folderCount
                          ? `${playlist.folderCount} ${playlist.folderCount === 1 ? 'папка' : 'папок'}`
                          : null,
                      ]
                        .filter(Boolean)
                        .join(' · ')}
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={16} color="#949BA4" />
                </Pressable>
              ))}
              {folderTracks.length === 0 && folderChildren.length === 0 ? (
                <Text style={styles.emptyInline}>В папке пока пусто — загрузи трек</Text>
              ) : (
                folderTracks.map(renderEnqueueRow)
              )}
            </View>
          ) : libraryTracks.length === 0 ? (
            <Text style={styles.emptyInline}>Треков без папки нет</Text>
          ) : (
            <View style={styles.listContent}>{libraryTracks.map(renderEnqueueRow)}</View>
          )}
              </View>

            {canControl && onDismissBard ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Отключить бота"
                onPress={() => {
                  onDismissBard();
                  onClose();
                }}
                style={({ pressed }) => [styles.dismissBtn, pressed && styles.pressed]}>
                <Ionicons name="close-circle-outline" size={18} color="#ED4245" />
                <Text style={styles.dismissLabel}>Отключить бота</Text>
              </Pressable>
            ) : null}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  sheet: {
    width: '100%',
    backgroundColor: '#1E1F22',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.sm,
    maxHeight: '78%',
    overflow: 'hidden',
    flexDirection: 'column',
  },
  sheetMobile: {
    alignSelf: 'stretch',
  },
  sheetDesktop: {
    maxWidth: 420,
    borderRadius: 16,
    alignSelf: 'center',
    marginTop: 'auto',
    marginBottom: 'auto',
    maxHeight: '72%',
  },
  backdropDesktop: {
    justifyContent: 'center',
  },
  bodyScroll: {
    flexGrow: 1,
    flexShrink: 1,
    minHeight: 0,
  },
  bodyScrollContent: {
    paddingBottom: Spacing.md,
  },
  handle: {
    alignSelf: 'center',
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.18)',
    marginBottom: 6,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  headerCopy: {
    flex: 1,
    minWidth: 0,
  },
  title: {
    color: '#F2F3F5',
    fontSize: FontSize.label,
    fontWeight: '700',
  },
  subtitle: {
    marginTop: 1,
    color: '#B5BAC1',
    fontSize: FontSize.caption,
  },
  iconBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  playerBlock: {
    gap: 8,
    marginBottom: Spacing.sm,
    paddingBottom: Spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  transport: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  transportBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#157AFE',
  },
  transportBtnGhost: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  seekTrack: {
    flex: 1,
    height: 24,
    justifyContent: 'center',
  },
  seekOnly: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  rail: {
    height: 3,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.14)',
    overflow: 'hidden',
  },
  railFill: {
    height: '100%',
    borderRadius: 2,
    backgroundColor: '#157AFE',
  },
  thumb: {
    position: 'absolute',
    width: 12,
    height: 12,
    borderRadius: 6,
    marginLeft: -6,
    top: 6,
    backgroundColor: '#157AFE',
    borderWidth: 2,
    borderColor: '#1E1F22',
  },
  timeChip: {
    color: '#949BA4',
    fontSize: 10,
    fontVariant: ['tabular-nums'],
    minWidth: 58,
    textAlign: 'right',
  },
  volBlock: {
    gap: 6,
  },
  volCaption: {
    color: '#F2F3F5',
    fontSize: 12,
    fontWeight: '700',
  },
  volHint: {
    color: '#949BA4',
    fontSize: 11,
    marginTop: -2,
  },
  volRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  volTrack: {
    flex: 1,
    height: 24,
    justifyContent: 'center',
  },
  volValue: {
    width: 28,
    color: '#84B9FF',
    fontSize: 11,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
    textAlign: 'right',
  },
  hint: {
    color: '#B5BAC1',
    fontSize: FontSize.caption,
    lineHeight: 16,
  },
  sectionLabel: {
    color: '#B5BAC1',
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginBottom: 6,
    marginTop: 4,
  },
  libHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: Spacing.sm,
    marginBottom: 6,
  },
  libDropZone: {
    position: 'relative',
    minHeight: 120,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  libDropZoneActive: {
    borderColor: 'rgba(132, 185, 255, 0.55)',
    backgroundColor: 'rgba(21, 122, 254, 0.1)',
  },
  libDropOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 5,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: 'rgba(12, 20, 34, 0.82)',
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: 'rgba(132, 185, 255, 0.65)',
  },
  libDropLabel: {
    color: '#84B9FF',
    fontSize: FontSize.caption,
    fontWeight: '700',
    textAlign: 'center',
    paddingHorizontal: Spacing.md,
  },
  sectionLabelGrow: {
    flex: 1,
    color: '#B5BAC1',
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  backBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  libActions: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 8,
  },
  libActionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: 'rgba(21, 122, 254, 0.14)',
    borderWidth: 1,
    borderColor: 'rgba(132, 185, 255, 0.28)',
  },
  libActionLabel: {
    color: '#84B9FF',
    fontSize: FontSize.caption,
    fontWeight: '700',
  },
  dropHint: {
    color: '#6D7178',
    fontSize: 10,
    marginBottom: 8,
    textAlign: 'center',
  },
  uploadBanner: {
    marginBottom: 8,
    padding: 8,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.05)',
    gap: 6,
  },
  uploadBannerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  uploadBannerTitle: {
    flex: 1,
    color: '#F2F3F5',
    fontSize: FontSize.caption,
    fontWeight: '600',
  },
  uploadBannerPercent: {
    color: '#84B9FF',
    fontSize: FontSize.caption,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  uploadTrack: {
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.12)',
    overflow: 'hidden',
  },
  uploadFill: {
    height: '100%',
    borderRadius: 2,
    backgroundColor: '#157AFE',
  },
  createFolderBox: {
    marginBottom: 8,
    padding: 10,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(132, 185, 255, 0.22)',
    gap: 8,
  },
  createFolderTitle: {
    color: '#F2F3F5',
    fontSize: FontSize.caption,
    fontWeight: '700',
  },
  createFolderInput: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    backgroundColor: 'rgba(0,0,0,0.25)',
    color: '#F2F3F5',
    paddingHorizontal: 10,
    paddingVertical: Platform.OS === 'web' ? 8 : 10,
    fontSize: FontSize.caption,
  },
  createFolderActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
  },
  createFolderCancel: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  createFolderCancelLabel: {
    color: '#B5BAC1',
    fontSize: FontSize.caption,
    fontWeight: '600',
  },
  createFolderSubmit: {
    minWidth: 88,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#157AFE',
  },
  createFolderSubmitLabel: {
    color: '#FFFFFF',
    fontSize: FontSize.caption,
    fontWeight: '700',
  },
  choiceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  choiceIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(21, 122, 254, 0.16)',
  },
  choiceCopy: {
    flex: 1,
    minWidth: 0,
  },
  choiceTitle: {
    color: '#F2F3F5',
    fontSize: FontSize.caption,
    fontWeight: '700',
  },
  choiceMeta: {
    marginTop: 1,
    color: '#949BA4',
    fontSize: 10,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  chip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  chipActive: {
    backgroundColor: 'rgba(21, 122, 254, 0.22)',
    borderColor: 'rgba(132, 185, 255, 0.45)',
  },
  chipLabel: {
    color: '#B5BAC1',
    fontSize: FontSize.caption,
    fontWeight: '600',
  },
  chipLabelActive: {
    color: '#84B9FF',
  },
  queueList: {
    gap: 8,
  },
  layerCard: {
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  layerCardPlaying: {
    backgroundColor: 'rgba(21, 122, 254, 0.14)',
    borderColor: 'rgba(132, 185, 255, 0.35)',
  },
  layerTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  layerTopActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    flexShrink: 0,
  },
  loopBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(21, 122, 254, 0.12)',
  },
  loopBtnOn: {
    backgroundColor: 'rgba(21, 122, 254, 0.45)',
  },
  layerCopy: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  layerTitle: {
    color: '#F2F3F5',
    fontSize: FontSize.caption,
    fontWeight: '700',
  },
  layerMeta: {
    color: '#949BA4',
    fontSize: 10,
  },
  layerTransport: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  layerPlayBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#157AFE',
    flexShrink: 0,
  },
  layerSeek: {
    flex: 1,
    height: 28,
    justifyContent: 'center',
    minWidth: 0,
    ...(Platform.OS === 'web' ? ({ cursor: 'pointer' } as object) : {}),
  },
  layerTime: {
    color: '#B5BAC1',
    fontSize: 10,
    fontVariant: ['tabular-nums'],
    fontWeight: '600',
    minWidth: 72,
    textAlign: 'right',
    flexShrink: 0,
  },
  layerVolRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  layerVolTrack: {
    flex: 1,
    height: 24,
    justifyContent: 'center',
    minWidth: 0,
    ...(Platform.OS === 'web' ? ({ cursor: 'pointer' } as object) : {}),
  },
  layerVolValue: {
    width: 28,
    color: '#84B9FF',
    fontSize: 11,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
    textAlign: 'right',
    flexShrink: 0,
  },
  volHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    marginBottom: 6,
  },
  volCopy: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  pauseAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: 'rgba(21, 122, 254, 0.45)',
    flexShrink: 0,
  },
  pauseAllLabel: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
  list: {
    flexGrow: 0,
    maxHeight: 220,
  },
  listContent: {
    paddingBottom: Spacing.sm,
    gap: 4,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 7,
    paddingHorizontal: 8,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  rowActive: {
    backgroundColor: 'rgba(21, 122, 254, 0.18)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(132, 185, 255, 0.4)',
  },
  rowMain: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    minWidth: 0,
  },
  rowIndex: {
    width: 16,
    color: '#949BA4',
    fontSize: 11,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  rowIndexActive: {
    color: '#84B9FF',
  },
  rowCopy: {
    flex: 1,
    minWidth: 0,
  },
  rowTitle: {
    flex: 1,
    color: '#F2F3F5',
    fontSize: FontSize.caption,
    fontWeight: '600',
  },
  rowMeta: {
    marginTop: 1,
    color: '#949BA4',
    fontSize: 10,
  },
  rowAction: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  center: {
    paddingVertical: Spacing.md,
    alignItems: 'center',
    gap: Spacing.sm,
  },
  emptyInline: {
    color: '#949BA4',
    fontSize: FontSize.caption,
    marginBottom: 4,
  },
  errorText: {
    color: '#FFB4B4',
    fontSize: FontSize.caption,
    textAlign: 'center',
  },
  retryBtn: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: 'rgba(21, 122, 254, 0.2)',
  },
  retryLabel: {
    color: '#84B9FF',
    fontWeight: '600',
    fontSize: FontSize.caption,
  },
  dismissBtn: {
    marginTop: Spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: 'rgba(237, 66, 69, 0.12)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(237, 66, 69, 0.4)',
  },
  dismissLabel: {
    color: '#ED4245',
    fontSize: FontSize.caption,
    fontWeight: '700',
  },
  dimmed: {
    opacity: 0.4,
  },
  pressed: {
    opacity: 0.85,
  },
});
