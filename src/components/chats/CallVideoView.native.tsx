import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { VideoView } from '@livekit/react-native';
import type { VideoTrack } from 'livekit-client';

type Props = {
  track: VideoTrack | null;
  mirror?: boolean;
  style?: StyleProp<ViewStyle>;
};

export function CallVideoView({ track, mirror = false, style }: Props) {
  if (!track) {
    return null;
  }

  return (
    <View style={[styles.fill, style]} pointerEvents="none">
      <VideoView
        videoTrack={track}
        mirror={mirror}
        objectFit="cover"
        style={styles.video}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  fill: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'hidden',
    backgroundColor: '#111214',
  },
  video: {
    width: '100%',
    height: '100%',
  },
});
