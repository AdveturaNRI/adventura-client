import { AudioSession, registerGlobals } from '@livekit/react-native';
import { LoggerNames, setLogLevel } from 'livekit-client';

export function registerLivekitGlobals() {
  registerGlobals();
  setLogLevel('warn', LoggerNames.Track);
}

export async function startLivekitAudioSession() {
  await AudioSession.startAudioSession();
}

export async function stopLivekitAudioSession() {
  await AudioSession.stopAudioSession();
}
