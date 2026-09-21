import { useEffect } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { AleMugs } from '@/components/rewards/AleMugs';
import { ensureRewardsFxStyles } from '@/components/rewards/rewards-fx';
import { DICE_SKINS, type DiceSkinId } from '@/data/rewards/catalog';

type Props = {
  visible: boolean;
  skinId: DiceSkinId;
};

export function DiceCritBurst({ visible, skinId }: Props) {
  if (!visible || skinId === 'standard') {
    return null;
  }
  return <Burst skinId={skinId} />;
}

function Burst({ skinId }: { skinId: DiceSkinId }) {
  const spec = DICE_SKINS[skinId];
  const scale = useSharedValue(0.2);
  const opacity = useSharedValue(0);

  useEffect(() => {
    if (Platform.OS === 'web') {
      ensureRewardsFxStyles();
    }
    scale.value = 0.2;
    opacity.value = 1;
    scale.value = withTiming(1.6, { duration: 900, easing: Easing.out(Easing.cubic) });
    opacity.value = withTiming(0, { duration: 900, easing: Easing.in(Easing.quad) });
  }, [opacity, scale, skinId]);

  const style = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  return (
    <View pointerEvents="none" style={styles.host}>
      {Platform.OS === 'web' ? (
        <View
          // @ts-expect-error web className
          className="adv-crit-burst">
          <View
            // @ts-expect-error web className
            className="adv-crit-core"
            style={{ backgroundColor: spec.accent, boxShadow: `0 0 48px ${spec.secondary}` } as object}
          />
          <View
            // @ts-expect-error web className
            className="adv-crit-ring"
            style={{ color: spec.secondary, borderColor: spec.secondary }}
          />
          {skinId === 'tavern_oak' ? <AleMugs variant="crit" /> : null}
        </View>
      ) : (
        <>
          <Animated.View style={[styles.nativeCore, { backgroundColor: spec.accent }, style]} />
          {skinId === 'tavern_oak' ? <AleMugs variant="crit" /> : null}
        </>
      )}
      <Text style={[styles.caption, { color: spec.secondary }]}>Критический успех</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  host: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 8,
  },
  nativeCore: {
    width: 120,
    height: 120,
    borderRadius: 60,
  },
  caption: {
    marginTop: 12,
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
});
