type Device = { kind: string; deviceId: string };

export function watchVoiceDeviceChanges(options: {
  devices: Pick<MediaDevices, 'addEventListener' | 'removeEventListener'>;
  getTrack: () => MediaStreamTrack | null;
  listenTracks: (onChange: () => void) => () => void;
  onChange: () => void;
  debounceMs?: number;
}): () => void {
  let stopped = false;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let watchedTrack: MediaStreamTrack | null = null;
  const schedule = () => {
    if (stopped) return;
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => { timer = null; if (!stopped) options.onChange(); }, options.debounceMs ?? 200);
  };
  const bindTrack = () => {
    const next = options.getTrack();
    if (next === watchedTrack) return;
    watchedTrack?.removeEventListener('ended', schedule);
    watchedTrack = next;
    watchedTrack?.addEventListener('ended', schedule);
  };
  options.devices.addEventListener?.('devicechange', schedule);
  const stopListening = options.listenTracks(bindTrack);
  bindTrack();
  schedule();
  return () => {
    stopped = true;
    if (timer) clearTimeout(timer);
    options.devices.removeEventListener?.('devicechange', schedule);
    watchedTrack?.removeEventListener('ended', schedule);
    stopListening();
  };
}

/** Empty lists can mean missing permissions; do not interpret them as removals. */
function missing(id: string | null | undefined, devices: Device[], kind: string): boolean {
  if (!id || id === 'default' || id === 'communications') return false;
  const available = devices.filter((device) => device.kind === kind && device.deviceId);
  return available.length > 0 && !available.some((device) => device.deviceId === id);
}

export function decideVoiceDeviceFallback(options: {
  devices: Device[];
  preferredInput: string | null;
  preferredOutput: string | null;
  activeInput?: string;
  activeOutput?: string;
  inputEnded: boolean;
  mutedByUser: boolean;
  inputAlreadyDefault: boolean;
  outputAlreadyDefault: boolean;
}): { input: boolean; inputReset: boolean; output: boolean } {
  const inputAvailable = options.devices.some((device) => device.kind === 'audioinput' && device.deviceId);
  const inputLost = (!options.mutedByUser && options.inputEnded) ||
    missing(options.activeInput, options.devices, 'audioinput') ||
    (!options.inputAlreadyDefault && missing(options.preferredInput, options.devices, 'audioinput'));
  const outputLost = missing(options.activeOutput, options.devices, 'audiooutput') ||
    (!options.outputAlreadyDefault && missing(options.preferredOutput, options.devices, 'audiooutput'));
  return { input: inputAvailable && inputLost && !options.mutedByUser, inputReset: inputAvailable && inputLost, output: outputLost };
}

/** Set the next capture device even while muted, but never publish audio without user intent. */
export async function recoverVoiceInputToSystem(operations: {
  switchToDefault: () => Promise<unknown>;
  isCurrent: () => boolean;
  isMutedByUser: () => boolean;
  restoreTrack: () => Promise<void>;
  applyProcessing: () => Promise<void>;
  enforceMute: () => Promise<void>;
}): Promise<'recovered' | 'prepared' | 'cancelled'> {
  await operations.switchToDefault();
  if (!operations.isCurrent()) return 'cancelled';
  if (operations.isMutedByUser()) {
    await operations.enforceMute();
    return 'prepared';
  }
  await operations.restoreTrack();
  if (!operations.isCurrent()) return 'cancelled';
  if (operations.isMutedByUser()) {
    await operations.enforceMute();
    return 'prepared';
  }
  await operations.applyProcessing();
  if (!operations.isCurrent()) return 'cancelled';
  if (operations.isMutedByUser()) {
    await operations.enforceMute();
    return 'prepared';
  }
  return 'recovered';
}
