import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';

import type { ChatLiveVoiceParticipant } from '@/hooks/use-chat-live-voice';
import {
  captureVideoTrackFrame,
  pickCallPipParticipant,
} from '@/services/desktop/callPipCapture';
import {
  getElectronBridge,
  isElectronShell,
  updateElectronCallPip,
  type DesktopCallPipAction,
  type DesktopCallPipMode,
  type DesktopCallPipState,
} from '@/services/desktop/electronBridge';

type Props = {
  mode: DesktopCallPipMode | 'idle';
  title: string;
  peerName: string | null;
  peerAvatarUrl: string | null;
  muted: boolean;
  participants: ChatLiveVoiceParticipant[];
  /** Epoch ms when active call started; null while ringing. */
  activeSinceMs: number | null;
  onExpand: () => void;
  onHangup: () => void;
  onMute: () => void;
  onAccept: () => void;
  onDecline: () => void;
};

const FRAME_INTERVAL_MS = 280;
const META_INTERVAL_MS = 1000;

export function DesktopCallPipController({
  mode,
  title,
  peerName,
  peerAvatarUrl,
  muted,
  participants,
  activeSinceMs,
  onExpand,
  onHangup,
  onMute,
  onAccept,
  onDecline,
}: Props) {
  const actionsRef = useRef({
    onExpand,
    onHangup,
    onMute,
    onAccept,
    onDecline,
  });
  actionsRef.current = {
    onExpand,
    onHangup,
    onMute,
    onAccept,
    onDecline,
  };

  const metaRef = useRef({
    mode,
    title,
    peerName,
    peerAvatarUrl,
    muted,
    activeSinceMs,
    participants,
  });
  metaRef.current = {
    mode,
    title,
    peerName,
    peerAvatarUrl,
    muted,
    activeSinceMs,
    participants,
  };

  const lastFrameRef = useRef<string | null>(null);
  const lastStateKeyRef = useRef('');

  useEffect(() => {
    if (Platform.OS !== 'web' || !isElectronShell()) {
      return;
    }
    // Claim ownership so Electron DOM watcher does not fight this controller.
    (window as unknown as { __adventuraPipController?: boolean }).__adventuraPipController =
      true;
    const bridge = getElectronBridge();
    if (!bridge?.onCallPipAction) {
      return () => {
        (window as unknown as { __adventuraPipController?: boolean }).__adventuraPipController =
          false;
      };
    }
    const unsub = bridge.onCallPipAction((action: DesktopCallPipAction) => {
      const a = actionsRef.current;
      switch (action) {
        case 'expand':
          a.onExpand();
          break;
        case 'hangup':
          a.onHangup();
          break;
        case 'mute':
          a.onMute();
          break;
        case 'accept':
          a.onAccept();
          break;
        case 'decline':
          a.onDecline();
          break;
        default:
          break;
      }
    });
    return () => {
      unsub();
      (window as unknown as { __adventuraPipController?: boolean }).__adventuraPipController =
        false;
    };
  }, []);

  useEffect(() => {
    if (Platform.OS !== 'web' || !isElectronShell()) {
      return;
    }

    let cancelled = false;
    let frameTimer: ReturnType<typeof setInterval> | null = null;
    let metaTimer: ReturnType<typeof setInterval> | null = null;

    const hide = () => {
      lastFrameRef.current = null;
      lastStateKeyRef.current = '';
      void updateElectronCallPip({ visible: false });
    };

    if (mode === 'idle') {
      hide();
      return () => {
        cancelled = true;
      };
    }

    const buildAndPush = async (frameDataUrl?: string | null) => {
      if (cancelled) {
        return;
      }
      const snap = metaRef.current;
      if (snap.mode === 'idle') {
        return;
      }

      const featured = pickCallPipParticipant(snap.participants);
      const name = featured?.name || snap.peerName || 'Собеседник';
      const avatar = featured?.avatarUrl ?? snap.peerAvatarUrl;
      const hasVideo = Boolean(featured?.cameraOn && featured?.videoTrack);
      const durationSec =
        snap.mode === 'active' && snap.activeSinceMs
          ? Math.max(0, Math.floor((Date.now() - snap.activeSinceMs) / 1000))
          : null;

      let subtitle = '';
      if (snap.mode === 'incoming') {
        subtitle = 'Входящий звонок';
      } else if (snap.mode === 'outgoing') {
        subtitle = 'Вызов…';
      } else if (featured?.speaking) {
        subtitle = 'Говорит';
      } else if (hasVideo) {
        subtitle = 'Камера';
      } else {
        subtitle = 'Голосовой звонок';
      }

      if (frameDataUrl !== undefined) {
        lastFrameRef.current = frameDataUrl;
      }
      const frame = hasVideo ? lastFrameRef.current : null;

      const state: DesktopCallPipState = {
        visible: true,
        mode: snap.mode,
        title: snap.title || name,
        subtitle,
        peerName: name,
        avatarUrl: avatar,
        frameDataUrl: frame,
        hasVideo,
        muted: snap.muted,
        durationSec,
      };

      const key = [
        state.mode,
        state.title,
        state.subtitle,
        state.peerName,
        state.avatarUrl,
        state.hasVideo,
        state.muted,
        state.durationSec,
        frame ? frame.slice(-32) : '',
      ].join('|');

      if (key === lastStateKeyRef.current) {
        return;
      }
      lastStateKeyRef.current = key;
      await updateElectronCallPip(state);
    };

    void buildAndPush();

    metaTimer = setInterval(() => {
      void buildAndPush();
    }, META_INTERVAL_MS);

    frameTimer = setInterval(() => {
      const featured = pickCallPipParticipant(metaRef.current.participants);
      if (!featured?.videoTrack) {
        if (lastFrameRef.current) {
          void buildAndPush(null);
        }
        return;
      }
      void captureVideoTrackFrame(featured.videoTrack).then((frame) => {
        if (frame) {
          void buildAndPush(frame);
        }
      });
    }, FRAME_INTERVAL_MS);

    return () => {
      cancelled = true;
      if (frameTimer) {
        clearInterval(frameTimer);
      }
      if (metaTimer) {
        clearInterval(metaTimer);
      }
      hide();
    };
  }, [mode]);

  // Bust dedupe key so the running interval picks up muted/title/peer changes immediately.
  useEffect(() => {
    lastStateKeyRef.current = '';
  }, [activeSinceMs, muted, peerAvatarUrl, peerName, title]);

  return null;
}
