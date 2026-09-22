import { LoggerNames, setLogLevel } from 'livekit-client';
/** Web / default: browser WebRTC is already global. */
export function registerLivekitGlobals() {
    setLogLevel('warn', LoggerNames.Track);
}
export async function startLivekitAudioSession() { }
export async function stopLivekitAudioSession() { }
