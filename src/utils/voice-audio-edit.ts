const WAV_MIME = 'audio/wav';

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  const Ctor =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  return Ctor ? new Ctor() : null;
}

export async function decodeAudioUri(uri: string): Promise<AudioBuffer> {
  const ctx = getAudioContext();
  if (!ctx) {
    throw new Error('Web Audio API недоступен');
  }
  const response = await fetch(uri);
  const data = await response.arrayBuffer();
  return ctx.decodeAudioData(data.slice(0));
}

export function peaksFromBuffer(buffer: AudioBuffer, bars = 72): number[] {
  const data = buffer.getChannelData(0);
  const block = Math.max(1, Math.floor(data.length / bars));
  return Array.from({ length: bars }, (_, index) => {
    let peak = 0;
    const start = index * block;
    for (let offset = 0; offset < block; offset += 1) {
      peak = Math.max(peak, Math.abs(data[start + offset] || 0));
    }
    return Math.max(0.08, Math.min(1, peak * 1.7));
  });
}

export function concatAudioBuffers(buffers: AudioBuffer[]): AudioBuffer {
  if (buffers.length === 1) {
    return buffers[0];
  }
  const ctx = getAudioContext();
  if (!ctx) {
    throw new Error('Web Audio API недоступен');
  }
  const channels = Math.max(...buffers.map((item) => item.numberOfChannels));
  const sampleRate = buffers[0].sampleRate;
  const length = buffers.reduce((sum, item) => sum + item.length, 0);
  const output = ctx.createBuffer(channels, length, sampleRate);
  let cursor = 0;
  for (const buffer of buffers) {
    for (let channel = 0; channel < channels; channel += 1) {
      const source = buffer.getChannelData(Math.min(channel, buffer.numberOfChannels - 1));
      output.getChannelData(channel).set(source, cursor);
    }
    cursor += buffer.length;
  }
  return output;
}

export function sliceAudioBuffer(buffer: AudioBuffer, startSec: number, endSec: number): AudioBuffer {
  const ctx = getAudioContext();
  if (!ctx) {
    throw new Error('Web Audio API недоступен');
  }
  const start = Math.max(0, Math.floor(startSec * buffer.sampleRate));
  const end = Math.min(buffer.length, Math.floor(endSec * buffer.sampleRate));
  const length = Math.max(1, end - start);
  const output = ctx.createBuffer(buffer.numberOfChannels, length, buffer.sampleRate);
  for (let channel = 0; channel < buffer.numberOfChannels; channel += 1) {
    output.getChannelData(channel).set(buffer.getChannelData(channel).subarray(start, start + length));
  }
  return output;
}

export function audioBufferToWavUri(buffer: AudioBuffer): { uri: string; durationSec: number; mimeType: string } {
  const channels = buffer.numberOfChannels;
  const sampleRate = buffer.sampleRate;
  const samples = buffer.length;
  const bytesPerSample = 2;
  const blockAlign = channels * bytesPerSample;
  const dataSize = samples * blockAlign;
  const headerSize = 44;
  const view = new DataView(new ArrayBuffer(headerSize + dataSize));
  const writeString = (offset: number, value: string) => {
    for (let index = 0; index < value.length; index += 1) {
      view.setUint8(offset + index, value.charCodeAt(index));
    }
  };

  writeString(0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeString(8, 'WAVE');
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, channels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * blockAlign, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, 16, true);
  writeString(36, 'data');
  view.setUint32(40, dataSize, true);

  const interleaved = new Float32Array(samples * channels);
  for (let sample = 0; sample < samples; sample += 1) {
    for (let channel = 0; channel < channels; channel += 1) {
      interleaved[sample * channels + channel] = buffer.getChannelData(channel)[sample] ?? 0;
    }
  }
  let offset = 44;
  for (let index = 0; index < interleaved.length; index += 1) {
    const clipped = Math.max(-1, Math.min(1, interleaved[index]));
    view.setInt16(offset, clipped < 0 ? clipped * 0x8000 : clipped * 0x7fff, true);
    offset += 2;
  }

  const blob = new Blob([view], { type: WAV_MIME });
  return {
    uri: URL.createObjectURL(blob),
    durationSec: samples / sampleRate,
    mimeType: WAV_MIME,
  };
}

export async function prepareVoiceUpload(
  uris: string[],
  startRatio: number,
  endRatio: number,
): Promise<{ uri: string; durationSec: number; mimeType: string }> {
  const buffers = await Promise.all(uris.map(decodeAudioUri));
  const joined = concatAudioBuffers(buffers);
  const duration = joined.length / joined.sampleRate;
  const startSec = Math.max(0, duration * startRatio);
  const endSec = Math.min(duration, duration * endRatio);
  const sliced = sliceAudioBuffer(joined, startSec, Math.max(startSec + 0.2, endSec));
  return audioBufferToWavUri(sliced);
}

export async function peaksFromUris(uris: string[], bars = 72): Promise<number[]> {
  const buffers = await Promise.all(uris.map(decodeAudioUri));
  return peaksFromBuffer(concatAudioBuffers(buffers), bars);
}
