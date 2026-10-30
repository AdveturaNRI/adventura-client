import type { VideoTrack } from 'livekit-client';

import type { ChatLiveVoiceParticipant } from '@/hooks/use-chat-live-voice';

const FRAME_MAX_EDGE = 480;
const JPEG_QUALITY = 0.72;

let canvas: HTMLCanvasElement | null = null;
let captureBusy = false;

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
    const video = document.createElement('video');
    video.muted = true;
    video.playsInline = true;
    video.srcObject = new MediaStream([mediaTrack]);

    const cleanup = () => {
      try {
        video.pause();
        video.srcObject = null;
        video.remove();
      } catch {
        // ignore
      }
    };

    const failTimer = window.setTimeout(() => {
      cleanup();
      resolve(null);
    }, 800);

    video.onloadeddata = () => {
      window.clearTimeout(failTimer);
      try {
        const { videoWidth: w, videoHeight: h } = video;
        const { width, height } = fitSize(w || 320, h || 240);
        const surface = getCanvas();
        surface.width = width;
        surface.height = height;
        const ctx = surface.getContext('2d');
        if (!ctx) {
          cleanup();
          resolve(null);
          return;
        }
        ctx.drawImage(video, 0, 0, width, height);
        const dataUrl = surface.toDataURL('image/jpeg', JPEG_QUALITY);
        cleanup();
        resolve(dataUrl);
      } catch {
        cleanup();
        resolve(null);
      }
    };

    void video.play().catch(() => {
      window.clearTimeout(failTimer);
      cleanup();
      resolve(null);
    });
  });
}
