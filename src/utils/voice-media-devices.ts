import { Platform } from 'react-native';

export type MediaDeviceOption = {
  deviceId: string;
  label: string;
  kind: MediaDeviceKind;
};

function canUseMediaDevices(): boolean {
  return (
    Platform.OS === 'web' &&
    typeof navigator !== 'undefined' &&
    Boolean(navigator.mediaDevices?.enumerateDevices)
  );
}

function labelFor(device: MediaDeviceInfo, index: number): string {
  const raw = device.label?.trim();
  if (raw) {
    return raw;
  }
  if (device.kind === 'audioinput') {
    return `Микрофон ${index + 1}`;
  }
  if (device.kind === 'audiooutput') {
    return `Динамики ${index + 1}`;
  }
  if (device.kind === 'videoinput') {
    return `Камера ${index + 1}`;
  }
  return `Устройство ${index + 1}`;
}

/** Request mic once so device labels are available in Chrome. */
export async function ensureMicrophonePermission(): Promise<boolean> {
  if (!canUseMediaDevices() || !navigator.mediaDevices.getUserMedia) {
    return false;
  }
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
    for (const track of stream.getTracks()) {
      track.stop();
    }
    return true;
  } catch {
    return false;
  }
}

export async function listAudioDevices(): Promise<{
  inputs: MediaDeviceOption[];
  outputs: MediaDeviceOption[];
}> {
  if (!canUseMediaDevices()) {
    return { inputs: [], outputs: [] };
  }
  const devices = await navigator.mediaDevices.enumerateDevices();
  const inputs: MediaDeviceOption[] = [];
  const outputs: MediaDeviceOption[] = [];
  let inputIndex = 0;
  let outputIndex = 0;
  for (const device of devices) {
    if (device.kind === 'audioinput') {
      if (!device.deviceId) {
        continue;
      }
      inputs.push({
        deviceId: device.deviceId,
        label: labelFor(device, inputIndex),
        kind: 'audioinput',
      });
      inputIndex += 1;
    } else if (device.kind === 'audiooutput') {
      if (!device.deviceId) {
        continue;
      }
      outputs.push({
        deviceId: device.deviceId,
        label: labelFor(device, outputIndex),
        kind: 'audiooutput',
      });
      outputIndex += 1;
    }
  }
  return { inputs, outputs };
}

export async function ensureCameraPermission(): Promise<boolean> {
  if (!canUseMediaDevices() || !navigator.mediaDevices.getUserMedia) {
    return false;
  }
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: false, video: true });
    for (const track of stream.getTracks()) {
      track.stop();
    }
    return true;
  } catch {
    return false;
  }
}

export async function listVideoDevices(): Promise<MediaDeviceOption[]> {
  if (!canUseMediaDevices()) {
    return [];
  }
  const devices = await navigator.mediaDevices.enumerateDevices();
  const cameras: MediaDeviceOption[] = [];
  let index = 0;
  for (const device of devices) {
    if (device.kind !== 'videoinput') {
      continue;
    }
    if (!device.deviceId) {
      continue;
    }
    cameras.push({
      deviceId: device.deviceId,
      label: labelFor(device, index),
      kind: 'videoinput',
    });
    index += 1;
  }
  return cameras;
}

export function supportsAudioOutputSelection(): boolean {
  if (Platform.OS !== 'web' || typeof HTMLMediaElement === 'undefined') {
    return false;
  }
  return typeof (HTMLMediaElement.prototype as HTMLMediaElement & { setSinkId?: unknown }).setSinkId ===
    'function';
}

export async function applyAudioOutputToElement(
  el: HTMLMediaElement,
  deviceId: string | null,
): Promise<void> {
  if (!deviceId || !supportsAudioOutputSelection()) {
    return;
  }
  const withSink = el as HTMLMediaElement & {
    setSinkId?: (id: string) => Promise<void>;
  };
  if (typeof withSink.setSinkId !== 'function') {
    return;
  }
  try {
    await withSink.setSinkId(deviceId);
  } catch {
    // browser may reject sink while element is idle
  }
}

export type MicTestHandle = {
  stop: () => void;
  getLevel: () => number;
  setMicGain: (gain: number) => void;
  setOutputDeviceId: (deviceId: string | null) => Promise<void>;
};

