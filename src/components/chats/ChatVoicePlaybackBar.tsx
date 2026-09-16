import { Ionicons } from '@expo/vector-icons';
import { useAudioPlaylist, useAudioPlaylistStatus } from 'expo-audio';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useIsDesktopWeb } from '@/components/navigation/DesktopThemeToggle';
import { useVoicePlayback } from '@/context/VoicePlaybackContext';
import { useTheme } from '@/hooks/use-theme';
import {
  loadVoicePlaybackSpeed,
  saveVoicePlaybackSpeed,
  VOICE_PLAYBACK_SPEEDS,
} from '@/utils/voice-playback-settings';
import { markVoiceListened } from '@/utils/voice-listened';

export type { ChatVoiceQueueItem } from '@/context/VoicePlaybackContext';
export type ChatVoiceProgress = {
  key: string;
  currentTime: number;
  duration: number;
  playing: boolean;
  rate: number;
};

const progressListeners = new Set<(progress: ChatVoiceProgress | null) => void>();

export function subscribeVoiceProgress(listener: (progress: ChatVoiceProgress | null) => void) {
  progressListeners.add(listener);
  return () => {
    progressListeners.delete(listener);
  };
}

function publishVoiceProgress(progress: ChatVoiceProgress | null) {
  progressListeners.forEach((listener) => listener(progress));
}

