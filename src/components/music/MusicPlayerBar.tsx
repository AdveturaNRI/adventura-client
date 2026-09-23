import { Ionicons } from '@expo/vector-icons';
import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  PanResponder,
  Pressable,
  StyleSheet,
  Text,
  View,
  type LayoutChangeEvent,
} from 'react-native';

import { toast } from '@/components/ui/feedback/toast';
import { FontSize, Spacing, type ThemeColors } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useThemedStyles } from '@/hooks/use-themed-styles';
import { getMusicTrack, type MusicTrack } from '@/services/music/musicApi';

export type MusicPlaybackSession = {
  id: number;
  tracks: MusicTrack[];
  startIndex: number;
  label?: string;
};

type MusicPlayerBarProps = {
  session: MusicPlaybackSession;
  onClose: () => void;
  onActiveTrackChange?: (
    info: { trackId: string; playing: boolean } | null,
  ) => void;
  /** Floating pill — for mobile so the full dock doesn't block the screen. */
  compact?: boolean;
  onExpand?: () => void;
  onCollapse?: () => void;
};

function formatTime(value: number) {
  const seconds = Math.max(0, Math.floor(Number.isFinite(value) ? value : 0));
  return `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    root: {
      gap: 6,
      paddingHorizontal: Spacing.sm,
      paddingTop: 8,
      paddingBottom: 10,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderColor: colors.borderLight,
      backgroundColor: colors.surface,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      minHeight: 40,
    },
    iconButton: {
      width: 36,
      height: 36,
      alignItems: 'center',
      justifyContent: 'center',
    },
    playButton: {
      width: 38,
      height: 38,
      borderRadius: 19,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.primary,
    },
    copy: {
      flex: 1,
      minWidth: 0,
      paddingHorizontal: 4,
      gap: 2,
    },
    title: {
      fontSize: FontSize.caption,
      fontWeight: '700',
      color: colors.text,
    },
    meta: {
      fontSize: 11,
      color: colors.textMuted,
      fontVariant: ['tabular-nums'],
    },
    seekRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      paddingHorizontal: 4,
    },
    seekTime: {
      width: 40,
      fontSize: 11,
      color: colors.textMuted,
      fontVariant: ['tabular-nums'],
    },
    seekTrack: {
      flex: 1,
      height: 28,
      justifyContent: 'center',
    },
    seekRail: {
      height: 4,
      borderRadius: 2,
      backgroundColor: colors.borderLight,
      overflow: 'hidden',
    },
    seekFill: {
      height: '100%',
      borderRadius: 2,
      backgroundColor: colors.primary,
    },
    seekThumb: {
      position: 'absolute',
      width: 14,
      height: 14,
      borderRadius: 7,
      marginLeft: -7,
      top: 7,
      backgroundColor: colors.primary,
      borderWidth: 2,
      borderColor: colors.surface,
    },
    pill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      maxWidth: 280,
      paddingLeft: 6,
      paddingRight: 8,
      paddingVertical: 6,
      borderRadius: 999,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.borderLight,
      shadowColor: '#0F172A',
      shadowOpacity: 0.16,
      shadowRadius: 14,
      shadowOffset: { width: 0, height: 6 },
      elevation: 10,
    },
    pillPlay: {
      width: 36,
      height: 36,
      borderRadius: 18,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.primary,
    },
    pillCopy: {
      flex: 1,
      minWidth: 0,
      gap: 1,
    },
    pillTitle: {
      fontSize: FontSize.caption,
      fontWeight: '700',
      color: colors.text,
    },
    pillMeta: {
      fontSize: 10,
      color: colors.textMuted,
      fontVariant: ['tabular-nums'],
    },
    pillClose: {
      width: 28,
      height: 28,
      alignItems: 'center',
      justifyContent: 'center',
    },
  });
}

export function MusicPlayerBar({
  session,
  onClose,
  onActiveTrackChange,
  compact = false,
  onExpand,
  onCollapse,
}: MusicPlayerBarProps) {
  return (
    <ActiveMusicPlayerBar
      key={session.id}
      session={session}
      onClose={onClose}
      onActiveTrackChange={onActiveTrackChange}
      compact={compact}
      onExpand={onExpand}
      onCollapse={onCollapse}
    />
  );
}

function ActiveMusicPlayerBar({
  session,
  onClose,
  onActiveTrackChange,
  compact,
  onExpand,
  onCollapse,
}: {
  session: MusicPlaybackSession;
  onClose: () => void;
  onActiveTrackChange?: (
    info: { trackId: string; playing: boolean } | null,
  ) => void;
  compact: boolean;
  onExpand?: () => void;
  onCollapse?: () => void;
}) {
  const colors = useTheme();
  const styles = useThemedStyles(createStyles);
  const queue = session.tracks;
  const [index, setIndex] = useState(() =>
    Math.min(Math.max(session.startIndex, 0), Math.max(queue.length - 1, 0)),
  );
  const [playRequested, setPlayRequested] = useState(true);
  const [urlError, setUrlError] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [scrubbing, setScrubbing] = useState(false);
  const [scrubRatio, setScrubRatio] = useState(0);
  const [seekWidth, setSeekWidth] = useState(0);
  const player = useAudioPlayer(null, { updateInterval: 200 });
  const status = useAudioPlayerStatus(player);
  const loadGenRef = useRef(0);
  const finishedForTrackRef = useRef<string | null>(null);
  const playRequestedRef = useRef(playRequested);
  const seekWidthRef = useRef(0);
  const durationRef = useRef(0);
  const scrubRatioRef = useRef(0);
  const canSeekRef = useRef(false);
  playRequestedRef.current = playRequested;

  const active = queue[index] ?? null;

  const showLoader =
    isLoading || (playRequested && status.isBuffering && !status.playing);
  const isActivelyPlaying =
    Boolean(active) && playRequested && !urlError && !showLoader;

  useEffect(() => {
    if (!active) {
      onActiveTrackChange?.(null);
      return;
    }
    onActiveTrackChange?.({
      trackId: active.id,
      playing: isActivelyPlaying,
    });
  }, [active, isActivelyPlaying, onActiveTrackChange]);

  useEffect(() => {
    return () => {
      onActiveTrackChange?.(null);
    };
  }, [onActiveTrackChange]);

  const loadTrackAt = useCallback(
    async (nextIndex: number, shouldPlay: boolean) => {
      const track = queue[nextIndex];
      if (!track) return;

      const gen = ++loadGenRef.current;
      setUrlError(false);
      setIsLoading(true);
      setScrubbing(false);
      setScrubRatio(0);
      scrubRatioRef.current = 0;
      finishedForTrackRef.current = null;

      try {
        // Всегда берём свежий URL: S3 signed и stream-ticket протухают.
        const fresh = await getMusicTrack(track.id);
        if (gen !== loadGenRef.current) return;
        const playUrl = fresh.url;
        if (!playUrl) {
          setUrlError(true);
          setIsLoading(false);
          toast.error('У трека нет файла для воспроизведения');
          setPlayRequested(false);
          return;
        }
        try {
          player.pause();
        } catch {
          // ignore
        }
        player.replace(playUrl);
        if (shouldPlay) {
          await new Promise((resolve) => setTimeout(resolve, 40));
          if (gen !== loadGenRef.current) return;
          try {
            player.play();
          } catch {
            // AbortError если сменили трек — норма
          }
        }
      } catch {
        if (gen !== loadGenRef.current) return;
        setUrlError(true);
        setIsLoading(false);
        toast.error('Не удалось получить ссылку на трек');
        setPlayRequested(false);
      }
    },
    [player, queue],
  );

  useEffect(() => {
    void loadTrackAt(index, playRequestedRef.current);
  }, [index, loadTrackAt]);

  useEffect(() => {
    if (!isLoading) return;
    if (urlError) {
      setIsLoading(false);
      return;
    }
    if (status.isLoaded || status.playing || status.currentTime > 0.05) {
      setIsLoading(false);
    }
  }, [
    isLoading,
    urlError,
    status.isLoaded,
    status.playing,
    status.currentTime,
  ]);

  useEffect(() => {
    if (!status.didJustFinish || !active || !playRequested) return;
    if (finishedForTrackRef.current === active.id) return;
    finishedForTrackRef.current = active.id;

    if (index < queue.length - 1) {
      setIndex((prev) => prev + 1);
      return;
    }
    setPlayRequested(false);
  }, [status.didJustFinish, active, playRequested, index, queue.length]);

  const duration = Math.max(0, status.duration || active?.durationSec || 0);
  durationRef.current = duration;

  canSeekRef.current = duration > 0 && !showLoader && !urlError;

  const liveRatio =
    duration > 0 ? Math.min(1, Math.max(0, status.currentTime / duration)) : 0;
  const progressRatio = scrubbing ? scrubRatio : liveRatio;
  const displayTime = scrubbing
    ? scrubRatio * duration
    : showLoader
      ? 0
      : status.currentTime;

  const applyScrubX = useCallback((locationX: number) => {
    const width = seekWidthRef.current;
    if (width <= 0) return;
    const ratio = Math.min(1, Math.max(0, locationX / width));
    scrubRatioRef.current = ratio;
    setScrubRatio(ratio);
  }, []);

  const commitScrub = useCallback(async () => {
    const target = scrubRatioRef.current * durationRef.current;
    setScrubbing(false);
    if (durationRef.current <= 0 || !Number.isFinite(target)) return;
    try {
      await player.seekTo(target);
      if (playRequestedRef.current) {
        player.play();
      }
    } catch {
      // ignore seek races while source swaps
    }
  }, [player]);

  const seekPan = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => canSeekRef.current,
        onMoveShouldSetPanResponder: () => canSeekRef.current,
        onPanResponderGrant: (event) => {
          if (!canSeekRef.current) return;
          setScrubbing(true);
          applyScrubX(event.nativeEvent.locationX);
        },
        onPanResponderMove: (event) => {
          applyScrubX(event.nativeEvent.locationX);
        },
        onPanResponderRelease: () => {
          void commitScrub();
        },
        onPanResponderTerminate: () => {
          setScrubbing(false);
        },
      }),
    [applyScrubX, commitScrub],
  );

  const handleSeekLayout = (event: LayoutChangeEvent) => {
    const width = event.nativeEvent.layout.width;
    seekWidthRef.current = width;
    setSeekWidth(width);
  };

  if (!active) return null;

  const canPrev = index > 0;
  const canNext = index < queue.length - 1;
  const showsPause =
    playRequested &&
    !urlError &&
    !showLoader &&
    !(status.didJustFinish && !canNext);
  const thumbLeft = seekWidth * progressRatio;

  const togglePlay = () => {
    if (showLoader) return;
    if (showsPause) {
      setPlayRequested(false);
      player.pause();
      return;
    }
    setPlayRequested(true);
    if (urlError) {
      void loadTrackAt(index, true);
      return;
    }
    player.play();
  };

  const handleClose = () => {
    setPlayRequested(false);
    player.pause();
    onClose();
  };

  if (compact) {
    return (
      <View style={styles.pill}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={
            showLoader ? 'Загрузка' : showsPause ? 'Пауза' : 'Воспроизвести'
          }
          disabled={showLoader && !urlError}
          onPress={togglePlay}
          style={styles.pillPlay}>
          {showLoader ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <Ionicons
              name={showsPause ? 'pause' : 'play'}
              size={16}
              color="#FFFFFF"
            />
          )}
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Развернуть плеер"
          onPress={onExpand}
          style={styles.pillCopy}>
          <Text numberOfLines={1} style={styles.pillTitle}>
            {active.title}
          </Text>
          <Text numberOfLines={1} style={styles.pillMeta}>
            {showLoader
              ? 'Загрузка…'
              : `${index + 1}/${queue.length}${showsPause ? ' · играет' : ''}`}
          </Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Закрыть плеер"
          onPress={handleClose}
          style={styles.pillClose}>
          <Ionicons name="close" size={18} color={colors.textMuted} />
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <View style={styles.row}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Предыдущий трек"
          disabled={!canPrev || showLoader}
          onPress={() => {
            setPlayRequested(true);
            setIsLoading(true);
            setIndex((prev) => Math.max(0, prev - 1));
          }}
          style={styles.iconButton}>
          <Ionicons
            name="play-skip-back"
            size={18}
            color={canPrev && !showLoader ? colors.text : colors.textMuted}
          />
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={
            showLoader ? 'Загрузка' : showsPause ? 'Пауза' : 'Воспроизвести'
          }
          disabled={showLoader && !urlError}
          onPress={togglePlay}
          style={styles.playButton}>
          {showLoader ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <Ionicons
              name={showsPause ? 'pause' : 'play'}
              size={18}
              color="#FFFFFF"
            />
          )}
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Следующий трек"
          disabled={!canNext || showLoader}
          onPress={() => {
            setPlayRequested(true);
            setIsLoading(true);
            setIndex((prev) => Math.min(queue.length - 1, prev + 1));
          }}
          style={styles.iconButton}>
          <Ionicons
            name="play-skip-forward"
            size={18}
            color={canNext && !showLoader ? colors.text : colors.textMuted}
          />
        </Pressable>
        <View style={styles.copy}>
          <Text numberOfLines={1} style={styles.title}>
            {active.title}
          </Text>
          <Text numberOfLines={1} style={styles.meta}>
            {showLoader
              ? 'Загрузка…'
              : session.label
                ? `${session.label} · ${index + 1}/${queue.length}`
                : `${index + 1}/${queue.length}`}
          </Text>
        </View>
        {onCollapse ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Свернуть плеер"
            onPress={onCollapse}
            style={styles.iconButton}>
            <Ionicons name="chevron-down" size={20} color={colors.textMuted} />
          </Pressable>
        ) : null}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Закрыть плеер"
          onPress={handleClose}
          style={styles.iconButton}>
          <Ionicons name="close" size={20} color={colors.textMuted} />
        </Pressable>
      </View>

      <View style={styles.seekRow}>
        <Text style={styles.seekTime}>{formatTime(displayTime)}</Text>
        <View
          style={styles.seekTrack}
          onLayout={handleSeekLayout}
          {...seekPan.panHandlers}
          accessibilityRole="adjustable"
          accessibilityLabel="Позиция трека"
          accessibilityValue={{
            min: 0,
            max: Math.floor(duration),
            now: Math.floor(displayTime),
          }}>
          <View style={styles.seekRail}>
            <View
              style={[styles.seekFill, { width: `${progressRatio * 100}%` }]}
            />
          </View>
          {duration > 0 && seekWidth > 0 ? (
            <View
              pointerEvents="none"
              style={[styles.seekThumb, { left: thumbLeft }]}
            />
          ) : null}
        </View>
        <Text style={[styles.seekTime, { textAlign: 'right' }]}>
          {formatTime(duration)}
        </Text>
      </View>
    </View>
  );
}
