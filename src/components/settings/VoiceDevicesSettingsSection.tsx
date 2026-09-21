import { useCallback, useEffect, useRef, useState, createElement } from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import { useFocusEffect } from 'expo-router';

import { SelectField, toast } from '@/components/ui';
import { FontSize, Radius, Spacing, type ThemeColors } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useThemedStyles } from '@/hooks/use-themed-styles';
import { localizeErrorMessage } from '@/utils/localizeError';
import {
  loadVoiceDevicePrefs,
  MIC_GAIN_DEFAULT,
  MIC_GAIN_MAX,
  MIC_GAIN_MIN,
  NOISE_SUPPRESSION_DEFAULT,
  saveVoiceInputDeviceId,
  saveVoiceMicGain,
  saveVoiceNoiseSuppression,
  saveVoiceOutputDeviceId,
  saveVoiceVideoDeviceId,
  clampMicGain,
} from '@/utils/voice-device-settings';
import {
  ensureCameraPermission,
  ensureMicrophonePermission,
  listAudioDevices,
  listVideoDevices,
  startMicrophoneTest,
  supportsAudioOutputSelection,
  type MediaDeviceOption,
  type MicTestHandle,
} from '@/utils/voice-media-devices';

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    block: {
      paddingHorizontal: Spacing.lg,
      paddingTop: Spacing.md,
      paddingBottom: Spacing.md,
      gap: Spacing.md,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.borderLight,
    },
    blockFirst: {
      borderTopWidth: 0,
    },
    fieldGap: {
      gap: Spacing.md,
    },
    meterWrap: {
      gap: 8,
    },
    meterTrack: {
      height: 10,
      borderRadius: Radius.pill,
      backgroundColor: colors.borderLight,
      overflow: 'hidden',
    },
    meterFill: {
      height: '100%',
      borderRadius: Radius.pill,
      backgroundColor: colors.primary,
    },
    meterHint: {
      fontSize: FontSize.caption,
      color: colors.textMuted,
      lineHeight: FontSize.caption * 1.4,
    },
    gainHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: Spacing.sm,
    },
    gainLabel: {
      fontSize: FontSize.caption,
      fontWeight: '600',
      color: colors.text,
    },
    gainValue: {
      fontSize: FontSize.caption,
      fontWeight: '700',
      color: colors.primary,
    },
    noiseHint: {
      fontSize: FontSize.caption,
      color: colors.textMuted,
      lineHeight: FontSize.caption * 1.4,
    },
    noiseHintAccent: {
      color: colors.primary,
      fontWeight: '600',
    },
    noiseRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: Spacing.md,
    },
    noiseRowText: {
      flex: 1,
      minWidth: 0,
      gap: 4,
    },
    noiseTitle: {
      fontSize: FontSize.caption,
      fontWeight: '600',
      color: colors.text,
    },
    hotkeysBlock: {
      gap: 8,
    },
    hotkeysTitle: {
      fontSize: FontSize.caption,
      fontWeight: '600',
      color: colors.text,
    },
    hotkeyRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      flexWrap: 'wrap',
    },
    hotkeyKey: {
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 6,
      backgroundColor: 'rgba(21, 122, 254, 0.12)',
    },
    hotkeyKeyText: {
      fontSize: FontSize.caption,
      fontWeight: '700',
      color: colors.primary,
    },
    hotkeyAction: {
      fontSize: FontSize.caption,
      color: colors.textMuted,
      flexShrink: 1,
    },
    testRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.sm,
      flexWrap: 'wrap',
    },
    testButton: {
      minHeight: 40,
      paddingHorizontal: Spacing.md,
      borderRadius: Radius.pill,
      borderWidth: 1,
      borderColor: colors.primary,
      backgroundColor: 'rgba(21, 122, 254, 0.1)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    testButtonActive: {
      borderColor: colors.destructive,
      backgroundColor: 'rgba(255, 59, 48, 0.12)',
    },
    testButtonPressed: {
      opacity: 0.85,
    },
    testButtonLabel: {
      fontSize: FontSize.caption,
      fontWeight: '700',
      color: colors.primary,
    },
    testButtonLabelActive: {
      color: colors.destructive,
    },
    unavailable: {
      paddingHorizontal: Spacing.lg,
      paddingVertical: Spacing.md,
      fontSize: FontSize.caption,
      color: colors.textMuted,
      lineHeight: FontSize.caption * 1.45,
    },
  });
}

