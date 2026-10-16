import { createElement, useEffect, useRef } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import type { VideoTrack } from 'livekit-client';

type Props = {
  track: VideoTrack | null;
  mirror?: boolean;
  /** Screen share → contain; camera → cover. */
  objectFit?: 'cover' | 'contain';
  style?: StyleProp<ViewStyle>;
};

function applyVideoSurfaceStyles(
  el: HTMLVideoElement,
  objectFit: 'cover' | 'contain',
  mirror: boolean,
) {
  el.autoplay = true;
  el.muted = true;
  el.playsInline = true;
  el.setAttribute('playsinline', 'true');
  el.removeAttribute('width');
  el.removeAttribute('height');
  // Direct style props — avoid cssText + MutationObserver (that combo froze the tab).
  el.style.display = 'block';
  el.style.position = 'absolute';
  el.style.inset = '0';
  el.style.width = '100%';
  el.style.height = '100%';
  el.style.maxWidth = 'none';
  el.style.maxHeight = 'none';
  el.style.margin = '0';
  el.style.padding = '0';
  el.style.border = '0';
  el.style.background = '#000';
  el.style.objectFit = objectFit;
  el.style.objectPosition = 'center';
  el.style.transform = mirror ? 'scaleX(-1)' : 'none';
}

/** Web: attach LiveKit track to a muted <video> (audio stays on hidden audio nodes). */
export function CallVideoView({
  track,
  mirror = false,
  objectFit = 'cover',
  style,
}: Props) {
  const hostRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host || !track) {
      return;
    }
    const el = track.attach() as HTMLVideoElement;
    applyVideoSurfaceStyles(el, objectFit, mirror);
    const onReady = () => applyVideoSurfaceStyles(el, objectFit, mirror);
    el.addEventListener('loadedmetadata', onReady);
    el.addEventListener('playing', onReady);
    host.replaceChildren(el);
    void el.play?.().catch(() => {
      // autoplay policy — muted should usually allow it
    });
    return () => {
      el.removeEventListener('loadedmetadata', onReady);
      el.removeEventListener('playing', onReady);
      try {
        track.detach(el);
      } catch {
        // already detached
      }
      el.remove();
      host.replaceChildren();
    };
  }, [mirror, objectFit, track]);

  if (!track) {
    return null;
  }

  return (
    <View style={[styles.fill, style]} pointerEvents="none">
      {createElement('div', {
        ref: hostRef,
        style: {
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          overflow: 'hidden',
          background: '#000000',
        },
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  fill: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'hidden',
    backgroundColor: '#000000',
  },
});
