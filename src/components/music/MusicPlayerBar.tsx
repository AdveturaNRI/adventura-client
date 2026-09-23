import { Ionicons } from '@expo/vector-icons';
import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

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
};

function formatTime(value: number) {
  const seconds = Math.max(0, Math.floor(Number.isFinite(value) ? value : 0));
  return `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    root: {
      minHeight: 56,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingHorizontal: Spacing.sm,
      paddingVertical: 8,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderColor: colors.borderLight,
      backgroundColor: colors.surface,
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
  });
}

export function MusicPlayerBar({ session, onClose }: MusicPlayerBarProps) {
  return (
    <ActiveMusicPlayerBar
      key={session.id}
      session={session}
      onClose={onClose}
    />
  );
}

function ActiveMusicPlayerBar({
  session,
  onClose,
}: {
  session: MusicPlaybackSession;
  onClose: () => void;
}) {
  const colors = useTheme();
  const styles = useThemedStyles(createStyles);
  const queue = session.tracks;
  const [index, setIndex] = useState(() =>
    Math.min(Math.max(session.startIndex, 0), Math.max(queue.length - 1, 0)),
  );
  const [playRequested, setPlayRequested] = useState(true);
  const [urlError, setUrlError] = useState(false);
  const player = useAudioPlayer(null, { updateInterval: 200 });
  const status = useAudioPlayerStatus(player);
  const loadGenRef = useRef(0);
  const finishedForTrackRef = useRef<string | null>(null);
  const playRequestedRef = useRef(playRequested);
  playRequestedRef.current = playRequested;

  const active = queue[index] ?? null;

  const loadTrackAt = useCallback(
    async (nextIndex: number, shouldPlay: boolean) => {
      const track = queue[nextIndex];
      if (!track) return;

      const gen = ++loadGenRef.current;
      setUrlError(false);
      finishedForTrackRef.current = null;

      try {
        // Всегда берём свежий URL: S3 signed и stream-ticket протухают.
        const fresh = await getMusicTrack(track.id);
        if (gen !== loadGenRef.current) return;
        const playUrl = fresh.url;
        if (!playUrl) {
          setUrlError(true);
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
    if (!status.didJustFinish || !active || !playRequested) return;
    if (finishedForTrackRef.current === active.id) return;
    finishedForTrackRef.current = active.id;

    if (index < queue.length - 1) {
      setIndex((prev) => prev + 1);
      return;
    }
    setPlayRequested(false);
  }, [status.didJustFinish, active, playRequested, index, queue.length]);

  if (!active) return null;

  const canPrev = index > 0;
  const canNext = index < queue.length - 1;
  const showsPause =
    playRequested && !urlError && !(status.didJustFinish && !canNext);

  return (
    <View style={styles.root}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Предыдущий трек"
        disabled={!canPrev}
        onPress={() => {
          setPlayRequested(true);
          setIndex((prev) => Math.max(0, prev - 1));
        }}
        style={styles.iconButton}>
        <Ionicons
          name="play-skip-back"
          size={18}
          color={canPrev ? colors.text : colors.textMuted}
        />
      </Pressable>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={showsPause ? 'Пауза' : 'Воспроизвести'}
        onPress={() => {
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
        }}
        style={styles.playButton}>
        <Ionicons
          name={showsPause ? 'pause' : 'play'}
          size={18}
          color="#FFFFFF"
        />
      </Pressable>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Следующий трек"
        disabled={!canNext}
        onPress={() => {
          setPlayRequested(true);
          setIndex((prev) => Math.min(queue.length - 1, prev + 1));
        }}
        style={styles.iconButton}>
        <Ionicons
          name="play-skip-forward"
          size={18}
          color={canNext ? colors.text : colors.textMuted}
        />
      </Pressable>
      <View style={styles.copy}>
        <Text numberOfLines={1} style={styles.title}>
          {active.title}
        </Text>
        <Text style={styles.meta}>
          {session.label ? `${session.label} · ` : ''}
          {formatTime(status.currentTime)} /{' '}
          {formatTime(status.duration || active.durationSec || 0)}
        </Text>
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Закрыть плеер"
        onPress={() => {
          setPlayRequested(false);
          player.pause();
          onClose();
        }}
        style={styles.iconButton}>
        <Ionicons name="close" size={20} color={colors.textMuted} />
      </Pressable>
    </View>
  );
}
