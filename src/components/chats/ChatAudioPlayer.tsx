import { Ionicons } from '@expo/vector-icons';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue } from 'react-native-reanimated';

import type { ChatAttachment } from '@/services/chats/chatsApi';
import {
  subscribeVoiceProgress,
  type ChatVoiceProgress,
} from '@/components/chats/ChatVoicePlaybackBar';
import { subscribeVoiceListened } from '@/utils/voice-listened';

type Props = {
  playbackKey: string;
  attachment: ChatAttachment;
  mine: boolean;
  active: boolean;
  playing: boolean;
  onPress: () => void;
  accentColor: string;
  textColor: string;
};
const BAR_WIDTH = 2;
const BAR_GAP = 2;
const FALLBACK_WAVE_BARS = 36;

function formatTime(value: number) {
  const seconds = Math.max(0, Math.floor(Number.isFinite(value) ? value : 0));
  return `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
}

function fallbackWaveform(seed: string, count: number) {
  return Array.from({ length: count }, (_, index) => {
    const char = seed.charCodeAt(index % Math.max(seed.length, 1)) || 17;
    return 0.25 + ((char * (index + 5)) % 70) / 100;
  });
}

function resampleWaveform(values: number[], count: number) {
  if (count <= 0) return [];
  if (!values.length) {
    return Array.from({ length: count }, () => 0.2);
  }
  if (values.length === count) return values;

  return Array.from({ length: count }, (_, index) => {
    const start = Math.floor((index * values.length) / count);
    const end = Math.max(start + 1, Math.floor(((index + 1) * values.length) / count));
    let peak = 0;
    for (let cursor = start; cursor < end; cursor += 1) {
      peak = Math.max(peak, values[cursor] ?? 0);
    }
    return Math.max(0.16, Math.min(1, peak));
  });
}

function barsForWidth(width: number) {
  if (width <= 0) return FALLBACK_WAVE_BARS;
  return Math.max(12, Math.floor((width + BAR_GAP) / (BAR_WIDTH + BAR_GAP)));
}

function clampTime(value: number, duration: number) {
  if (!Number.isFinite(value) || value < 0) return 0;
  if (!Number.isFinite(duration) || duration <= 0) return 0;
  return Math.min(duration, value);
}

/** Voice-message card. Playback itself is managed by the single top chat player. */
export function ChatAudioPlayer({
  playbackKey,
  attachment,
  mine,
  active,
  playing,
  onPress,
  accentColor,
  textColor,
}: Props) {
  const [trackWidth, setTrackWidth] = useState(0);
  const sourceWave = useMemo(
    () =>
      attachment.waveform?.length
        ? attachment.waveform.map((value) => Math.max(0.16, Math.min(1, Number(value) || 0.16)))
        : null,
    [attachment.waveform],
  );
  const barCount = barsForWidth(trackWidth);
  const waveform = useMemo(
    () =>
      sourceWave
        ? resampleWaveform(sourceWave, barCount)
        : fallbackWaveform(attachment.name || attachment.url || 'audio', barCount),
    [attachment.name, attachment.url, barCount, sourceWave],
  );
  const overlayWidth = useSharedValue(0);
  const trackWidthRef = useRef(0);
  const sampleRef = useRef<ChatVoiceProgress | null>(null);
  const sampleAtRef = useRef(0);
  const lastClockSecRef = useRef(0);
  const [live, setLive] = useState(false);
  const [storedHeard, setStoredHeard] = useState(false);
  const [clock, setClock] = useState({
    listened: 0,
    duration: attachment.durationSec ?? 0,
  });
  // Own voices are always treated as listened — only incoming can stay unread.
  const heard = mine || storedHeard;

  useEffect(() => {
    if (mine) return undefined;
    return subscribeVoiceListened((keys) => {
      setStoredHeard(keys.has(playbackKey));
    });
  }, [mine, playbackKey]);

  const overlayStyle = useAnimatedStyle(() => ({
    width: overlayWidth.value,
  }));

  const paintRatio = (time: number, duration: number) => {
    const width = trackWidthRef.current;
    overlayWidth.value =
      duration > 0 && width > 0 ? (clampTime(time, duration) / duration) * width : 0;
  };

  useEffect(() => {
    return subscribeVoiceProgress((next) => {
      if (next?.key !== playbackKey) {
        // The global player emits progress for the active voice only. Ignore
        // it in every untouched bubble instead of resetting dozens of waves
        // and their animated overlays four times per second.
        if (sampleRef.current === null) return;
        sampleRef.current = null;
        setLive(false);
        paintRatio(0, attachment.durationSec ?? 0);
        lastClockSecRef.current = 0;
        setClock((current) =>
          current.listened === 0 && current.duration === (attachment.durationSec ?? 0)
            ? current
            : { listened: 0, duration: attachment.durationSec ?? 0 },
        );
        return;
      }

      sampleRef.current = next;
      sampleAtRef.current = typeof performance !== 'undefined' ? performance.now() : Date.now();
      setLive(next.playing);
      if (next.playing) {
        setClock((current) =>
          current.duration === next.duration
            ? current
            : { listened: current.listened, duration: next.duration },
        );
        return;
      }
      paintRatio(next.currentTime, next.duration);
      lastClockSecRef.current = Math.floor(clampTime(next.currentTime, next.duration));
      setClock({
        listened: clampTime(next.currentTime, next.duration),
        duration: next.duration,
      });
    });
  }, [attachment.durationSec, playbackKey]);

  useEffect(() => {
    if (!live) return undefined;

    let frame = 0;
    const tick = () => {
      const sample = sampleRef.current;
      if (!sample) return;
      const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
      const elapsed = ((now - sampleAtRef.current) / 1000) * sample.rate;
      const time = clampTime(sample.currentTime + elapsed, sample.duration);
      paintRatio(time, sample.duration);
      const second = Math.floor(time);
      if (second !== lastClockSecRef.current) {
        lastClockSecRef.current = second;
        setClock({ listened: time, duration: sample.duration });
      }
      frame = requestAnimationFrame(tick);
    };

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [live]);

  // Unheard incoming = bright white. Heard / own = faded bars.
  const dimColor = heard
    ? mine
      ? 'rgba(255,255,255,0.42)'
      : `${textColor}55`
    : '#FFFFFF';
  const playedColor = heard
    ? mine
      ? 'rgba(255,255,255,0.82)'
      : `${textColor}CC`
    : 'rgba(21, 122, 254, 0.55)';

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={
        active ? 'Голосовое открыто в верхнем плеере' : 'Воспроизвести голосовое сообщение'
      }
      onPress={onPress}
      style={[styles.root, active && styles.rootActive]}>
      <View style={[styles.playButton, { backgroundColor: accentColor }]}>
        <Ionicons name={playing ? 'pause' : 'play'} size={18} color={mine ? '#208AEF' : '#FFFFFF'} />
      </View>
      <View style={styles.waveformColumn}>
        <View
          style={styles.waveform}
          onLayout={(event) => {
            const width = event.nativeEvent.layout.width;
            trackWidthRef.current = width;
            setTrackWidth(width);
            const sample = sampleRef.current;
            if (sample) {
              const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
              const elapsed = sample.playing
                ? ((now - sampleAtRef.current) / 1000) * sample.rate
                : 0;
              paintRatio(sample.currentTime + elapsed, sample.duration);
            }
          }}>
          <View style={styles.waveformRow}>
            {waveform.map((height, index) => (
              <View
                key={`dim-${index}`}
                style={[styles.wave, { height: 5 + height * 19, backgroundColor: dimColor }]}
              />
            ))}
          </View>
          <Animated.View pointerEvents="none" style={[styles.waveformOverlay, overlayStyle]}>
            <View style={[styles.waveformRow, trackWidth ? { width: trackWidth } : null]}>
              {waveform.map((height, index) => (
                <View
                  key={`play-${index}`}
                  style={[styles.wave, { height: 5 + height * 19, backgroundColor: playedColor }]}
                />
              ))}
            </View>
          </Animated.View>
        </View>
        <Text style={[styles.time, { color: textColor }]}>
          {formatTime(clock.listened)} / {formatTime(clock.duration || attachment.durationSec || 0)}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    minWidth: 225,
    maxWidth: 290,
    paddingVertical: 5,
    borderRadius: 10,
  },
  rootActive: { opacity: 0.82 },
  playButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  waveformColumn: { flex: 1, gap: 2 },
  waveform: {
    height: 28,
    position: 'relative',
    overflow: 'hidden',
  },
  waveformRow: {
    height: 28,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    gap: BAR_GAP,
  },
  waveformOverlay: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    overflow: 'hidden',
  },
  wave: {
    width: BAR_WIDTH,
    flexGrow: 0,
    flexShrink: 0,
    minHeight: 4,
    borderRadius: BAR_WIDTH,
  },
  time: { fontSize: 11, fontVariant: ['tabular-nums'] },
});
