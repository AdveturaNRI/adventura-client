import { Image } from 'expo-image';
import { useEffect, type ReactNode } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { AleMugs } from '@/components/rewards/AleMugs';
import {
  CARD_FX_MUG_SIZE_NARROW,
  CARD_FX_MUG_SIZE_WIDE,
} from '@/components/rewards/card-fx-layout';
import { QuestionnaireAura } from '@/components/rewards/QuestionnaireAura';
import { ensureRewardsFxStyles, webFxClass } from '@/components/rewards/rewards-fx';
import {
  displayedAuraId,
  QUESTIONNAIRE_AURAS,
  type QuestionnaireAuraId,
  type RewardBadgeType,
} from '@/data/rewards/catalog';

export {
  CARD_FX_MUG_SIZE_NARROW,
  CARD_FX_MUG_SIZE_WIDE,
  cardMugHang,
  getCardFxOverhang,
  type CardFxOverhang,
} from '@/components/rewards/card-fx-layout';

type Props = {
  auraId?: QuestionnaireAuraId | null;
  badges?: RewardBadgeType[] | null;
  radius?: number;
  /** Cover children with particles. Off for анкеты — только кайма, фото само рисует ауру. */
  overlay?: boolean;
  style?: object;
  children: ReactNode;
};

export function QuestionnaireHighlight({
  auraId,
  badges,
  radius = 16,
  overlay = true,
  style,
  children,
}: Props) {
  const resolved = displayedAuraId(badges ?? [], auraId);
  if (resolved === 'none') {
    return style ? <View style={style}>{children}</View> : <>{children}</>;
  }

  if (Platform.OS === 'web') {
    return (
      <WebCardFx key={resolved} id={resolved} radius={radius} overlay={overlay} style={style}>
        {children}
      </WebCardFx>
    );
  }

  return (
    <NativeCardFx id={resolved} radius={radius} style={style}>
      {children}
    </NativeCardFx>
  );
}

function WebCardFx({
  id,
  radius,
  overlay,
  style,
  children,
}: {
  id: Exclude<QuestionnaireAuraId, 'none'>;
  radius: number;
  overlay: boolean;
  style?: object;
  children: ReactNode;
}) {
  ensureRewardsFxStyles();
  useEffect(() => {
    ensureRewardsFxStyles();
  }, []);

  const wide = !overlay;

  return (
    <View
      style={[{ position: 'relative', borderRadius: radius, overflow: 'visible' }, style]}
      {...webFxClass(`adv-card-fx adv-card-fx--${id}${wide ? ' is-wide' : ''}`)}>
      {id === 'void_runes' ? <FoundingDragonPeek wide={wide} /> : null}
      <View pointerEvents="none" {...webFxClass('adv-card-fx-glow')} style={styles.fxLayer} />
      <View
        pointerEvents="none"
        {...webFxClass('adv-card-fx-clip')}
        style={[
          styles.fxLayer,
          { overflow: 'hidden', borderRadius: overlay ? radius + 3 : radius + 10 },
        ]}>
        <View {...webFxClass('adv-card-fx-conic')} />
      </View>
      <View
        {...webFxClass('adv-card-fx-body')}
        style={[styles.fxBody, { borderRadius: radius }]}>
        {children}
        {overlay ? <QuestionnaireAura auraId={id} /> : null}
      </View>
      {id === 'oak_shield' ? <OakCardExtras wide={wide} /> : null}
    </View>
  );
}

const SHIELD_RIVETS = [
  { top: 3, left: 6 },
  { top: 3, right: 6 },
  { bottom: 5, left: 6 },
  { bottom: 5, right: 6 },
] as const;

const FOUNDING_DRAGON = require('../../../assets/rewards/founding-dragon.png');
const DRAGON_ASPECT = 320 / 328;

function FoundingDragonPeek({ wide }: { wide: boolean }) {
  const width = wide ? 188 : 108;
  return (
    <View
      pointerEvents="none"
      {...webFxClass('adv-founding-dragon')}
      style={{
        position: 'absolute',
        zIndex: 0,
        width,
        height: Math.round(width / DRAGON_ASPECT),
        right: wide ? -28 : -8,
        top: wide ? -122 : -58,
      }}>
      <Image source={FOUNDING_DRAGON} style={{ width: '100%', height: '100%' }} contentFit="contain" />
    </View>
  );
}

function OakCardExtras({ wide }: { wide: boolean }) {
  return (
    <>
      <View pointerEvents="none" {...webFxClass('adv-card-shield')} style={StyleSheet.absoluteFill} />
      {SHIELD_RIVETS.map((pos, index) => (
        <View
          key={`rivet-${index}`}
          pointerEvents="none"
          {...webFxClass('adv-card-rivet')}
          style={{ position: 'absolute', ...pos }}
        />
      ))}
      <AleMugs variant="card" size={wide ? CARD_FX_MUG_SIZE_WIDE : CARD_FX_MUG_SIZE_NARROW} />
    </>
  );
}

const styles = StyleSheet.create({
  fxLayer: {
    position: 'absolute',
  },
  fxBody: {
    position: 'relative',
    zIndex: 1,
    overflow: 'hidden',
    width: '100%',
    height: '100%',
  },
});

function NativeCardFx({
  id,
  radius,
  style,
  children,
}: {
  id: Exclude<QuestionnaireAuraId, 'none'>;
  radius: number;
  style?: object;
  children: ReactNode;
}) {
  const pulse = useSharedValue(0.5);
  useEffect(() => {
    pulse.value = withRepeat(withTiming(1, { duration: 1600, easing: Easing.inOut(Easing.quad) }), -1, true);
  }, [pulse]);
  const glow = useAnimatedStyle(() => ({
    opacity: 0.22 + pulse.value * 0.2,
  }));
  const color = QUESTIONNAIRE_AURAS[id].accent;

  return (
    <View style={[{ position: 'relative', borderRadius: radius }, style]}>
      <Animated.View
        pointerEvents="none"
        style={[
          StyleSheet.absoluteFill,
          glow,
          {
            borderRadius: radius,
            borderWidth: 3,
            borderColor: color,
          },
        ]}
      />
      {children}
    </View>
  );
}
