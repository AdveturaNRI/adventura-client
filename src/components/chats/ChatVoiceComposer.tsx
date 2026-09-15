import { Ionicons } from '@expo/vector-icons';
import {
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioPlayer,
  useAudioPlayerStatus,
  useAudioRecorder,
} from 'expo-audio';
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  ActivityIndicator,
  Animated,
  Easing,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Gesture, GestureDetector, MouseButton } from 'react-native-gesture-handler';
import { runOnJS } from 'react-native-reanimated';

import { toast } from '@/components/ui';
import { FontSize, Spacing, type ThemeColors } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { localizeErrorMessage } from '@/utils/localizeError';
import { sendChatMessage, type ChatMessage } from '@/services/chats/chatsApi';
import { peaksFromUris, prepareVoiceUpload } from '@/utils/voice-audio-edit';

type Phase = 'idle' | 'holding' | 'locked' | 'paused';
type Segment = { uri: string; durationSec: number };

const MIN_VOICE_SEC = 1;
// The lock is immediately above the microphone; crossing its centre fixes
// the recording, so the gesture matches the visual target.
const LOCK_SWIPE_Y = -78;
const MIN_CANCEL_SWIPE_DISTANCE = 72;
// The visible bin is 40px, but its cancellation area is deliberately twice
// as wide so a held recording is discarded as soon as it reaches the bin.
const CANCEL_SWIPE_HIT_DIAMETER = 160;
const WAVE_BARS = 72;
const EDITOR_WAVE_BAR_PITCH = 5;
const VOICE_CONTROL_COLOR = '#1F4E8C';

type Props = {
  conversationId: string;
  disabled?: boolean;
  replyToId?: string;
  /** Keep the composer input mounted; only the trailing mic/send control swaps. */
  showMic?: boolean;
  trailing?: ReactNode;
  idleChildren: ReactNode;
  onSent: (message: ChatMessage) => void;
};

function formatClock(ms: number) {
  const elapsed = Math.max(0, ms);
  const tenths = Math.floor(elapsed / 100) % 10;
  const totalSeconds = Math.floor(elapsed / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}.${tenths}`;
}

function formatPreview(ms: number) {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(totalSeconds / 60)}:${String(totalSeconds % 60).padStart(2, '0')}`;
}

/** Scale the original signal into the number of bars the available track can
 * show. Keeping the bars narrow is much more legible than stretching a small
 * fixed set into wide rectangles on desktop. */
function resampleWaveform(values: number[], count: number) {
  if (values.length === count) return values;
  return Array.from({ length: count }, (_, index) => {
    const start = Math.floor((index * values.length) / count);
    const end = Math.max(start + 1, Math.floor(((index + 1) * values.length) / count));
    let peak = 0;
    for (let cursor = start; cursor < end; cursor += 1) {
      peak = Math.max(peak, values[cursor] ?? 0);
    }
    return peak;
  });
}

