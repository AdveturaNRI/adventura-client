import { Platform } from 'react-native';
import {
  Track,
  type AudioCaptureOptions,
  type AudioProcessorOptions,
  type LocalAudioTrack,
  type Room,
  type TrackProcessor,
} from 'livekit-client';

import {
  clampMicGain,
  MIC_GAIN_DEFAULT,
  NOISE_SUPPRESSION_DEFAULT,
} from '@/utils/voice-device-settings';

/** Real browser deviceId — not our synthetic `input-0` placeholders. */
export function isUsableMediaDeviceId(deviceId?: string | null): boolean {
  const id = deviceId?.trim();
  if (!id) {
    return false;
  }
  if (/^(input|output|camera)-\d+$/i.test(id)) {
    return false;
  }
  return true;
}

function isMobileWebUa(): boolean {
  if (Platform.OS !== 'web' || typeof navigator === 'undefined') {
    return false;
  }
  const ua = navigator.userAgent ?? '';
  const data = (
    navigator as Navigator & { userAgentData?: { mobile?: boolean } }
  ).userAgentData;
  if (data?.mobile === true) {
    return true;
  }
  return /Android|iPhone|iPad|iPod|Mobile|webOS|IEMobile|Opera Mini/i.test(ua);
}

/** Chromium desktop only — voiceIsolation is rejected on mobile Chrome/Safari. */
function supportsVoiceIsolation(): boolean {
  if (Platform.OS !== 'web' || typeof navigator === 'undefined') {
    return false;
  }
  if (isMobileWebUa()) {
    return false;
  }
  const ua = navigator.userAgent ?? '';
  if (/Firefox/i.test(ua)) {
    return false;
  }
  // Chrome iOS is WebKit and reports CriOS — not real Chromium capture.
  if (/CriOS|FxiOS|EdgiOS/i.test(ua)) {
    return false;
  }
  return /Chrome|Chromium|Edg/i.test(ua);
}

export function buildMicCaptureOptions(opts?: {
  deviceId?: string | null;
  micGain?: number;
  noiseSuppression?: boolean;
}): AudioCaptureOptions {
  const gain = clampMicGain(opts?.micGain ?? MIC_GAIN_DEFAULT);
  const noiseOn = opts?.noiseSuppression ?? NOISE_SUPPRESSION_DEFAULT;
  // When user boosts/cuts gain manually, turn AGC off so the slider actually moves level.
  const useAgc = Math.abs(gain - 1) < 0.05;
  const mobile = isMobileWebUa();

  // Mobile browsers (esp. Safari / Chrome Android) reject exotic constraints with
  // OverconstrainedError: "Invalid constraint". Keep the set minimal there.
  const options: AudioCaptureOptions = mobile
    ? {
        echoCancellation: true,
        noiseSuppression: noiseOn,
        autoGainControl: true,
        // LiveKit defaults voiceIsolation: true — must override or getUserMedia dies.
        voiceIsolation: false,
      }
    : {
        echoCancellation: true,
        noiseSuppression: noiseOn,
        autoGainControl: useAgc,
        voiceIsolation: false,
      };

  if (isUsableMediaDeviceId(opts?.deviceId)) {
    // Pass ideal, not a bare string — LiveKit turns strings into { exact }, which
    // breaks when the saved desktop mic id isn't on this phone.
    options.deviceId = { ideal: opts!.deviceId!.trim() };
  }

  if (!mobile && noiseOn && supportsVoiceIsolation()) {
    options.voiceIsolation = true;
  }
  return options;
}

/**
 * Optional Krisp → GainNode.
 * WebRTC NS still runs at capture when noiseSuppression is on.
 */
export class AdventuraMicProcessor
  implements TrackProcessor<Track.Kind.Audio, AudioProcessorOptions>
{
  readonly name = 'adventura-mic';
  processedTrack?: MediaStreamTrack;

  private gainValue: number;
  private noiseSuppression: boolean;
  private ctx?: AudioContext;
  private source?: MediaStreamAudioSourceNode;
  private gainNode?: GainNode;
  private dest?: MediaStreamAudioDestinationNode;
  private krisp: TrackProcessor<Track.Kind.Audio, AudioProcessorOptions> | null = null;
  private usedKrisp = false;

  constructor(
    gain: number = MIC_GAIN_DEFAULT,
    noiseSuppression: boolean = NOISE_SUPPRESSION_DEFAULT,
  ) {
    this.gainValue = clampMicGain(gain);
    this.noiseSuppression = noiseSuppression;
  }

  get usesKrisp() {
    return this.usedKrisp;
  }

  setGain(gain: number) {
    this.gainValue = clampMicGain(gain);
    if (this.gainNode) {
      this.gainNode.gain.value = this.gainValue;
    }
  }

  async init(opts: AudioProcessorOptions): Promise<void> {
    this.ctx = opts.audioContext;
    let inputTrack = opts.track;

    if (this.noiseSuppression && Platform.OS === 'web') {
      try {
        const { isKrispNoiseFilterSupported, KrispNoiseFilter } = await import(
          '@livekit/krisp-noise-filter'
        );
        if (isKrispNoiseFilterSupported()) {
          const krisp = KrispNoiseFilter({ quality: 'medium' });
          await krisp.init(opts);
          if (krisp.processedTrack) {
            this.krisp = krisp;
            this.usedKrisp = true;
            inputTrack = krisp.processedTrack;
          } else {
            await krisp.destroy().catch(() => undefined);
          }
        }
      } catch {
        this.krisp = null;
        this.usedKrisp = false;
      }
    }

    this.source = this.ctx.createMediaStreamSource(new MediaStream([inputTrack]));
    this.gainNode = this.ctx.createGain();
    this.gainNode.gain.value = this.gainValue;
    this.dest = this.ctx.createMediaStreamDestination();
    this.source.connect(this.gainNode);
    this.gainNode.connect(this.dest);
    this.processedTrack = this.dest.stream.getAudioTracks()[0];
  }

  async restart(opts: AudioProcessorOptions): Promise<void> {
    await this.destroy();
    await this.init(opts);
  }

  async onPublish(room: Room): Promise<void> {
    await this.krisp?.onPublish?.(room);
  }

  async onUnpublish(): Promise<void> {
    await this.krisp?.onUnpublish?.();
  }

  async destroy(): Promise<void> {
    try {
      this.source?.disconnect();
      this.gainNode?.disconnect();
    } catch {
      // already gone
    }
    this.source = undefined;
    this.gainNode = undefined;
    this.dest = undefined;
    this.processedTrack = undefined;
    this.ctx = undefined;
    if (this.krisp) {
      await this.krisp.destroy().catch(() => undefined);
      this.krisp = null;
    }
    this.usedKrisp = false;
  }
}

