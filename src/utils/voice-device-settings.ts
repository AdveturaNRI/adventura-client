import AsyncStorage from '@react-native-async-storage/async-storage';

const INPUT_KEY = '@adventura/voice-input-device-id';
const OUTPUT_KEY = '@adventura/voice-output-device-id';
const VIDEO_KEY = '@adventura/voice-video-device-id';
const MIC_GAIN_KEY = '@adventura/voice-mic-gain';
const NOISE_SUPPRESSION_KEY = '@adventura/voice-noise-suppression';

/** Linear gain: 0 = mute, 1 = 100%, 2 = 200%. */
export const MIC_GAIN_MIN = 0;
export const MIC_GAIN_MAX = 2;
export const MIC_GAIN_DEFAULT = 1;
export const NOISE_SUPPRESSION_DEFAULT = true;

export type VoiceDevicePrefs = {
  inputDeviceId: string | null;
  outputDeviceId: string | null;
  videoDeviceId: string | null;
  micGain: number;
  noiseSuppression: boolean;
};

type VoiceDevicePrefsListener = (prefs: VoiceDevicePrefs) => void;

const prefsListeners = new Set<VoiceDevicePrefsListener>();

/** Live call / composer can hot-apply Settings changes without polling storage. */
export function subscribeVoiceDevicePrefs(listener: VoiceDevicePrefsListener): () => void {
  prefsListeners.add(listener);
  return () => {
    prefsListeners.delete(listener);
  };
}

async function notifyVoiceDevicePrefsChanged(): Promise<void> {
  if (prefsListeners.size === 0) {
    return;
  }
  const prefs = await loadVoiceDevicePrefs();
  prefsListeners.forEach((listener) => {
    try {
      listener(prefs);
    } catch {
      // listener errors must not break Settings saves
    }
  });
}

export function clampMicGain(value: number): number {
  if (!Number.isFinite(value)) {
    return MIC_GAIN_DEFAULT;
  }
  return Math.min(MIC_GAIN_MAX, Math.max(MIC_GAIN_MIN, value));
}

export async function loadVoiceDevicePrefs(): Promise<VoiceDevicePrefs> {
  const [inputDeviceId, outputDeviceId, videoDeviceId, micGainRaw, noiseRaw] = await Promise.all([
    AsyncStorage.getItem(INPUT_KEY),
    AsyncStorage.getItem(OUTPUT_KEY),
    AsyncStorage.getItem(VIDEO_KEY),
    AsyncStorage.getItem(MIC_GAIN_KEY),
    AsyncStorage.getItem(NOISE_SUPPRESSION_KEY),
  ]);
  const parsedGain = micGainRaw != null ? Number(micGainRaw) : MIC_GAIN_DEFAULT;
  return {
    inputDeviceId: inputDeviceId?.trim() || null,
    outputDeviceId: outputDeviceId?.trim() || null,
    videoDeviceId: videoDeviceId?.trim() || null,
    micGain: clampMicGain(parsedGain),
    noiseSuppression: noiseRaw == null ? NOISE_SUPPRESSION_DEFAULT : noiseRaw !== '0',
  };
}

export async function saveVoiceInputDeviceId(deviceId: string | null): Promise<void> {
  if (!deviceId?.trim()) {
    await AsyncStorage.removeItem(INPUT_KEY);
  } else {
    await AsyncStorage.setItem(INPUT_KEY, deviceId.trim());
  }
  await notifyVoiceDevicePrefsChanged();
}

export async function saveVoiceOutputDeviceId(deviceId: string | null): Promise<void> {
  if (!deviceId?.trim()) {
    await AsyncStorage.removeItem(OUTPUT_KEY);
  } else {
    await AsyncStorage.setItem(OUTPUT_KEY, deviceId.trim());
  }
  await notifyVoiceDevicePrefsChanged();
}

export async function saveVoiceVideoDeviceId(deviceId: string | null): Promise<void> {
  if (!deviceId?.trim()) {
    await AsyncStorage.removeItem(VIDEO_KEY);
  } else {
    await AsyncStorage.setItem(VIDEO_KEY, deviceId.trim());
  }
  await notifyVoiceDevicePrefsChanged();
}

export async function saveVoiceMicGain(gain: number): Promise<void> {
  await AsyncStorage.setItem(MIC_GAIN_KEY, String(clampMicGain(gain)));
  await notifyVoiceDevicePrefsChanged();
}

export async function saveVoiceNoiseSuppression(enabled: boolean): Promise<void> {
  await AsyncStorage.setItem(NOISE_SUPPRESSION_KEY, enabled ? '1' : '0');
  await notifyVoiceDevicePrefsChanged();
}
