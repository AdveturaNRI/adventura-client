export type DesktopNotifyPayload = {
  title: string;
  body: string;
  url?: string;
};

export type DesktopCallPipMode = 'incoming' | 'outgoing' | 'active';

export type DesktopCallPipState = {
  visible: boolean;
  mode?: DesktopCallPipMode;
  title?: string;
  subtitle?: string;
  peerName?: string;
  avatarUrl?: string | null;
  frameDataUrl?: string | null;
  hasVideo?: boolean;
  muted?: boolean;
  durationSec?: number | null;
};

export type DesktopCallPipAction =
  | 'expand'
  | 'hangup'
  | 'mute'
  | 'accept'
  | 'decline';

type AdventuraDesktopBridge = {
  isDesktop: true;
  platform?: string;
  notify: (payload: DesktopNotifyPayload) => Promise<boolean>;
  setAutostart: (enabled: boolean) => Promise<boolean>;
  getAutostart: () => Promise<boolean>;
  showWindow: () => Promise<boolean>;
  updateCallPip?: (state: DesktopCallPipState) => Promise<boolean>;
  onNavigate: (callback: (url: string) => void) => () => void;
  onCallPipAction?: (callback: (action: DesktopCallPipAction) => void) => () => void;
};

declare global {
  interface Window {
    adventuraDesktop?: AdventuraDesktopBridge;
  }
}

export function getElectronBridge(): AdventuraDesktopBridge | null {
  if (typeof window === 'undefined') {
    return null;
  }
  return window.adventuraDesktop ?? null;
}

export function isElectronShell(): boolean {
  if (typeof navigator === 'undefined') {
    return false;
  }
  if (getElectronBridge()?.isDesktop) {
    return true;
  }
  const ua = navigator.userAgent || '';
  const electronProcess = (
    window as unknown as { process?: { versions?: { electron?: string } } }
  ).process?.versions?.electron;
  return /\bElectron\//.test(ua) || Boolean(electronProcess);
}

export async function notifyElectronDesktop(
  payload: DesktopNotifyPayload,
): Promise<boolean> {
  const bridge = getElectronBridge();
  if (!bridge?.notify) {
    return false;
  }
  try {
    return Boolean(await bridge.notify(payload));
  } catch {
    return false;
  }
}

export async function updateElectronCallPip(
  state: DesktopCallPipState,
): Promise<boolean> {
  const bridge = getElectronBridge();
  if (!bridge?.updateCallPip) {
    return false;
  }
  try {
    return Boolean(await bridge.updateCallPip(state));
  } catch {
    return false;
  }
}