/** Open mic stream, play it locally, and return 0..1 level meter via AnalyserNode. */
export async function startMicrophoneTest(
  deviceId?: string | null,
  micGain: number = 1,
  outputDeviceId?: string | null,
  noiseSuppression: boolean = true,
): Promise<MicTestHandle> {
  if (!canUseMediaDevices() || !navigator.mediaDevices.getUserMedia) {
    throw new Error('Микрофон недоступен в этом браузере');
  }

  const AudioCtx =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioCtx) {
    throw new Error('Web Audio не поддерживается');
  }

  const clampGain = (value: number) =>
    Math.min(2, Math.max(0, Number.isFinite(value) ? value : 1));
  let gainValue = clampGain(micGain);
  const audioConstraints: MediaTrackConstraints = {
    echoCancellation: true,
    noiseSuppression,
    autoGainControl: Math.abs(gainValue - 1) < 0.05,
  };
  if (deviceId?.trim() && !/^(input|output|camera)-\d+$/i.test(deviceId.trim())) {
    // ideal, not exact — exact stale ids → OverconstrainedError "Invalid constraint" on phones
    audioConstraints.deviceId = { ideal: deviceId.trim() };
  }
  const constraints: MediaStreamConstraints = {
    audio: audioConstraints,
    video: false,
  };

  let stream: MediaStream;
  try {
    stream = await navigator.mediaDevices.getUserMedia(constraints);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const overconstrained =
      (error instanceof DOMException && error.name === 'OverconstrainedError') ||
      /invalid constraint|overconstrained|could not start/i.test(message);
    if (!overconstrained) {
      throw error;
    }
    // Phone browsers often reject NS/AEC combo or a bad deviceId — bare mic still works.
    stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
  }
  const ctx = new AudioCtx();
  if (ctx.state === 'suspended') {
    await ctx.resume().catch(() => undefined);
  }

  const applyOutputSink = async (sinkId: string | null | undefined) => {
    if (!sinkId?.trim() || !supportsAudioOutputSelection()) {
      return;
    }
    const withSink = ctx as AudioContext & {
      setSinkId?: (id: string) => Promise<void>;
    };
    if (typeof withSink.setSinkId !== 'function') {
      return;
    }
    try {
      await withSink.setSinkId(sinkId.trim());
    } catch {
      // keep current / default speakers
    }
  };

  await applyOutputSink(outputDeviceId);

  const source = ctx.createMediaStreamSource(stream);
  const gainNode = ctx.createGain();
  // Meter/pipeline gain = what you'd send. Monitor is quieter on purpose.
  gainNode.gain.value = gainValue;
  const analyser = ctx.createAnalyser();
  analyser.fftSize = 256;
  analyser.smoothingTimeConstant = 0.7;

  // Full-volume self-monitor → speakers bleed into the mic → AEC chews the signal
  // into muddy/robotic noise. Keep playback soft and soft-limit peaks.
  const monitorGain = ctx.createGain();
  monitorGain.gain.value = Math.min(1, gainValue) * 0.22;
  const compressor = ctx.createDynamicsCompressor();
  compressor.threshold.value = -28;
  compressor.knee.value = 20;
  compressor.ratio.value = 10;
  compressor.attack.value = 0.003;
  compressor.release.value = 0.15;

  source.connect(gainNode);
  gainNode.connect(analyser);
  gainNode.connect(monitorGain);
  monitorGain.connect(compressor);
  compressor.connect(ctx.destination);
  const data = new Uint8Array(analyser.frequencyBinCount);

  return {
    getLevel: () => {
      analyser.getByteTimeDomainData(data);
      let sum = 0;
      for (let i = 0; i < data.length; i += 1) {
        const v = (data[i] - 128) / 128;
        sum += v * v;
      }
      const rms = Math.sqrt(sum / data.length);
      return Math.min(1, rms * 3.2);
    },
    setMicGain: (nextGain: number) => {
      gainValue = clampGain(nextGain);
      gainNode.gain.value = gainValue;
      monitorGain.gain.value = Math.min(1, gainValue) * 0.22;
    },
    setOutputDeviceId: async (nextOutputId: string | null) => {
      await applyOutputSink(nextOutputId);
    },
    stop: () => {
      try {
        source.disconnect();
        gainNode.disconnect();
        analyser.disconnect();
        monitorGain.disconnect();
        compressor.disconnect();
      } catch {
        // already gone
      }
      for (const track of stream.getTracks()) {
        track.stop();
      }
      void ctx.close().catch(() => undefined);
    },
  };
}
