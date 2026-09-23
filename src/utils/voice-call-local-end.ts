/** Call IDs this client just left/ended — join banner must not flash "Вернуться". */
const locallyEndedCallIds = new Set<string>();

const MAX_TRACKED = 40;

export function markVoiceCallLocallyEnded(callId: string | null | undefined) {
  const id = callId?.trim();
  if (!id) {
    return;
  }
  locallyEndedCallIds.add(id);
  if (locallyEndedCallIds.size > MAX_TRACKED) {
    const first = locallyEndedCallIds.values().next().value;
    if (first) {
      locallyEndedCallIds.delete(first);
    }
  }
}

export function wasVoiceCallLocallyEnded(callId: string | null | undefined) {
  const id = callId?.trim();
  return Boolean(id && locallyEndedCallIds.has(id));
}

export function clearVoiceCallLocallyEnded(callId: string | null | undefined) {
  const id = callId?.trim();
  if (!id) {
    return;
  }
  locallyEndedCallIds.delete(id);
}