/** Web-only mic/speaker pickers + mic level check for Settings. */
export function VoiceDevicesSettingsSection() {
  const colors = useTheme();
  const styles = useThemedStyles(createStyles);
  const [loading, setLoading] = useState(true);
  const [inputs, setInputs] = useState<MediaDeviceOption[]>([]);
  const [outputs, setOutputs] = useState<MediaDeviceOption[]>([]);
  const [cameras, setCameras] = useState<MediaDeviceOption[]>([]);
  const [inputId, setInputId] = useState<string | null>(null);
  const [outputId, setOutputId] = useState<string | null>(null);
  const [videoId, setVideoId] = useState<string | null>(null);
  const [micGain, setMicGain] = useState(MIC_GAIN_DEFAULT);
  const [noiseSuppression, setNoiseSuppression] = useState(NOISE_SUPPRESSION_DEFAULT);
  const [testing, setTesting] = useState(false);
  const [level, setLevel] = useState(0);
  const [permissionDenied, setPermissionDenied] = useState(false);
  const [noiseEngineLabel, setNoiseEngineLabel] = useState('WebRTC');
  const testRef = useRef<MicTestHandle | null>(null);
  const rafRef = useRef<number | null>(null);
  const testingRef = useRef(false);
  const startGenRef = useRef(0);
  const outputSupported = supportsAudioOutputSelection();

  const stopTest = useCallback(() => {
    startGenRef.current += 1;
    if (rafRef.current != null && typeof cancelAnimationFrame === 'function') {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    testRef.current?.stop();
    testRef.current = null;
    testingRef.current = false;
    setTesting(false);
    setLevel(0);
  }, []);

  const beginTest = useCallback(
    async (
      nextInputId: string | null,
      nextMicGain: number,
      nextOutputId: string | null,
      nextNoise: boolean,
    ) => {
      const gen = ++startGenRef.current;
      if (rafRef.current != null && typeof cancelAnimationFrame === 'function') {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      testRef.current?.stop();
      testRef.current = null;

      try {
        const handle = await startMicrophoneTest(
          nextInputId,
          nextMicGain,
          nextOutputId,
          nextNoise,
        );
        if (gen !== startGenRef.current) {
          handle.stop();
          return;
        }
        testRef.current = handle;
        testingRef.current = true;
        setTesting(true);
        const loop = () => {
          if (!testRef.current || gen !== startGenRef.current) {
            return;
          }
          setLevel(testRef.current.getLevel());
          rafRef.current = requestAnimationFrame(loop);
        };
        rafRef.current = requestAnimationFrame(loop);
      } catch (error) {
        if (gen !== startGenRef.current) {
          return;
        }
        testingRef.current = false;
        setTesting(false);
        setLevel(0);
        toast.error(localizeErrorMessage(error, 'Не удалось открыть микрофон'));
      }
    },
    [],
  );

  const refreshDevices = useCallback(async () => {
    if (Platform.OS !== 'web') {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const granted = await ensureMicrophonePermission();
      setPermissionDenied(!granted);
      await ensureCameraPermission();
      const prefs = await loadVoiceDevicePrefs();
      const [{ inputs: nextInputs, outputs: nextOutputs }, nextCameras] = await Promise.all([
        listAudioDevices(),
        listVideoDevices(),
      ]);
      setInputs(nextInputs);
      setOutputs(nextOutputs);
      setCameras(nextCameras);
      setMicGain(prefs.micGain);
      setNoiseSuppression(prefs.noiseSuppression);

      const nextInput =
        (prefs.inputDeviceId &&
          nextInputs.some((d) => d.deviceId === prefs.inputDeviceId) &&
          prefs.inputDeviceId) ||
        nextInputs[0]?.deviceId ||
        null;
      const nextOutput =
        (prefs.outputDeviceId &&
          nextOutputs.some((d) => d.deviceId === prefs.outputDeviceId) &&
          prefs.outputDeviceId) ||
        nextOutputs[0]?.deviceId ||
        null;
      const nextVideo =
        (prefs.videoDeviceId &&
          nextCameras.some((d) => d.deviceId === prefs.videoDeviceId) &&
          prefs.videoDeviceId) ||
        nextCameras[0]?.deviceId ||
        null;
      setInputId(nextInput);
      setOutputId(nextOutput);
      setVideoId(nextVideo);

      try {
        const { isKrispNoiseFilterSupported } = await import('@livekit/krisp-noise-filter');
        setNoiseEngineLabel(isKrispNoiseFilterSupported() ? 'Krisp + WebRTC' : 'WebRTC');
      } catch {
        setNoiseEngineLabel('WebRTC');
      }
    } catch {
      setInputs([]);
      setOutputs([]);
      setCameras([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshDevices();
    if (Platform.OS !== 'web' || typeof navigator === 'undefined') {
      return;
    }
    const onChange = () => {
      void refreshDevices();
    };
    navigator.mediaDevices?.addEventListener?.('devicechange', onChange);
    return () => {
      navigator.mediaDevices?.removeEventListener?.('devicechange', onChange);
      stopTest();
    };
  }, [refreshDevices, stopTest]);

  // Settings stays mounted in the stack — stop the mic test when leaving the screen.
  useFocusEffect(
    useCallback(() => {
      return () => {
        stopTest();
      };
    }, [stopTest]),
  );

  const handleInputChange = useCallback(
    async (value: string | null) => {
      setInputId(value);
      await saveVoiceInputDeviceId(value);
      if (testingRef.current) {
        await beginTest(value, micGain, outputId, noiseSuppression);
      }
    },
    [beginTest, micGain, noiseSuppression, outputId],
  );

  const handleOutputChange = useCallback(
    async (value: string | null) => {
      setOutputId(value);
      await saveVoiceOutputDeviceId(value);
      if (testingRef.current) {
        await testRef.current?.setOutputDeviceId(value);
      }
    },
    [],
  );

  const handleVideoChange = useCallback(async (value: string | null) => {
    setVideoId(value);
    await saveVoiceVideoDeviceId(value);
  }, []);

  const handleMicGainChange = useCallback(async (nextPercent: number) => {
    const next = clampMicGain(nextPercent / 100);
    setMicGain(next);
    await saveVoiceMicGain(next);
    if (testingRef.current) {
      testRef.current?.setMicGain(next);
    }
  }, []);

  const handleNoiseSuppressionChange = useCallback(
    async (next: boolean) => {
      setNoiseSuppression(next);
      await saveVoiceNoiseSuppression(next);
      if (testingRef.current) {
        await beginTest(inputId, micGain, outputId, next);
      }
    },
    [beginTest, inputId, micGain, outputId],
  );

  const handleToggleTest = useCallback(async () => {
    if (testingRef.current) {
      stopTest();
      return;
    }
    await beginTest(inputId, micGain, outputId, noiseSuppression);
  }, [beginTest, inputId, micGain, noiseSuppression, outputId, stopTest]);

  if (Platform.OS !== 'web') {
    return (
      <Text style={styles.unavailable}>
        Выбор устройств и проверка микрофона пока только в браузере. На телефоне
        камера и микрофон включаются прямо в звонке.
      </Text>
    );
  }

  if (loading) {
    return (
      <View style={[styles.block, styles.blockFirst]}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  const inputOptions = inputs.map((d) => ({ id: d.deviceId, label: d.label }));
  const outputOptions = outputs.map((d) => ({ id: d.deviceId, label: d.label }));
  const cameraOptions = cameras.map((d) => ({ id: d.deviceId, label: d.label }));
  const gainPercent = Math.round(micGain * 100);

  return (
    <View>
      <View style={[styles.block, styles.blockFirst, styles.fieldGap]}>
        <SelectField
          label="Микрофон"
          placeholder="Выберите микрофон"
          value={inputId}
          options={inputOptions}
          onChange={(value) => void handleInputChange(value)}
        />
        {outputSupported && outputOptions.length > 0 ? (
          <SelectField
            label="Динамики / наушники"
            placeholder="Выберите вывод"
            value={outputId}
            options={outputOptions}
            onChange={(value) => void handleOutputChange(value)}
          />
        ) : (
          <Text style={styles.meterHint}>
            Этот браузер не даёт выбрать устройство вывода — звук идёт в системные динамики.
          </Text>
        )}
        {cameraOptions.length > 0 ? (
          <SelectField
            label="Камера"
            placeholder="Выберите камеру"
            value={videoId}
            options={cameraOptions}
            onChange={(value) => void handleVideoChange(value)}
          />
        ) : (
          <Text style={styles.meterHint}>
            Камера не найдена. В звонке кнопка видео попросит доступ, если браузер ещё не спрашивал.
          </Text>
        )}

        <View style={styles.meterWrap}>
          <View style={styles.gainHeader}>
            <Text style={styles.gainLabel}>Громкость микрофона</Text>
            <Text style={styles.gainValue}>{gainPercent}%</Text>
          </View>
          {Platform.OS === 'web'
            ? createElement('input', {
                type: 'range',
                min: MIC_GAIN_MIN * 100,
                max: MIC_GAIN_MAX * 100,
                step: 5,
                value: gainPercent,
                onChange: (event: { target: { value: string } }) => {
                  void handleMicGainChange(Number(event.target.value));
                },
                style: {
                  width: '100%',
                  height: 28,
                  accentColor: colors.primary,
                },
                'aria-label': 'Громкость микрофона',
              })
            : null}
        </View>

        <View style={styles.noiseRow}>
          <View style={styles.noiseRowText}>
            <Text style={styles.noiseTitle}>Шумоподавление</Text>
            <Text style={styles.noiseHint}>
              {noiseSuppression ? (
                <>
                  В звонках:{' '}
                  <Text style={styles.noiseHintAccent}>{noiseEngineLabel}</Text>
                </>
              ) : (
                'Выключено — сырой микрофон'
              )}
            </Text>
          </View>
          <Switch
            value={noiseSuppression}
            onValueChange={(next) => void handleNoiseSuppressionChange(next)}
            trackColor={{ false: colors.border, true: colors.primary }}
            thumbColor="#FFFFFF"
            // @ts-expect-error RN-web: on-state uses activeThumbColor (defaults to Material teal)
            activeThumbColor="#FFFFFF"
            ios_backgroundColor={colors.border}
            accessibilityLabel="Шумоподавление"
          />
        </View>

        <View style={styles.hotkeysBlock}>
          <Text style={styles.hotkeysTitle}>Горячие клавиши в звонке</Text>
          {(
            [
              ['Ctrl+Shift+M', 'микрофон'],
              ['Ctrl+Shift+V', 'камера'],
              ['Ctrl+Shift+D', 'звук'],
              ['Esc', 'свернуть'],
            ] as const
          ).map(([keys, action]) => (
            <View key={keys} style={styles.hotkeyRow}>
              <View style={styles.hotkeyKey}>
                <Text style={styles.hotkeyKeyText}>{keys}</Text>
              </View>
              <Text style={styles.hotkeyAction}>{action}</Text>
            </View>
          ))}
        </View>

        {permissionDenied ? (
          <Text style={styles.meterHint}>
            Нет доступа к микрофону. Разрешите его в настройках браузера для этого сайта.
          </Text>
        ) : null}
      </View>

      <View style={styles.block}>
        <View style={styles.meterWrap}>
          <Text style={styles.meterHint}>
            {testing
              ? 'Говорите — себя слышно тихо. Если звук грязный, наденьте наушники: динамики ловят микрофон.'
              : 'Проверка микрофона'}
          </Text>
          <View style={styles.meterTrack}>
            <View style={[styles.meterFill, { width: `${Math.round(level * 100)}%` }]} />
          </View>
          <View style={styles.testRow}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={testing ? 'Остановить проверку' : 'Проверить микрофон'}
              onPress={() => void handleToggleTest()}
              style={({ pressed }) => [
                styles.testButton,
                testing && styles.testButtonActive,
                pressed && styles.testButtonPressed,
              ]}>
              <Text
                style={[styles.testButtonLabel, testing && styles.testButtonLabelActive]}>
                {testing ? 'Стоп' : 'Проверить микрофон'}
              </Text>
            </Pressable>
          </View>
        </View>
      </View>
    </View>
  );
}
