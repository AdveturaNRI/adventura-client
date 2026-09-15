import AsyncStorage from '@react-native-async-storage/async-storage';

export const VOICE_PLAYBACK_SPEEDS = [1, 1.5, 2] as const;
export type VoicePlaybackSpeed = (typeof VOICE_PLAYBACK_SPEEDS)[number];

const VOICE_PLAYBACK_SPEED_KEY = '@adventura/voice-playback-speed';

function isVoicePlaybackSpeed(value: string | null): value is '1' | '1.5' | '2' {
  return value === '1' || value === '1.5' || value === '2';
}

export async function loadVoicePlaybackSpeed(): Promise<VoicePlaybackSpeed> {
  const value = await AsyncStorage.getItem(VOICE_PLAYBACK_SPEED_KEY);
  return isVoicePlaybackSpeed(value) ? Number(value) as VoicePlaybackSpeed : 1;
}

export async function saveVoicePlaybackSpeed(speed: VoicePlaybackSpeed): Promise<void> {
  await AsyncStorage.setItem(VOICE_PLAYBACK_SPEED_KEY, String(speed));
}
