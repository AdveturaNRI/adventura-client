import { Platform } from 'react-native';

import { unlockWebMediaPlayback } from '@/utils/unlock-web-media';

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

/**
 * Must run as the first media call inside a tap/click handler (before other awaits).
 * iOS Safari drops user-activation after network awaits — late getUserMedia then throws
 * "not allowed by the user agent or the platform in the current context".
 *
 * Prefer `beginMicrophonePrimeFromGesture()` from `onPressIn` so RN-web Pressable
 * still has activation (onPress often fires too late on iOS).
 */
let primedMicInflight: Promise<MediaStream | null> | null = null;
let primedMicReady: MediaStream | null = null;
/** Last getUserMedia failure from a gesture prime (surfaces NotAllowedError instead of silent null). */
let primedMicError: Error | null = null;
/** Bumped on discard so late getUserMedia results are stopped instead of kept live. */
let primedMicGeneration = 0;

export function beginMicrophonePrimeFromGesture(): void {
  if (!canUseMediaDevices() || !navigator.mediaDevices.getUserMedia) {
    unlockWebMediaPlayback();
    return;
  }
  if (primedMicInflight || primedMicReady) {
    // Mic already warming — still unlock HTML audio for Bard on this tap.
    unlockWebMediaPlayback();
    return;
  }
  if (typeof window !== 'undefined' && !window.isSecureContext) {
    const host = window.location.hostname;
    if (host !== 'localhost' && host !== '127.0.0.1') {
      return;
    }
  }

  primedMicError = null;
  const generation = primedMicGeneration;

  // CRITICAL (iOS Safari): getUserMedia must start in the same sync turn as the tap.
  // Any await before it (AudioContext.resume, network) drops user-activation → NotAllowedError.
  const gumPromise = navigator.mediaDevices.getUserMedia({ audio: true, video: false });

  // Same gesture: unlock HTMLAudioElement autoplay for shared Bard music (remote play).
  // After GUM starts so mic activation is preserved. Must stay sync — do not await.
  unlockWebMediaPlayback();

  primedMicInflight = (async () => {
    try {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        const ctx = new AudioCtx();
        if (ctx.state === 'suspended') {
          void ctx.resume().catch(() => undefined);
        }
        void ctx.close().catch(() => undefined);
      }
    } catch {
      // non-fatal — never block mic behind AudioContext
    }

    try {
      const stream = await gumPromise;
      if (generation !== primedMicGeneration) {
        stopMediaStream(stream);
        return null;
      }
      primedMicReady = stream;
      primedMicError = null;
      return stream;
    } catch (error) {
      if (generation !== primedMicGeneration) {
        return null;
      }
      const message = error instanceof Error ? error.message : String(error);
      const name = error instanceof DOMException ? error.name : '';
      if (name === 'NotAllowedError' || /not allowed by the user agent|permission/i.test(message)) {
        primedMicError = new Error('Не удалось получить доступ к микрофону');
      } else {
        primedMicError = error instanceof Error ? error : new Error(message);
      }
      return null;
    } finally {
      if (generation === primedMicGeneration) {
        primedMicInflight = null;
      }
    }
  })();
}

/** Await the stream started in onPressIn, or start a new getUserMedia if none. */
export async function takePrimedMicrophone(): Promise<MediaStream | null> {
  if (primedMicReady) {
    const stream = primedMicReady;
    primedMicReady = null;
    return stream;
  }
  if (primedMicInflight) {
    const stream = await primedMicInflight;
    primedMicReady = null;
    if (!stream && primedMicError) {
      const err = primedMicError;
      primedMicError = null;
      throw err;
    }
    return stream;
  }
  if (primedMicError) {
    const err = primedMicError;
    primedMicError = null;
    throw err;
  }
  if (!canUseMediaDevices() || !navigator.mediaDevices.getUserMedia) {
    return null;
  }
  beginMicrophonePrimeFromGesture();
  if (primedMicInflight) {
    const stream = await primedMicInflight;
    primedMicReady = null;
    if (!stream && primedMicError) {
      const err = primedMicError;
      primedMicError = null;
      throw err;
    }
    return stream;
  }
  if (primedMicReady) {
    const stream = primedMicReady;
    primedMicReady = null;
    return stream;
  }
  return null;
}

export async function primeMicrophoneAccess(): Promise<MediaStream | null> {
  return takePrimedMicrophone();
}

export function stopMediaStream(stream: MediaStream | null | undefined): void {
  if (!stream) {
    return;
  }
  for (const track of stream.getTracks()) {
    try {
      track.stop();
    } catch {
      // already stopped
    }
  }
}

/** Drop an unused primed stream (e.g. user cancelled before join / app focus). */
export function discardPrimedMicrophone(): void {
  primedMicGeneration += 1;
  primedMicInflight = null;
  if (primedMicReady) {
    stopMediaStream(primedMicReady);
    primedMicReady = null;
  }
  primedMicError = null;
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
  primedStream?: MediaStream | null,
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

  let stream: MediaStream | null =
    primedStream && primedStream.getAudioTracks().some((t) => t.readyState === 'live')
      ? primedStream
      : null;

  if (!stream) {
    // Prefer stream from beginMicrophonePrimeFromGesture() (onPressIn).
    stream = await takePrimedMicrophone();
  }

  if (!stream) {
    const mobile =
      typeof navigator !== 'undefined' &&
      (/Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent ?? '') ||
        (navigator as Navigator & { userAgentData?: { mobile?: boolean } }).userAgentData
          ?.mobile === true);

    const audioConstraints: MediaTrackConstraints = mobile
      ? { echoCancellation: true }
      : {
          echoCancellation: true,
          noiseSuppression,
          autoGainControl: Math.abs(gainValue - 1) < 0.05,
        };
    if (
      !mobile &&
      deviceId?.trim() &&
      !/^(input|output|camera)-\d+$/i.test(deviceId.trim())
    ) {
      audioConstraints.deviceId = { ideal: deviceId.trim() };
    }

    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: mobile ? true : audioConstraints,
        video: false,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const name = error instanceof DOMException ? error.name : '';
      if (name === 'NotAllowedError' || /not allowed by the user agent|permission/i.test(message)) {
        throw new Error('Не удалось получить доступ к микрофону');
      }
      const overconstrained =
        name === 'OverconstrainedError' ||
        /invalid constraint|overconstrained|could not start/i.test(message);
      if (!overconstrained) {
        throw error instanceof Error ? error : new Error(message);
      }
      stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
    }
  }

  if (!stream) {
    throw new Error('Не удалось получить доступ к микрофону');
  }

  const liveStream = stream;
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

  const source = ctx.createMediaStreamSource(liveStream);
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
      for (const track of liveStream.getTracks()) {
        track.stop();
      }
      void ctx.close().catch(() => undefined);
    },
  };
}
