/** Tiny bridge so ChatDiceOverlay can freeze its Babylon stage while a
 *  voice-call dice layer is up — without importing VoiceCallContext (cycle). */

let callOwnsDice = false;
const listeners = new Set<() => void>();

export function setVoiceCallOwnsDice(next: boolean) {
  if (callOwnsDice === next) {
    return;
  }
  callOwnsDice = next;
  listeners.forEach((listener) => listener());
}

export function getVoiceCallOwnsDice() {
  return callOwnsDice;
}

export function subscribeVoiceCallOwnsDice(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
