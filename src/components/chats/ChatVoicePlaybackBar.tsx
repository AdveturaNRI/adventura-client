import { Ionicons } from '@expo/vector-icons';
import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
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
  const colors = useTheme();
  const insets = useSafeAreaInsets();
  const isDesktopWeb = useIsDesktopWeb();
  const { queue, activeKey, toggleRequest, setActiveKey, setPlayingKey } = useVoicePlayback();
  const activeIndex = queue.findIndex((item) => item.key === activeKey);
  const active = activeIndex >= 0 ? queue[activeIndex] : null;
  const player = useAudioPlayer(active?.attachment.url ?? undefined, { updateInterval: 100 });
  const status = useAudioPlayerStatus(player);
  const [speedIndex, setSpeedIndex] = useState(0);
  const startedKeyRef = useRef<string | null>(null);
  const playedKeyRef = useRef<string | null>(null);
  const finishedKeyRef = useRef<string | null>(null);
  const handledToggleRequestRef = useRef(0);

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
    player.setPlaybackRate(SPEEDS[speedIndex], 'high');
  }, [player, speedIndex]);

  useEffect(() => {
    if (!active || toggleRequest === 0 || handledToggleRequestRef.current === toggleRequest) return;
    handledToggleRequestRef.current = toggleRequest;
    if (status.playing) player.pause();
    else player.play();
  }, [active, player, status.playing, toggleRequest]);

  useEffect(() => {
    if (!active || startedKeyRef.current === active.key) return;
    startedKeyRef.current = active.key;
    playedKeyRef.current = null;
    finishedKeyRef.current = null;
    player.play();
  }, [active, player]);

  useEffect(() => {
    setPlayingKey(active && status.playing ? active.key : null);
  }, [active, setPlayingKey, status.playing]);

  useEffect(() => {
    if (!active) {
      publishVoiceProgress(null);
      return;
    }

    publishVoiceProgress({
      key: active.key,
      currentTime: status.currentTime,
      duration: status.duration || active.attachment.durationSec || 0,
      playing: Boolean(status.playing),
      rate: SPEEDS[speedIndex],
    });
  }, [active, speedIndex, status.currentTime, status.duration, status.playing]);

  useEffect(() => {
    if (active && status.playing) {
      playedKeyRef.current = active.key;
    }
  }, [active, status.playing]);

  const move = useCallback((offset: number) => {
    const target = queue[activeIndex + offset];
    if (target) setActiveKey(target.key);
  }, [activeIndex, queue, setActiveKey]);

  useEffect(() => {
    if (!active || playedKeyRef.current !== active.key) return;
    const duration = status.duration || active.attachment.durationSec || 0;
    if (duration > 0 && status.currentTime / duration >= 0.9) {
      void markVoiceListened(active.key);
    }
  }, [active, status.currentTime, status.duration]);

  useEffect(() => {
    if (
      !active ||
      !status.didJustFinish ||
      playedKeyRef.current !== active.key ||
      finishedKeyRef.current === active.key
    ) return;
    finishedKeyRef.current = active.key;
    void markVoiceListened(active.key);
    const older = queue[activeIndex + 1];
    if (older) setActiveKey(older.key);
    else {
      player.pause();
      setActiveKey(null);
    }
  }, [active, activeIndex, player, queue, setActiveKey, status.didJustFinish]);

  if (!active) return null;
  const duration = status.duration || active.attachment.durationSec || 0;
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
      <Pressable accessibilityRole="button" accessibilityLabel="Более позднее голосовое" disabled={activeIndex <= 0} onPress={() => move(-1)} style={styles.iconButton}><Ionicons name="play-skip-back" size={18} color={activeIndex <= 0 ? colors.textMuted : colors.text} /></Pressable>
      <Pressable accessibilityRole="button" accessibilityLabel={status.playing ? 'Пауза' : 'Воспроизвести'} onPress={() => (status.playing ? player.pause() : player.play())} style={[styles.playButton, { backgroundColor: colors.primary }]}><Ionicons name={status.playing ? 'pause' : 'play'} size={18} color="#FFFFFF" /></Pressable>
      <Pressable accessibilityRole="button" accessibilityLabel="Более раннее голосовое" disabled={activeIndex >= queue.length - 1} onPress={() => move(1)} style={styles.iconButton}><Ionicons name="play-skip-forward" size={18} color={activeIndex >= queue.length - 1 ? colors.textMuted : colors.text} /></Pressable>
      <View style={styles.copy}><Text numberOfLines={1} style={[styles.title, { color: colors.text }]}>Голосовое сообщение</Text><Text style={[styles.time, { color: colors.textMuted }]}>{formatTime(status.currentTime)} / {formatTime(duration)}</Text></View>
      <Pressable accessibilityRole="button" accessibilityLabel="Изменить скорость" onPress={() => { const next = (speedIndex + 1) % SPEEDS.length; setSpeedIndex(next); void saveVoicePlaybackSpeed(SPEEDS[next]); }} style={[styles.speed, { borderColor: colors.borderLight }]}><Text style={[styles.speedText, { color: colors.text }]}>{SPEEDS[speedIndex]}×</Text></Pressable>
      <Pressable accessibilityRole="button" accessibilityLabel="Закрыть плеер" onPress={() => { player.pause(); setActiveKey(null); }} style={styles.iconButton}><Ionicons name="close" size={20} color={colors.textMuted} /></Pressable>
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
