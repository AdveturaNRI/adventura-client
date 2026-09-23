import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  PanResponder,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type LayoutChangeEvent,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useIsDesktopWeb } from '@/components/navigation/DesktopThemeToggle';
import { FontSize, Spacing } from '@/constants/theme';
import type { CallMusicQueueEntry } from '@/hooks/use-call-shared-music';
import {
  getMusicPlaylist,
  listMusicPlaylists,
  listMusicTracks,
  type MusicPlaylistSummary,
  type MusicTrack,
} from '@/services/music/musicApi';
import { localizeErrorMessage } from '@/utils/localizeError';

type Props = {
  visible: boolean;
  canControl: boolean;
  localDisplayName: string;
  trackId: string | null;
  trackTitle: string | null;
  currentEntryId: string | null;
  playing: boolean;
  positionSec: number;
  durationSec: number;
  globalVolume: number;
  queue: CallMusicQueueEntry[];
  onClose: () => void;
  onEnqueueTrack: (trackId: string, title: string, durationSec: number | null) => void;
  onPlayQueueEntry: (entryId: string) => void;
  onRemoveQueueEntry: (entryId: string) => void;
  onTogglePlay: () => void;
  onSeek: (positionSec: number) => void;
  onStopTrack: () => void;
  onGlobalVolumeChange: (volume: number) => void;
  onDismissBard?: () => void;
  onRequestSync?: () => void;
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

export function CallBardSheet({
  visible,
  canControl,
  localDisplayName,
  trackId,
  trackTitle,
  currentEntryId,
  playing,
  positionSec,
  durationSec,
  globalVolume,
  queue,
  onClose,
  onEnqueueTrack,
  onPlayQueueEntry,
  onRemoveQueueEntry,
  onTogglePlay,
  onSeek,
  onStopTrack,
  onGlobalVolumeChange,
  onDismissBard,
  onRequestSync,
}: Props) {
  const isDesktop = useIsDesktopWeb();
  const insets = useSafeAreaInsets();
  const router = useRouter();
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

  const queueDuration =
    queue.find((item) => item.entryId === currentEntryId)?.durationSec ?? null;
  const duration = Math.max(
    0,
    durationSec > 0 ? durationSec : typeof queueDuration === 'number' ? queueDuration : 0,
  );
  durationRef.current = duration;
  const hasTrack = Boolean(trackId);
  const canSeek = canControl && hasTrack && duration > 0;
  canSeekRef.current = canSeek;

  const liveRatio = duration > 0 ? Math.min(1, Math.max(0, positionSec / duration)) : 0;
  const progressRatio = scrubbing ? scrubRatio : liveRatio;
  const displayTime = scrubbing
    ? scrubRatio * duration
    : Math.min(positionSec, duration || positionSec);

  const applyScrubX = useCallback((locationX: number) => {
    const width = seekWidthRef.current;
    if (width <= 0) {
      return;
    }
    const ratio = Math.min(1, Math.max(0, locationX / width));
    scrubRatioRef.current = ratio;
    setScrubRatio(ratio);
  }, []);

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
        onMoveShouldSetPanResponder: () => canSeekRef.current,
        onPanResponderGrant: (event) => {
          if (!canSeekRef.current) {
            return;
          }
          setScrubbing(true);
          applyScrubX(event.nativeEvent.locationX);
        },
        onPanResponderMove: (event) => {
          applyScrubX(event.nativeEvent.locationX);
        },
        onPanResponderRelease: () => {
          commitScrub();
        },
        onPanResponderTerminate: () => {
          setScrubbing(false);
        },
      }),
    [applyScrubX, commitScrub],
  );

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
        onMoveShouldSetPanResponder: () => true,
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

  const handleSeekLayout = (event: LayoutChangeEvent) => {
    const width = event.nativeEvent.layout.width;
    seekWidthRef.current = width;
    setSeekWidth(width);
  };

  const handleVolLayout = (event: LayoutChangeEvent) => {
    const width = event.nativeEvent.layout.width;
    volWidthRef.current = width;
    setVolWidth(width);
  };

  const openLibrary = () => {
    onClose();
    router.push('/music-library');
  };

  const thumbLeft = seekWidth * progressRatio;
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
      accessibilityLabel={`Добавить ${track.title} в очередь`}
      onPress={() => onEnqueueTrack(track.id, track.title, track.durationSec ?? null)}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}>
      <Ionicons name="add-circle-outline" size={18} color="#84B9FF" />
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
                {trackTitle?.trim() || (trackId ? 'Трек выбран' : 'Очередь пуста')}
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

          <View style={styles.playerBlock}>
            {canControl ? (
              <View style={styles.transport}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={playing ? 'Пауза' : 'Играть'}
                  disabled={!trackId}
                  onPress={onTogglePlay}
                  style={({ pressed }) => [
                    styles.transportBtn,
                    !trackId && styles.dimmed,
                    pressed && styles.pressed,
                  ]}>
                  <Ionicons name={playing ? 'pause' : 'play'} size={18} color="#FFFFFF" />
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Остановить"
                  disabled={!trackId}
                  onPress={onStopTrack}
                  style={({ pressed }) => [
                    styles.transportBtnGhost,
                    !trackId && styles.dimmed,
                    pressed && styles.pressed,
                  ]}>
                  <Ionicons name="stop" size={16} color="#FFFFFF" />
                </Pressable>
                <View
                  style={[styles.seekTrack, !canSeek && styles.dimmed]}
                  onLayout={handleSeekLayout}
                  {...(canSeek ? seekPan.panHandlers : {})}
                  accessibilityRole="adjustable"
                  accessibilityLabel="Позиция трека">
                  <View style={styles.rail}>
                    <View style={[styles.railFill, { width: `${progressRatio * 100}%` }]} />
                  </View>
                  {hasTrack && duration > 0 ? (
                    <View style={[styles.thumb, { left: thumbLeft }]} pointerEvents="none" />
                  ) : null}
                </View>
                <Text style={styles.timeChip}>
                  {formatTime(displayTime)}/{formatTime(duration)}
                </Text>
              </View>
            ) : (
              <View style={[styles.seekTrack, styles.seekOnly, styles.dimmed]}>
                <Text style={styles.timeChip}>{formatTime(displayTime)}</Text>
                <View style={styles.rail}>
                  <View style={[styles.railFill, { width: `${progressRatio * 100}%` }]} />
                </View>
                <Text style={styles.timeChip}>{formatTime(duration)}</Text>
              </View>
            )}

            {canControl ? (
              <View style={styles.volRow}>
                <Ionicons name="volume-medium" size={16} color="#84B9FF" />
                <View
                  style={styles.volTrack}
                  onLayout={handleVolLayout}
                  {...volPan.panHandlers}
                  accessibilityRole="adjustable"
                  accessibilityLabel="Громкость для всех"
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
            ) : (
              <Text style={styles.hint}>Добавляй из своей библиотеки. Плейбек — у ведущего.</Text>
            )}
          </View>

          <Text style={styles.sectionLabel}>Очередь · {queue.length}</Text>
          {queue.length === 0 ? (
            <Text style={styles.emptyInline}>Пусто — добавь трек из библиотеки</Text>
          ) : (
            <View style={styles.queueList}>
              {queue.map((entry, index) => {
                const active = entry.entryId === currentEntryId;
                const canRemove = canControl || entry.addedBy === me;
                return (
                  <View key={entry.entryId} style={[styles.row, active && styles.rowActive]}>
                    <Pressable
                      accessibilityRole="button"
                      disabled={!canControl}
                      onPress={() => {
                        if (canControl) {
                          onPlayQueueEntry(entry.entryId);
                        }
                      }}
                      style={styles.rowMain}>
                      <Text style={[styles.rowIndex, active && styles.rowIndexActive]}>
                        {index + 1}
                      </Text>
                      <View style={styles.rowCopy}>
                        <Text style={styles.rowTitle} numberOfLines={1}>
                          {entry.title}
                        </Text>
                        <Text style={styles.rowMeta} numberOfLines={1}>
                          от {entry.addedBy}
                        </Text>
                      </View>
                      {active ? (
                        <Ionicons name="musical-notes" size={14} color="#84B9FF" />
                      ) : null}
                    </Pressable>
                    {canRemove ? (
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel="Убрать из очереди"
                        hitSlop={6}
                        onPress={() => onRemoveQueueEntry(entry.entryId)}
                        style={({ pressed }) => [styles.rowAction, pressed && styles.pressed]}>
                        <Ionicons name="close" size={16} color="#ED4245" />
                      </Pressable>
                    ) : null}
                  </View>
                );
              })}
            </View>
          )}

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
            <ScrollView
              style={styles.list}
              contentContainerStyle={styles.listContent}
              keyboardShouldPersistTaps="handled">
              {rootPlaylists.length === 0 && looseTracks.length === 0 ? (
                <View style={styles.center}>
                  <Text style={styles.emptyInline}>В библиотеке пока пусто</Text>
                  <Pressable onPress={openLibrary} style={styles.retryBtn}>
                    <Text style={styles.retryLabel}>Открыть библиотеку</Text>
                  </Pressable>
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
            </ScrollView>
          ) : libraryBusy ? (
            <View style={styles.center}>
              <ActivityIndicator color="#84B9FF" />
            </View>
          ) : error ? (
            <View style={styles.center}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : browse.kind === 'folder' ? (
            <ScrollView
              style={styles.list}
              contentContainerStyle={styles.listContent}
              keyboardShouldPersistTaps="handled">
              {folderChildren.map((playlist) => (
                <Pressable
                  key={playlist.id}
                  accessibilityRole="button"
                  accessibilityLabel={`Папка ${playlist.title}`}
                  onPress={() =>
                    void openFolder(
                      playlist,
                      browse.path,
                    )
                  }
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
                <Text style={styles.emptyInline}>В папке пока пусто</Text>
              ) : (
                folderTracks.map(renderEnqueueRow)
              )}
            </ScrollView>
          ) : libraryTracks.length === 0 ? (
            <Text style={styles.emptyInline}>Треков без папки нет</Text>
          ) : (
            <ScrollView
              style={styles.list}
              contentContainerStyle={styles.listContent}
              keyboardShouldPersistTaps="handled">
              {libraryTracks.map(renderEnqueueRow)}
            </ScrollView>
          )}

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
  queueList: {
    gap: 4,
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
