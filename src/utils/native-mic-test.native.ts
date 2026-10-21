import { AudioSession } from '@livekit/react-native';
import {
  mediaDevices,
  RTCPeerConnection,
  type MediaStream,
} from '@livekit/react-native-webrtc';

export type NativeMicTestHandle = {
  stop: () => void;
  getLevel: () => number;
  setMicGain: (gain: number) => void;
};

function clampGain(value: number) {
  return Math.min(2, Math.max(0, Number.isFinite(value) ? value : 1));
}

/**
 * Local WebRTC loopback so the speaker plays the mic (like the web AudioContext path).
 * expo-audio recording alone never routes input to output.
 */
export async function startNativeMicrophoneTest(
  micGain: number = 1,
): Promise<NativeMicTestHandle> {
  let gainValue = clampGain(micGain);
  let level = 0;
  let stopped = false;
  let statsTimer: ReturnType<typeof setInterval> | null = null;

  await AudioSession.startAudioSession();
  try {
    await AudioSession.setAppleAudioConfiguration({
      audioCategory: 'playAndRecord',
      audioCategoryOptions: ['defaultToSpeaker', 'allowBluetooth', 'mixWithOthers'],
      audioMode: 'default',
    });
  } catch {
    // Android — selectAudioOutput below
  }
  try {
    // Quiet local monitor — same idea as web gain node ~0.35
    await AudioSession.setDefaultRemoteAudioTrackVolume(0.35);
  } catch {
    // ignore
  }
  try {
    const outputs = await AudioSession.getAudioOutputs();
    if (outputs.includes('force_speaker')) {
      await AudioSession.selectAudioOutput('force_speaker');
    } else if (outputs.includes('speaker')) {
      await AudioSession.selectAudioOutput('speaker');
    }
  } catch {
    // keep OS default route
  }

  const localStream = (await mediaDevices.getUserMedia({
    audio: {
      echoCancellation: false,
      noiseSuppression: true,
      autoGainControl: true,
    },
    video: false,
  })) as MediaStream;

  const pc1 = new RTCPeerConnection({ iceServers: [] });
  const pc2 = new RTCPeerConnection({ iceServers: [] });

  pc1.onicecandidate = (event) => {
    if (event.candidate) {
      void pc2.addIceCandidate(event.candidate);
    }
  };
  pc2.onicecandidate = (event) => {
    if (event.candidate) {
      void pc1.addIceCandidate(event.candidate);
    }
  };

  localStream.getTracks().forEach((track) => {
    pc1.addTrack(track, localStream);
  });

  const offer = await pc1.createOffer({});
  await pc1.setLocalDescription(offer);
  await pc2.setRemoteDescription(offer);
  const answer = await pc2.createAnswer();
  await pc2.setLocalDescription(answer);
  await pc1.setRemoteDescription(answer);

  const pollLevel = async () => {
    if (stopped) {
      return;
    }
    try {
      const stats = await pc2.getStats();
      let next = 0;
      stats.forEach((report) => {
        const row = report as {
          type?: string;
          kind?: string;
          audioLevel?: number;
        };
        if (
          (row.type === 'inbound-rtp' || row.type === 'track') &&
          (row.kind === 'audio' || row.audioLevel != null)
        ) {
          const raw = typeof row.audioLevel === 'number' ? row.audioLevel : 0;
          next = Math.max(next, raw);
        }
      });
      level = Math.min(1, next * 1.8 * Math.max(0.15, gainValue));
    } catch {
      // ignore transient stats errors
    }
  };

  statsTimer = setInterval(() => {
    void pollLevel();
  }, 80);

  return {
    getLevel: () => level,
    setMicGain: (gain: number) => {
      gainValue = clampGain(gain);
    },
    stop: () => {
      if (stopped) {
        return;
      }
      stopped = true;
      if (statsTimer) {
        clearInterval(statsTimer);
        statsTimer = null;
      }
      level = 0;
      try {
        localStream.getTracks().forEach((track) => track.stop());
      } catch {
        // ignore
      }
      try {
        pc1.close();
      } catch {
        // ignore
      }
      try {
        pc2.close();
      } catch {
        // ignore
      }
      void AudioSession.stopAudioSession().catch(() => undefined);
    },
  };
}