const MIC_PUBLISH_TIMEOUT_MS = 12_000;

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(label));
    }, ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      },
    );
  });
}

export async function applyMicPipelineToRoom(
  room: Room,
  opts?: {
    deviceId?: string | null;
    micGain?: number;
    noiseSuppression?: boolean;
    /** Stream from primeMicrophoneAccess() during the user tap — avoids iOS NotAllowedError. */
    primedStream?: MediaStream | null;
  },
): Promise<{ usedKrisp: boolean; enabled: boolean }> {
  const micGain = clampMicGain(opts?.micGain ?? MIC_GAIN_DEFAULT);
  const noiseSuppression = opts?.noiseSuppression ?? NOISE_SUPPRESSION_DEFAULT;

  const primedTrack = opts?.primedStream?.getAudioTracks()?.[0];
  if (primedTrack && primedTrack.readyState !== 'ended') {
    try {
      await withTimeout(
        room.localParticipant.publishTrack(primedTrack, {
          source: Track.Source.Microphone,
          name: 'microphone',
        }),
        MIC_PUBLISH_TIMEOUT_MS,
        'mic_publish_timeout',
      );
      if (room.localParticipant.isMicrophoneEnabled) {
        return await attachMicProcessor(room, micGain, noiseSuppression);
      }
    } catch {
      // fall through to getUserMedia path
    }
  }

  const capture = buildMicCaptureOptions({
    deviceId: opts?.deviceId,
    micGain,
    noiseSuppression,
  });

  const tryEnable = async (options: AudioCaptureOptions): Promise<boolean> => {
    try {
      const pub = await withTimeout(
        room.localParticipant.setMicrophoneEnabled(true, options),
        MIC_PUBLISH_TIMEOUT_MS,
        'mic_publish_timeout',
      );
      return Boolean(pub) || room.localParticipant.isMicrophoneEnabled;
    } catch {
      try {
        // Cancel a stuck pending publish so the next attempt can start clean.
        await room.localParticipant.setMicrophoneEnabled(false);
      } catch {
        // ignore
      }
      return false;
    }
  };

  let enabled = await tryEnable(capture);
  if (!enabled) {
    const { voiceIsolation: _ignored, deviceId: _device, ...withoutExotic } = capture;
    enabled = await tryEnable({
      ...withoutExotic,
      voiceIsolation: false,
    });
  }
  if (!enabled && capture.deviceId) {
    enabled = await tryEnable({
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
      voiceIsolation: false,
    });
  }
  if (!enabled) {
    // Last resort: bare mic, no processing flags.
    enabled = await tryEnable({ voiceIsolation: false });
  }

  if (!enabled) {
    return { usedKrisp: false, enabled: false };
  }

  return attachMicProcessor(room, micGain, noiseSuppression);
}

async function attachMicProcessor(
  room: Room,
  micGain: number,
  noiseSuppression: boolean,
): Promise<{ usedKrisp: boolean; enabled: boolean }> {
  // Krisp / GainNode живут в Web Audio — нативному WebRTC это не нужно.
  if (Platform.OS !== 'web') {
    return { usedKrisp: false, enabled: true };
  }

  const pub = room.localParticipant.getTrackPublication(Track.Source.Microphone);
  const track = pub?.track as LocalAudioTrack | undefined;
  if (!track || typeof track.setProcessor !== 'function') {
    return { usedKrisp: false, enabled: true };
  }

  // Re-applying the processor on every unmute can kill the track in Chrome.
  const existing = typeof track.getProcessor === 'function' ? track.getProcessor() : null;
  if (existing?.name === 'adventura-mic') {
    const current = existing as AdventuraMicProcessor;
    if (typeof current.setGain === 'function') {
      current.setGain(micGain);
    }
    return { usedKrisp: current.usesKrisp, enabled: true };
  }

  const processor = new AdventuraMicProcessor(micGain, noiseSuppression);
  try {
    await track.setProcessor(processor);
    return { usedKrisp: processor.usesKrisp, enabled: true };
  } catch {
    try {
      await track.stopProcessor();
    } catch {
      // ignore
    }
    return { usedKrisp: false, enabled: true };
  }
}