export function ChatVoiceComposer({ conversationId, disabled, replyToId, showMic = true, trailing, idleChildren, onSent }: Props) {
  const colors = useTheme();
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const [phase, setPhase] = useState<Phase>('idle');
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [now, setNow] = useState(0);
  const [recordedMs, setRecordedMs] = useState(0);
  const [sending, setSending] = useState(false);
  const [segments, setSegments] = useState<Segment[]>([]);
  const [peaks, setPeaks] = useState<number[]>([]);
  const [trimStart, setTrimStart] = useState(0);
  const [trimEnd, setTrimEnd] = useState(1);
  const [previewUri, setPreviewUri] = useState<string | null>(null);
  const [cancelSwipeProgress, setCancelSwipeProgress] = useState(0);
  const phaseRef = useRef<Phase>('idle');
  const pressingRef = useRef(false);
  const startedAtRef = useRef<number | null>(null);
  const recordedMsRef = useRef(0);
  const segmentsRef = useRef<Segment[]>([]);
  const trimStartRef = useRef(0);
  const trimEndRef = useRef(1);
  const busyRef = useRef(false);
  const cancelTriggeredRef = useRef(false);
  const cancelSwipeDistanceRef = useRef(MIN_CANCEL_SWIPE_DISTANCE);
  const lockGuideOffset = useRef(new Animated.Value(0)).current;

  phaseRef.current = phase;
  startedAtRef.current = startedAt;
  recordedMsRef.current = recordedMs;
  segmentsRef.current = segments;
  trimStartRef.current = trimStart;
  trimEndRef.current = trimEnd;

  const elapsedMs =
    startedAt != null ? recordedMs + (now - startedAt) : recordedMs;
  const previewUris = segments.map((item) => item.uri);
  const previewDurationMs = Math.round(
    segments.reduce((sum, item) => sum + item.durationSec, 0) * 1000,
  );

  useEffect(() => {
    if (startedAt == null) return undefined;
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 50);
    return () => clearInterval(id);
  }, [startedAt]);

  useEffect(() => {
    if (phase !== 'holding') {
      lockGuideOffset.stopAnimation();
      lockGuideOffset.setValue(0);
      return undefined;
    }

    const guideLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(lockGuideOffset, {
          toValue: -9,
          duration: 680,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(lockGuideOffset, {
          toValue: 0,
          duration: 680,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
    );
    guideLoop.start();
    return () => {
      guideLoop.stop();
    };
  }, [lockGuideOffset, phase]);

  const reset = useCallback(() => {
    pressingRef.current = false;
    startedAtRef.current = null;
    recordedMsRef.current = 0;
    segmentsRef.current = [];
    trimStartRef.current = 0;
    trimEndRef.current = 1;
    setPhase('idle');
    setStartedAt(null);
    setRecordedMs(0);
    setSegments([]);
    setPeaks([]);
    setPreviewUri(null);
    setCancelSwipeProgress(0);
    cancelTriggeredRef.current = false;
    setTrimStart(0);
    setTrimEnd(1);
  }, []);

  const stopCurrent = useCallback(async (): Promise<Segment | null> => {
    const began = startedAtRef.current;
    if (recorder.isRecording) {
      await recorder.stop();
    }
    const uri = recorder.uri;
    const elapsedSec = began ? (Date.now() - began) / 1000 : 0;
    const recordedSec = Number(recorder.currentTime) || 0;
    const durationSec = Math.max(recordedSec, elapsedSec);
    startedAtRef.current = null;
    setStartedAt(null);
    if (!uri || durationSec < 0.05) {
      return null;
    }
    return { uri, durationSec };
  }, [recorder]);

  const startRecording = useCallback(async (resuming = false) => {
    if (disabled || sending || (busyRef.current && !resuming)) return;
    try {
      const permission = await requestRecordingPermissionsAsync();
      if (!pressingRef.current && phaseRef.current !== 'locked') return;
      if (!permission.granted) {
        toast.error('Нет доступа к микрофону. Разрешите его в настройках браузера или приложения.');
        reset();
        return;
      }
      await setAudioModeAsync({ playsInSilentMode: true, allowsRecording: true });
      if (!pressingRef.current && phaseRef.current !== 'locked') return;
      await recorder.prepareToRecordAsync();
      if (!pressingRef.current && phaseRef.current !== 'locked') return;
      const at = Date.now();
      startedAtRef.current = at;
      setStartedAt(at);
      setNow(at);
      recorder.record({ forDuration: 900 });
      if (!pressingRef.current && phaseRef.current !== 'locked' && recorder.isRecording) {
        await recorder.stop();
        reset();
      }
    } catch {
      reset();
      toast.error('Не удалось начать запись. Проверьте доступность микрофона.');
    }
  }, [disabled, recorder, reset, sending]);

  const discard = useCallback(async () => {
    busyRef.current = true;
    try {
      if (recorder.isRecording) {
        await recorder.stop();
      }
    } finally {
      busyRef.current = false;
      reset();
    }
  }, [recorder, reset]);

  const captureSegmentAndPause = useCallback(async () => {
    if (busyRef.current) return;
    busyRef.current = true;
    try {
      const segment = await stopCurrent();
      const next = segment ? [...segmentsRef.current, segment] : segmentsRef.current;
      if (!next.length) {
        reset();
        return;
      }
      recordedMsRef.current = next.reduce((sum, item) => sum + item.durationSec, 0) * 1000;
      segmentsRef.current = next;
      setSegments(next);
      setRecordedMs(recordedMsRef.current);
      setTrimStart(0);
      setTrimEnd(1);
      trimStartRef.current = 0;
      trimEndRef.current = 1;
      setPhase('paused');
      try {
        const uris = next.map((item) => item.uri);
        if (uris.length > 1) {
          const joined = await prepareVoiceUpload(uris, 0, 1);
          setPreviewUri(joined.uri);
        } else {
          setPreviewUri(uris[0] ?? null);
        }
        setPeaks(await peaksFromUris(uris, 256));
      } catch {
        setPreviewUri(next[0]?.uri ?? null);
        setPeaks([]);
      }
    } finally {
      busyRef.current = false;
    }
  }, [reset, stopCurrent]);

  const lockRecording = useCallback(() => {
    if (phaseRef.current !== 'holding') return;
    phaseRef.current = 'locked';
    setPhase('locked');
  }, []);

  const resumeRecording = useCallback(async () => {
    if (phaseRef.current !== 'paused' || busyRef.current) return;
    busyRef.current = true;
    try {
      if (trimStartRef.current > 0.001 || trimEndRef.current < 0.999) {
        const baked = await prepareVoiceUpload(
          segmentsRef.current.map((item) => item.uri),
          trimStartRef.current,
          trimEndRef.current,
        );
        const next = [{ uri: baked.uri, durationSec: baked.durationSec }];
        segmentsRef.current = next;
        recordedMsRef.current = baked.durationSec * 1000;
        setSegments(next);
        setRecordedMs(recordedMsRef.current);
        setTrimStart(0);
        setTrimEnd(1);
      }
      phaseRef.current = 'locked';
      setPhase('locked');
      pressingRef.current = true;
      await startRecording(true);
    } catch (error) {
      toast.error(localizeErrorMessage(error, 'Не удалось продолжить запись'));
    } finally {
      pressingRef.current = false;
      busyRef.current = false;
    }
  }, [startRecording]);

  const sendVoice = useCallback(async () => {
    if (busyRef.current || sending) return;
    busyRef.current = true;
    try {
      const live = await stopCurrent();
      const all = live ? [...segmentsRef.current, live] : segmentsRef.current;
      const durationSec = all.reduce((sum, item) => sum + item.durationSec, 0);
      if (!all.length || durationSec < MIN_VOICE_SEC) {
        reset();
        return;
      }
      setSending(true);
      const start = all.length === 1 && trimStartRef.current === 0 && trimEndRef.current === 1
        ? null
        : await prepareVoiceUpload(
            all.map((item) => item.uri),
            trimStartRef.current,
            trimEndRef.current,
          );
      const file = start ?? {
        uri: all[0].uri,
        durationSec,
        mimeType: Platform.OS === 'web' ? 'audio/webm' : 'audio/mp4',
      };
      let voiceWaveform: number[] | undefined;
      try {
        // Persist real audio peaks with the message. The server returns them
        // to every participant, so each bubble reflects speech rather than a
        // decorative, repeated fallback pattern.
        voiceWaveform = (await peaksFromUris([file.uri], 256)).map(
          (peak) => Math.round(peak * 100) / 100,
        );
      } catch {
        // Native platforms may not expose Web Audio decoding. The message is
        // still sent; its UI falls back to a neutral waveform.
      }
      const message = await sendChatMessage(conversationId, {
        replyToId,
        files: [{
          uri: file.uri,
          name: `voice-${Date.now()}.${file.mimeType.includes('wav') ? 'wav' : Platform.OS === 'web' ? 'webm' : 'm4a'}`,
          mimeType: file.mimeType,
        }],
        voiceDurationSec: Math.max(1, Math.round(file.durationSec)),
        voiceWaveform,
      });
      reset();
      onSent(message);
    } catch (error) {
      toast.error(localizeErrorMessage(error, 'Не удалось отправить голосовое сообщение'));
    } finally {
      setSending(false);
      busyRef.current = false;
    }
  }, [conversationId, onSent, replyToId, reset, sending, stopCurrent]);

  const releaseHold = useCallback(() => {
    if (cancelTriggeredRef.current) return;
    if (phaseRef.current === 'locked' || phaseRef.current === 'paused') return;
    void sendVoice();
  }, [sendVoice]);

  const cancelBySwipe = useCallback(() => {
    if (cancelTriggeredRef.current || phaseRef.current !== 'holding') return;
    cancelTriggeredRef.current = true;
    setCancelSwipeProgress(1);
    // Keep the completed red state visible long enough for the cancellation
    // to feel intentional before removing the in-progress recording.
    setTimeout(() => {
      void discard();
    }, 180);
  }, [discard]);

  const updateHoldGesture = useCallback((translationX: number, translationY: number) => {
    if (phaseRef.current !== 'holding' || cancelTriggeredRef.current) return;
    const distance = cancelSwipeDistanceRef.current;
    const progress = Math.max(0, Math.min(1, -translationX / distance));
    setCancelSwipeProgress(progress);
    if (-translationX >= distance) {
      cancelBySwipe();
    } else if (translationY <= LOCK_SWIPE_Y) {
      lockRecording();
    }
  }, [cancelBySwipe, lockRecording]);

  const beginHold = useCallback(() => {
    if (!showMic || disabled || sending || phaseRef.current !== 'idle') return;
    pressingRef.current = true;
    phaseRef.current = 'holding';
    setPhase('holding');
    void startRecording();
  }, [disabled, sending, showMic, startRecording]);

  const endHold = useCallback(() => {
    pressingRef.current = false;
    releaseHold();
  }, [releaseHold]);

  const micGesture = useMemo(
    () =>
      Gesture.Pan()
        .minDistance(0)
        .maxPointers(1)
        .mouseButton(MouseButton.LEFT)
        .onBegin(() => {
          runOnJS(beginHold)();
        })
        .onUpdate((event) => {
          runOnJS(updateHoldGesture)(event.translationX, event.translationY);
        })
        .onFinalize(() => {
          runOnJS(endHold)();
        }),
    [beginHold, endHold, updateHoldGesture],
  );

  useEffect(() => {
    return () => {
      if (recorder.isRecording) {
        void recorder.stop();
      }
    };
  }, [recorder]);

  const showIdle = phase === 'idle';
  const recording = phase === 'holding' || phase === 'locked';

  return (
    <View
      style={styles.wrap}
      onLayout={(event) => {
        // Centre of mic (right) → outer edge of the enlarged trash hit area.
        // This cancels on entering the bin, rather than only at its centre.
        cancelSwipeDistanceRef.current = Math.max(
          MIN_CANCEL_SWIPE_DISTANCE,
          event.nativeEvent.layout.width - CANCEL_SWIPE_HIT_DIAMETER,
        );
      }}>
      {showIdle ? <View style={styles.idleSlot}>{idleChildren}</View> : null}

      {recording ? (
        <View style={[styles.recordingRow, phase === 'holding' ? styles.recordingRowWithTrash : null]}>
          <View style={styles.recordingDot} />
          <Text style={[styles.timer, { color: colors.text }]}>{formatClock(elapsedMs)}</Text>
          {phase === 'locked' ? (
            <Pressable accessibilityRole="button" accessibilityLabel="Отменить запись" onPress={() => void discard()} hitSlop={8} style={styles.cancelButton}>
              <Text style={[styles.cancel, { color: colors.textSecondary }]}>Отмена</Text>
            </Pressable>
          ) : (
            <View style={styles.cancelSpacer} />
          )}
        </View>
      ) : null}

      {phase === 'paused' ? (
        <PausedVoiceBar
          colors={colors}
          peaks={peaks}
          durationMs={previewDurationMs}
          uris={previewUri ? [previewUri] : previewUris}
          trimStart={trimStart}
          trimEnd={trimEnd}
          onTrimStart={setTrimStart}
          onTrimEnd={setTrimEnd}
          onTrash={() => void discard()}
        />
      ) : null}

      {showIdle && !showMic ? trailing : null}

      {(showIdle && showMic) || phase === 'holding' ? (
        <GestureDetector gesture={micGesture}>
          <View
            accessibilityRole="button"
            accessibilityLabel="Удерживайте, чтобы записать голосовое"
            style={[
              styles.roundButton,
              {
                backgroundColor: colors.primary,
              },
              Platform.OS === 'web' ? ({ userSelect: 'none', cursor: 'pointer' } as object) : null,
              phase === 'holding' ? { zIndex: 2 } : null,
            ]}>
            <Ionicons
              name={phase === 'holding' ? 'mic' : 'mic-outline'}
              size={21}
              color={colors.onPrimary}
            />
          </View>
        </GestureDetector>
      ) : null}

      {phase === 'holding' ? (
        <>
          <View
            pointerEvents="none"
            style={[
              styles.cancelSwipeFill,
              {
                opacity: cancelSwipeProgress,
                backgroundColor: `rgba(229, 72, 77, ${0.18 + cancelSwipeProgress * 0.72})`,
              },
            ]}
          />
          <View
            pointerEvents="none"
            style={[
              styles.cancelSwipeTarget,
              {
                backgroundColor:
                  cancelSwipeProgress > 0.35 ? colors.destructive : VOICE_CONTROL_COLOR,
                borderWidth: cancelSwipeProgress > 0.35 ? 0 : 1,
                borderColor: VOICE_CONTROL_COLOR,
              },
            ]}>
            <Ionicons
              name="trash-outline"
              size={22}
              color={colors.onPrimary}
            />
          </View>
          <View
            pointerEvents="none"
            style={[
              styles.lockControlRail,
              {
                backgroundColor: VOICE_CONTROL_COLOR,
                borderColor: VOICE_CONTROL_COLOR,
              },
            ]}
          />
          <Animated.View
            pointerEvents="none"
            style={[
              styles.lockHint,
              { transform: [{ translateY: Animated.multiply(lockGuideOffset, -0.78) }] },
            ]}>
            <Ionicons name="lock-open-outline" size={25} color="#FFFFFF" />
          </Animated.View>
          <Animated.View
            pointerEvents="none"
            style={[
              styles.swipeHint,
              { transform: [{ translateY: Animated.multiply(lockGuideOffset, -0.4) }] },
            ]}>
            <Ionicons name="chevron-up" size={24} color="#FFFFFF" />
          </Animated.View>
        </>
      ) : null}

      {(phase === 'locked' || phase === 'paused') ? (
        <>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={phase === 'paused' ? 'Продолжить запись' : 'Пауза'}
            onPress={() => {
              if (phase === 'paused') void resumeRecording();
              else void captureSegmentAndPause();
            }}
            style={[
              styles.floatControl,
              {
                backgroundColor: VOICE_CONTROL_COLOR,
                borderColor: VOICE_CONTROL_COLOR,
              },
            ]}>
            <Ionicons
              name={phase === 'paused' ? 'mic-outline' : 'pause'}
              size={20}
              color="#FFFFFF"
            />
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Отправить голосовое"
            disabled={sending}
            onPress={() => void sendVoice()}
            style={[styles.roundButton, { backgroundColor: colors.primary }]}>
            {sending ? (
              <ActivityIndicator size="small" color={colors.onPrimary} />
            ) : (
              <Ionicons name="send" size={18} color={colors.onPrimary} />
            )}
          </Pressable>
        </>
      ) : null}
    </View>
  );
}

function PausedVoiceBar({
  colors,
  peaks,
  durationMs,
  uris,
  trimStart,
  trimEnd,
  onTrimStart,
  onTrimEnd,
  onTrash,
}: {
  colors: ThemeColors;
  peaks: number[];
  durationMs: number;
  uris: string[];
  trimStart: number;
  trimEnd: number;
  onTrimStart: (value: number) => void;
  onTrimEnd: (value: number) => void;
  onTrash: () => void;
}) {
  const player = useAudioPlayer(uris[0] ?? undefined, { updateInterval: 80 });
  const status = useAudioPlayerStatus(player);
  const widthRef = useRef(1);
  const [width, setWidth] = useState(1);
  const sourceBars = peaks.length
    ? peaks
    : Array.from(
        { length: WAVE_BARS },
        (_, index) => 0.16 + (((index * 37) % 29) / 29) * 0.56,
      );
  // On a wide desktop composer, add more narrow samples instead of turning
  // a fixed 72 samples into wide square blocks. The same formula also keeps
  // the control compact on a phone.
  const bars = useMemo(
    () => resampleWaveform(sourceBars, Math.max(32, Math.round(width / EDITOR_WAVE_BAR_PITCH))),
    [sourceBars, width],
  );
  const durationSec = Math.max(0.2, durationMs / 1000);
  const startSec = trimStart * durationSec;
  const endSec = trimEnd * durationSec;
  const selectedWidth = (trimEnd - trimStart) * width;
  const previewWidth = Math.min(68, Math.max(42, selectedWidth - 8));
  const previewLeft = ((trimStart + trimEnd) * width) / 2 - previewWidth / 2;

  useEffect(() => {
    if (!status.playing) return undefined;
    if (status.currentTime >= endSec) {
      player.pause();
      player.seekTo(startSec);
    }
  }, [endSec, player, startSec, status.currentTime, status.playing]);

  const startRatioRef = useRef(trimStart);
  const endRatioRef = useRef(trimEnd);
  startRatioRef.current = trimStart;
  endRatioRef.current = trimEnd;
  const dragOriginRef = useRef(0);

  const moveStart = useCallback((translationX: number) => {
    const next = Math.min(endRatioRef.current - 0.05, Math.max(0, dragOriginRef.current + translationX / widthRef.current));
    onTrimStart(next);
  }, [onTrimStart]);
  const moveEnd = useCallback((translationX: number) => {
    const next = Math.max(startRatioRef.current + 0.05, Math.min(1, dragOriginRef.current + translationX / widthRef.current));
    onTrimEnd(next);
  }, [onTrimEnd]);

  const captureLeftOrigin = useCallback(() => {
    dragOriginRef.current = startRatioRef.current;
  }, []);
  const captureRightOrigin = useCallback(() => {
    dragOriginRef.current = endRatioRef.current;
  }, []);

  const leftGesture = useMemo(
    () =>
      Gesture.Pan()
        .mouseButton(MouseButton.LEFT)
        .onBegin(() => {
          runOnJS(captureLeftOrigin)();
        })
        .onUpdate((event) => {
          runOnJS(moveStart)(event.translationX);
        }),
    [captureLeftOrigin, moveStart],
  );
  const rightGesture = useMemo(
    () =>
      Gesture.Pan()
        .mouseButton(MouseButton.LEFT)
        .onBegin(() => {
          runOnJS(captureRightOrigin)();
        })
        .onUpdate((event) => {
          runOnJS(moveEnd)(event.translationX);
        }),
    [captureRightOrigin, moveEnd],
  );

  return (
    <View style={styles.pausedRow}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Удалить запись"
        onPress={onTrash}
        style={[styles.iconPlain, { backgroundColor: VOICE_CONTROL_COLOR }]}>
        <Ionicons name="trash-outline" size={20} color="#FFFFFF" />
      </Pressable>
      <View
        style={[styles.waveTrack, { backgroundColor: colors.primary }]}
        onLayout={(event) => {
          const next = event.nativeEvent.layout.width;
          widthRef.current = next;
          setWidth(next);
        }}>
        <View style={styles.waveRow}>
          {bars.map((value, index) => {
            const ratio = (index + 0.5) / bars.length;
            const kept = ratio >= trimStart && ratio <= trimEnd;
            return (
              <View
                key={index}
                style={[
                  styles.waveBar,
                  {
                    height: 10 + value * 34,
                    backgroundColor: kept ? 'rgba(255,255,255,0.92)' : 'rgba(255,255,255,0.28)',
                  },
                ]}
              />
            );
          })}
        </View>
        <View
          pointerEvents="none"
          style={[styles.trimmedAway, { left: 0, width: trimStart * width }]}
        />
        <View
          pointerEvents="none"
          style={[
            styles.trimmedAway,
            styles.trimmedAwayRight,
            { left: trimEnd * width, right: 0 },
          ]}
        />
        <GestureDetector gesture={leftGesture}>
          <View style={[styles.trimHitArea, { left: Math.max(-12, trimStart * width - 18) }]}>
            <View style={styles.trimHandle} />
          </View>
        </GestureDetector>
        <GestureDetector gesture={rightGesture}>
          <View style={[styles.trimHitArea, { left: Math.min(width - 24, trimEnd * width - 18) }]}>
            <View style={styles.trimHandle} />
          </View>
        </GestureDetector>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={status.playing ? 'Пауза' : 'Прослушать'}
          onPress={() => {
            if (status.playing) {
              player.pause();
              return;
            }
            player.seekTo(startSec);
            player.play();
          }}
          style={[
            styles.previewPlay,
            {
              width: previewWidth,
              left: previewLeft,
              backgroundColor: VOICE_CONTROL_COLOR,
            },
          ]}>
          <Ionicons name={status.playing ? 'pause' : 'play'} size={12} color="#FFFFFF" />
          <Text style={styles.previewTime}>
            {formatPreview((trimEnd - trimStart) * durationMs)}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    position: 'relative',
    overflow: 'visible',
  },
  idleSlot: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  recordingRow: {
    flex: 1,
    minWidth: 0,
    position: 'relative',
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.sm,
  },
  // While a held recording exposes the delete target at the left edge, reserve
  // its entire touch area before the timer. Otherwise the target sits over the
  // red dot and first digits of the stopwatch.
  recordingRowWithTrash: {
    paddingLeft: 52,
  },
  recordingDot: { width: 9, height: 9, borderRadius: 5, backgroundColor: '#E5484D' },
  timer: {
    flexShrink: 0,
    fontSize: FontSize.label,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  cancel: {
    textAlign: 'center',
    fontSize: FontSize.label,
    fontWeight: '600',
  },
  cancelButton: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 2,
  },
  cancelSpacer: { flex: 1 },
  pausedRow: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  iconPlain: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  waveTrack: {
    flex: 1,
    minWidth: 0,
    height: 56,
    borderRadius: 14,
    overflow: 'visible',
    justifyContent: 'center',
  },
  waveRow: {
    ...StyleSheet.absoluteFillObject,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 22,
    gap: 2,
  },
  // Every bar shares the available track width.  Do not cap its width: that
  // left a large empty area in a wide composer while editing a short record.
  waveBar: { flexGrow: 1, flexBasis: 0, minWidth: 1, borderRadius: 2 },
  trimmedAway: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    backgroundColor: 'rgba(15, 23, 42, 0.42)',
    borderColor: 'rgba(255,255,255,0.48)',
    borderRightWidth: 1,
    zIndex: 3,
  },
  trimmedAwayRight: {
    borderRightWidth: 0,
    borderLeftWidth: 1,
  },
  trimHitArea: {
    position: 'absolute',
    top: -10,
    bottom: -10,
    width: 36,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 8,
  },
  trimHandle: {
    width: 8,
    height: 48,
    borderRadius: 4,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: 'rgba(15, 23, 42, 0.25)',
  },
  previewPlay: {
    position: 'absolute',
    top: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#1F4E8C',
    zIndex: 6,
  },
  previewTime: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  roundButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  idleMic: { backgroundColor: VOICE_CONTROL_COLOR },
  micHot: { backgroundColor: VOICE_CONTROL_COLOR },
  sendHot: { backgroundColor: '#157AFE' },
  lockHint: {
    position: 'absolute',
    right: 10,
    // The lock/arrow live in their own pill above the mic.  Keep a gap below
    // it: the recording button must never visually merge with the hint.
    top: -108,
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
    zIndex: 3,
  },
  swipeHint: {
    position: 'absolute',
    right: 10,
    top: -66,
    width: 38,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
    zIndex: 3,
  },
  lockControlRail: {
    position: 'absolute',
    right: 7,
    // Ends 28px above the 40px microphone, leaving a clear visual gap.
    top: -114,
    width: 44,
    height: 86,
    borderRadius: 22,
    backgroundColor: VOICE_CONTROL_COLOR,
    zIndex: 1,
  },
  cancelSwipeFill: {
    position: 'absolute',
    left: 0,
    right: 48,
    top: 1,
    bottom: 1,
    borderRadius: 24,
    zIndex: 4,
  },
  cancelSwipeTarget: {
    position: 'absolute',
    left: 1,
    top: 1,
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 5,
  },
  floatControl: {
    position: 'absolute',
    right: -1,
    top: -88,
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 18,
    backgroundColor: VOICE_CONTROL_COLOR,
    zIndex: 20,
    elevation: 20,
  },
});
