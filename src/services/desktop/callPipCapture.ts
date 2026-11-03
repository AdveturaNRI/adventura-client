import type { VideoTrack } from 'livekit-client';

import type { ChatLiveVoiceParticipant } from '@/hooks/use-chat-live-voice';

const FRAME_MAX_EDGE = 480;
const JPEG_QUALITY = 0.72;

let canvas: HTMLCanvasElement | null = null;
let captureBusy = false;
let captureVideo: HTMLVideoElement | null = null;
let captureTrack: MediaStreamTrack | null = null;

function getCanvas(): HTMLCanvasElement {
  if (!canvas) {
    canvas = document.createElement('canvas');
  }
  return canvas;
}

/** Prefer remote speaker with camera → any remote camera → speaking → first remote → local. */
export function pickCallPipParticipant(
  participants: ChatLiveVoiceParticipant[],
): ChatLiveVoiceParticipant | null {
  if (!participants.length) {
    return null;
  }
  const remotes = participants.filter((p) => !p.isLocal);
  const pool = remotes.length ? remotes : participants;

  return (
    pool.find((p) => p.speaking && p.cameraOn && p.videoTrack) ||
    pool.find((p) => p.cameraOn && p.videoTrack) ||
    pool.find((p) => p.speaking) ||
    pool[0] ||
    null
  );
}

/** Prefer the screen share selected in the call, then the remote camera. */
export function pickCallPipVideo(
  participants: ChatLiveVoiceParticipant[],
  selectedScreenIdentity: string | null,
): { participant: ChatLiveVoiceParticipant; track: VideoTrack | null; screenShare: boolean } | null {
  const selected = participants.find((p) => !p.isLocal && p.identity === selectedScreenIdentity && p.screenShareTrack);
  const shared = selected || participants.find((p) => !p.isLocal && p.screenShareTrack);
  if (shared) return { participant: shared, track: shared.screenShareTrack, screenShare: true };
  const participant = pickCallPipParticipant(participants);
  return participant ? { participant, track: participant.cameraOn ? participant.videoTrack : null, screenShare: false } : null;
}

export async function captureVideoTrackFrame(
  track: VideoTrack | null | undefined,
): Promise<string | null> {
  if (!track || typeof document === 'undefined' || captureBusy) {
    return null;
  }

  const mediaTrack = track.mediaStreamTrack;
  if (!mediaTrack || mediaTrack.readyState !== 'live') {
    return null;
  }

  captureBusy = true;
  try {
    // ImageCapture is ideal when available (no DOM video).
    const ImageCaptureCtor = (
      window as unknown as {
        ImageCapture?: new (track: MediaStreamTrack) => {
          grabFrame: () => Promise<ImageBitmap>;
        };
      }
    ).ImageCapture;

    if (ImageCaptureCtor) {
      try {
        const grabber = new ImageCaptureCtor(mediaTrack);
        const bitmap = await grabber.grabFrame();
        const dataUrl = bitmapToJpeg(bitmap);
        bitmap.close();
        return dataUrl;
      } catch {
        // fall through to video element
      }
    }

    return await captureViaVideoElement(mediaTrack);
  } finally {
    captureBusy = false;
  }
}

function bitmapToJpeg(bitmap: ImageBitmap): string | null {
  const { width, height } = fitSize(bitmap.width, bitmap.height);
  if (width < 2 || height < 2) {
    return null;
  }
  const surface = getCanvas();
  surface.width = width;
  surface.height = height;
  const ctx = surface.getContext('2d');
  if (!ctx) {
    return null;
  }
  ctx.drawImage(bitmap, 0, 0, width, height);
  return surface.toDataURL('image/jpeg', JPEG_QUALITY);
}

function fitSize(w: number, h: number): { width: number; height: number } {
  const max = Math.max(w, h);
  if (max <= FRAME_MAX_EDGE) {
    return { width: Math.max(1, Math.round(w)), height: Math.max(1, Math.round(h)) };
  }
  const scale = FRAME_MAX_EDGE / max;
  return {
    width: Math.max(1, Math.round(w * scale)),
    height: Math.max(1, Math.round(h * scale)),
  };
}

function captureViaVideoElement(mediaTrack: MediaStreamTrack): Promise<string | null> {
  return new Promise((resolve) => {
    if (!captureVideo || captureTrack !== mediaTrack) {
      try {
        captureVideo?.pause();
        if (captureVideo) captureVideo.srcObject = null;
      } catch {
        // ignore
      }
      captureVideo = document.createElement('video');
      captureVideo.muted = true;
      captureVideo.playsInline = true;
      captureVideo.srcObject = new MediaStream([mediaTrack]);
      captureTrack = mediaTrack;
      mediaTrack.addEventListener('ended', () => {
        if (captureTrack !== mediaTrack) return;
        captureVideo?.pause();
        if (captureVideo) captureVideo.srcObject = null;
        captureVideo = null;
        captureTrack = null;
      }, { once: true });
    }
    const video = captureVideo;
    let settled = false;
    const finish = (value: string | null) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(failTimer);
      video.removeEventListener('loadeddata', capture);
      resolve(value);
    };

    const failTimer = window.setTimeout(() => {
      finish(null);
    }, 800);

    const capture = () => {
      try {
        const { videoWidth: w, videoHeight: h } = video;
        const { width, height } = fitSize(w || 320, h || 240);
        const surface = getCanvas();
        surface.width = width;
        surface.height = height;
        const ctx = surface.getContext('2d');
        if (!ctx) {
          finish(null);
          return;
        }
        ctx.drawImage(video, 0, 0, width, height);
        const dataUrl = surface.toDataURL('image/jpeg', JPEG_QUALITY);
        finish(dataUrl);
      } catch {
        finish(null);
      }
    };
    if (video.readyState >= 2 && video.videoWidth > 0) capture();
    else {
      video.addEventListener('loadeddata', capture, { once: true });
      void video.play().catch(() => finish(null));
    }
  });
}
