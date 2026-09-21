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
export function clampMicGain(value) {
    if (!Number.isFinite(value)) {
        return MIC_GAIN_DEFAULT;
    }
    return Math.min(MIC_GAIN_MAX, Math.max(MIC_GAIN_MIN, value));
}
export async function loadVoiceDevicePrefs() {
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
export async function saveVoiceInputDeviceId(deviceId) {
    if (!deviceId?.trim()) {
        await AsyncStorage.removeItem(INPUT_KEY);
        return;
    }
    await AsyncStorage.setItem(INPUT_KEY, deviceId.trim());
}
export async function saveVoiceOutputDeviceId(deviceId) {
    if (!deviceId?.trim()) {
        await AsyncStorage.removeItem(OUTPUT_KEY);
        return;
    }
    await AsyncStorage.setItem(OUTPUT_KEY, deviceId.trim());
}
export async function saveVoiceVideoDeviceId(deviceId) {
    if (!deviceId?.trim()) {
        await AsyncStorage.removeItem(VIDEO_KEY);
        return;
    }
    await AsyncStorage.setItem(VIDEO_KEY, deviceId.trim());
}
export async function saveVoiceMicGain(gain) {
    await AsyncStorage.setItem(MIC_GAIN_KEY, String(clampMicGain(gain)));
}
export async function saveVoiceNoiseSuppression(enabled) {
    await AsyncStorage.setItem(NOISE_SUPPRESSION_KEY, enabled ? '1' : '0');
}