function formatTime(value: number) {
  const seconds = Math.max(0, Math.floor(Number.isFinite(value) ? value : 0));
  return `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
}

const SPEEDS = VOICE_PLAYBACK_SPEEDS;

export function ChatVoicePlaybackBar() {
  const { queue, activeKey, sessionId } = useVoicePlayback();
  const activeIndex = queue.findIndex((item) => item.key === activeKey);
  const active = activeIndex >= 0 ? queue[activeIndex] : null;

  if (!active) return null;

  // `sessionId` changes only when the user starts another voice manually.
  // Automatic sequential transitions deliberately stay in the same playlist:
  // it already owns a preloaded HTMLAudioElement for the following message.
  return (
    <ActiveVoicePlaybackBar
      key={sessionId}
      initialActive={active}
      initialActiveIndex={activeIndex}
    />
  );
}

function ActiveVoicePlaybackBar({
  initialActive,
  initialActiveIndex,
}: {
  initialActive: ChatVoiceQueueItem;
  initialActiveIndex: number;
}) {
  const colors = useTheme();
  const insets = useSafeAreaInsets();
  const isDesktopWeb = useIsDesktopWeb();
  const { queue, activeKey, toggleRequest, setActiveKey, setPlayingKey } = useVoicePlayback();
  const playlistQueueRef = useRef(queue.slice(initialActiveIndex));
  const playlist = useAudioPlaylist({
    sources: playlistQueueRef.current.map((item) => item.attachment.url),
    updateInterval: 100,
  });
  const status = useAudioPlaylistStatus(playlist);
  const currentOffset = Math.min(Math.max(status.currentIndex, 0), playlistQueueRef.current.length - 1);
  const active = playlistQueueRef.current[currentOffset] ?? initialActive;
  const hasCurrentPlaylistStatus = status.id === playlist.id;
  const currentTime = hasCurrentPlaylistStatus ? status.currentTime : 0;
  const duration = hasCurrentPlaylistStatus ? status.duration : 0;
  const isActuallyPlaying = hasCurrentPlaylistStatus && status.playing;
  // expo-audio emits `onplay` as soon as the browser accepts the request,
  // which may still be before the first decoded audio sample. The bubbles
  // interpolate their progress, so only let them animate once the media clock
  // itself has demonstrably moved.
  const isProgressing = isActuallyPlaying && currentTime > 0.03;
  const [playRequested, setPlayRequested] = useState(true);
  // This is intentional UI state, rather than the delayed media status: the
  // user should see Pause immediately after pressing Play, including while the
  // next source is buffering.
  const showsPause = playRequested;
  const [speedIndex, setSpeedIndex] = useState(0);
  const startedSourceRef = useRef<string | null>(null);
  const playedKeyRef = useRef<string | null>(null);
  const finishedKeyRef = useRef<string | null>(null);
  // A toggle is meaningful only for the instance that existed when it was
  // clicked. A newly selected voice must not inherit a pause/play request from
  // a previously selected one.
  const handledToggleRequestRef = useRef(toggleRequest);

  useEffect(() => {
    let mounted = true;
    void loadVoicePlaybackSpeed().then((speed) => {
      if (mounted) {
        setSpeedIndex(Math.max(0, SPEEDS.indexOf(speed)));
      }
    });
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    playlist.playbackRate = SPEEDS[speedIndex];
  }, [playlist, speedIndex]);

  useEffect(() => {
    if (toggleRequest === 0 || handledToggleRequestRef.current === toggleRequest) return;
    // The call must stay tied to the user's click. On the web `HTMLMediaElement`
    // accepts play() before its data is ready and starts as soon as it loads;
    // postponing it until `isLoaded` loses the browser's user-activation token
    // and makes the first click appear to do nothing.
    handledToggleRequestRef.current = toggleRequest;
    if (showsPause) {
      setPlayRequested(false);
      playlist.pause();
    } else {
      setPlayRequested(true);
      playlist.play();
    }
  }, [playlist, showsPause, toggleRequest]);

  useEffect(() => {
    if (startedSourceRef.current === initialActive.key) return;
    startedSourceRef.current = initialActive.key;
    playedKeyRef.current = null;
    finishedKeyRef.current = null;
    setPlayRequested(true);
    // Do not wait for `isLoaded`: on Web this play request needs to originate
    // from the user's original tap. The native HTML audio element queues it
    // until it has enough data, without requiring a second tap.
    void playlist.seekTo(0);
    playlist.play();
  }, [initialActive.key, playlist]);

  useEffect(() => {
    return () => {
      // Do not leave an old visual progress sample alive while React mounts
      // the keyed player for the next voice.
      publishVoiceProgress(null);
    };
  }, []);

  useEffect(() => {
    setPlayingKey(active && showsPause ? active.key : null);
  }, [active, setPlayingKey, showsPause]);

  useEffect(() => {
    publishVoiceProgress({
      key: active.key,
      currentTime,
      duration: duration || active.attachment.durationSec || 0,
      playing: Boolean(isProgressing),
      rate: SPEEDS[speedIndex],
    });
  }, [active, currentTime, duration, isProgressing, speedIndex]);

  useEffect(() => {
    if (active && isProgressing) {
      playedKeyRef.current = active.key;
    }
  }, [active, isProgressing]);

  const move = useCallback((offset: number) => {
    if (offset < 0) playlist.previous();
    else playlist.next();
  }, [playlist]);

  useEffect(() => {
    if (activeKey !== active.key) setActiveKey(active.key);
  }, [active.key, activeKey, setActiveKey]);

  useEffect(() => {
    if (!active || playedKeyRef.current !== active.key) return;
    const totalDuration = duration || active.attachment.durationSec || 0;
    if (totalDuration > 0 && currentTime / totalDuration >= 0.9) {
      void markVoiceListened(active.key);
    }
  }, [active, currentTime, duration]);

  useEffect(() => {
    if (
      !active ||
      !hasCurrentPlaylistStatus ||
      !status.didJustFinish ||
      playedKeyRef.current !== active.key ||
      finishedKeyRef.current === active.key
    ) return;
    finishedKeyRef.current = active.key;
    void markVoiceListened(active.key);
    if (currentOffset >= playlistQueueRef.current.length - 1) {
      setPlayRequested(false);
      playlist.pause();
      setActiveKey(null);
    }
  }, [active, currentOffset, hasCurrentPlaylistStatus, playlist, setActiveKey, status.didJustFinish]);

  const displayedDuration = duration || active.attachment.durationSec || 0;
  return (
    <View
      style={[
        styles.root,
        {
          backgroundColor: colors.surface,
          borderColor: colors.borderLight,
          paddingTop: isDesktopWeb ? 0 : insets.top,
        },
      ]}>
      <Pressable accessibilityRole="button" accessibilityLabel="Более позднее голосовое" disabled={currentOffset <= 0} onPress={() => move(-1)} style={styles.iconButton}><Ionicons name="play-skip-back" size={18} color={currentOffset <= 0 ? colors.textMuted : colors.text} /></Pressable>
      <Pressable accessibilityRole="button" accessibilityLabel={showsPause ? 'Пауза' : 'Воспроизвести'} onPress={() => { if (showsPause) { setPlayRequested(false); playlist.pause(); } else { setPlayRequested(true); playlist.play(); } }} style={[styles.playButton, { backgroundColor: colors.primary }]}><Ionicons name={showsPause ? 'pause' : 'play'} size={18} color="#FFFFFF" /></Pressable>
      <Pressable accessibilityRole="button" accessibilityLabel="Более раннее голосовое" disabled={currentOffset >= playlistQueueRef.current.length - 1} onPress={() => move(1)} style={styles.iconButton}><Ionicons name="play-skip-forward" size={18} color={currentOffset >= playlistQueueRef.current.length - 1 ? colors.textMuted : colors.text} /></Pressable>
      <View style={styles.copy}><Text numberOfLines={1} style={[styles.title, { color: colors.text }]}>Голосовое сообщение</Text><Text style={[styles.time, { color: colors.textMuted }]}>{formatTime(currentTime)} / {formatTime(displayedDuration)}</Text></View>
      <Pressable accessibilityRole="button" accessibilityLabel="Изменить скорость" onPress={() => { const next = (speedIndex + 1) % SPEEDS.length; setSpeedIndex(next); void saveVoicePlaybackSpeed(SPEEDS[next]); }} style={[styles.speed, { borderColor: colors.borderLight }]}><Text style={[styles.speedText, { color: colors.text }]}>{SPEEDS[speedIndex]}×</Text></Pressable>
      <Pressable accessibilityRole="button" accessibilityLabel="Закрыть плеер" onPress={() => { setPlayRequested(false); playlist.pause(); setActiveKey(null); }} style={styles.iconButton}><Ionicons name="close" size={20} color={colors.textMuted} /></Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { minHeight: 52, flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, borderBottomWidth: StyleSheet.hairlineWidth, flexShrink: 0 },
  iconButton: { width: 32, height: 36, alignItems: 'center', justifyContent: 'center' },
  playButton: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  copy: { flex: 1, minWidth: 0, paddingHorizontal: 4 }, title: { fontSize: 13, fontWeight: '700' }, time: { fontSize: 11, marginTop: 1, fontVariant: ['tabular-nums'] },
  speed: { minWidth: 34, height: 27, borderWidth: 1, borderRadius: 8, alignItems: 'center', justifyContent: 'center' }, speedText: { fontSize: 11, fontWeight: '700' },
});
