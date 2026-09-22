import { createElement, useEffect, useRef } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import type { VideoTrack } from 'livekit-client';

type Props = {
  track: VideoTrack | null;
  mirror?: boolean;
  style?: StyleProp<ViewStyle>;
};

/** Web: attach LiveKit track to a muted <video> (audio stays on hidden audio nodes). */
export function CallVideoView({ track, mirror = false, style }: Props) {
  const hostRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host || !track) {
      return;
    }
    const el = track.attach();
    el.autoplay = true;
    el.muted = true;
    el.playsInline = true;
    el.setAttribute('playsinline', 'true');
    el.style.width = '100%';
    el.style.height = '100%';
    el.style.objectFit = 'cover';
    el.style.background = '#111214';
    el.style.transform = mirror ? 'scaleX(-1)' : '';
    host.replaceChildren(el);
    return () => {
      try {
        track.detach(el);
      } catch {
        // already detached
      }
      el.remove();
      host.replaceChildren();
    };
  }, [mirror, track]);

  if (!track) {
    return null;
  }

  return (
    <View style={[styles.fill, style]} pointerEvents="none">
      {createElement('div', {
        ref: hostRef,
        style: { width: '100%', height: '100%', overflow: 'hidden' },
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  fill: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'hidden',
    backgroundColor: '#111214',
  },
});
