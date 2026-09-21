import { Image } from 'expo-image';
import { Platform, StyleSheet, View, type ViewStyle } from 'react-native';

import { cardMugHang } from '@/components/rewards/card-fx-layout';
import { webFxClass } from '@/components/rewards/rewards-fx';

const ALE_MUG = require('../../../assets/rewards/ale-mug.png');
const MUG_ASPECT = 256 / 322;

type Variant = 'frame' | 'card' | 'crit';

type Props = {
  size?: number;
  variant?: Variant;
};

function mugBox(size: number, variant: Variant) {
  let height: number;
  if (variant === 'crit') {
    height = 52;
  } else if (variant === 'card') {
    height = Math.max(40, size);
  } else if (size <= 36) {
    height = Math.max(16, Math.round(size * 0.5));
  } else {
    height = Math.max(20, Math.round(size * 0.4));
  }
  return { width: Math.round(height * MUG_ASPECT), height };
}

function mugPositions(variant: Variant, mug: { width: number; height: number }): { left: ViewStyle; right: ViewStyle } {
  if (variant === 'card') {
    // Hang mostly below the wood rim so footer badges stay readable.
    const hang = cardMugHang(mug.height);
    const side = -Math.round(mug.width * 0.12);
    return {
      left: { left: side, bottom: -hang },
      right: { right: side, bottom: -hang },
    };
  }
  if (variant === 'crit') {
    return {
      left: { left: '16%', top: '32%' },
      right: { right: '16%', top: '32%' },
    };
  }
  const side = -Math.round(mug.width * 0.18);
  return {
    left: { left: side, top: '52%' },
    right: { right: side, top: '52%' },
  };
}

export function AleMugs({ size = 52, variant = 'frame' }: Props) {
  const mug = mugBox(size, variant);
  const pos = mugPositions(variant, mug);
  const scale = size <= 36 ? ' is-mini' : size <= 56 ? ' is-compact' : '';
  const web = Platform.OS === 'web' ? webFxClass(`adv-mugs${scale}`) : null;

  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.layer]} {...web}>
      <View
        pointerEvents="none"
        {...(Platform.OS === 'web' ? webFxClass('adv-mug is-left') : null)}
        style={[styles.mug, mug, pos.left, Platform.OS !== 'web' ? styles.nativeTiltLeft : null]}>
        <Image source={ALE_MUG} style={[styles.image, styles.flip]} contentFit="contain" />
      </View>
      <View
        pointerEvents="none"
        {...(Platform.OS === 'web' ? webFxClass('adv-mug is-right') : null)}
        style={[styles.mug, mug, pos.right, Platform.OS !== 'web' ? styles.nativeTiltRight : null]}>
        <Image source={ALE_MUG} style={styles.image} contentFit="contain" />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  layer: {
    zIndex: 4,
    overflow: 'visible',
  },
  mug: {
    position: 'absolute',
    zIndex: 4,
    overflow: 'visible',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  flip: {
    transform: [{ scaleX: -1 }],
  },
  nativeTiltLeft: {
    transform: [{ rotate: '-10deg' }],
  },
  nativeTiltRight: {
    transform: [{ rotate: '10deg' }],
  },
});
