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

export function buildMicCaptureOptions(opts?: {
  deviceId?: string | null;
  micGain?: number;
  noiseSuppression?: boolean;
}): AudioCaptureOptions {
  const gain = clampMicGain(opts?.micGain ?? MIC_GAIN_DEFAULT);
  const noiseOn = opts?.noiseSuppression ?? NOISE_SUPPRESSION_DEFAULT;
  // When user boosts/cuts gain manually, turn AGC off so the slider actually moves level.
  const useAgc = Math.abs(gain - 1) < 0.05;
  const options: AudioCaptureOptions = {
    echoCancellation: true,
    noiseSuppression: noiseOn,
    autoGainControl: useAgc,
    ...(opts?.deviceId?.trim() ? { deviceId: opts.deviceId.trim() } : {}),
  };
  // Chromium-only; omit elsewhere so getUserMedia doesn't reject the whole constraint set.
  if (noiseOn && Platform.OS === 'web' && typeof navigator !== 'undefined') {
    const ua = navigator.userAgent ?? '';
    if (/Chrome|Chromium|Edg/i.test(ua) && !/Firefox|Safari\/\d/i.test(ua.replace(/Chrome.*$/, ''))) {
      options.voiceIsolation = true;
    }
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

export async function applyMicPipelineToRoom(
  room: Room,
  opts?: { deviceId?: string | null; micGain?: number; noiseSuppression?: boolean },
): Promise<{ usedKrisp: boolean }> {
  const micGain = clampMicGain(opts?.micGain ?? MIC_GAIN_DEFAULT);
  const noiseSuppression = opts?.noiseSuppression ?? NOISE_SUPPRESSION_DEFAULT;
  const capture = buildMicCaptureOptions({
    deviceId: opts?.deviceId,
    micGain,
    noiseSuppression,
  });
  try {
    await room.localParticipant.setMicrophoneEnabled(true, capture);
  } catch {
    // Retry without experimental voiceIsolation if the browser rejected constraints.
    const { voiceIsolation: _ignored, ...safe } = capture;
    await room.localParticipant.setMicrophoneEnabled(true, safe);
  }

  // Krisp / GainNode живут в Web Audio — нативному WebRTC это не нужно.
  if (Platform.OS !== 'web') {
    return { usedKrisp: false };
  }

  const pub = room.localParticipant.getTrackPublication(Track.Source.Microphone);
  const track = pub?.track as LocalAudioTrack | undefined;
  if (!track || typeof track.setProcessor !== 'function') {
    return { usedKrisp: false };
  }

  const processor = new AdventuraMicProcessor(micGain, noiseSuppression);
  try {
    await track.setProcessor(processor);
    return { usedKrisp: processor.usesKrisp };
  } catch {
    try {
      await track.stopProcessor();
    } catch {
      // ignore
    }
    return { usedKrisp: false };
  }
}
