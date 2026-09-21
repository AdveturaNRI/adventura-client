import { useEffect, type ReactNode } from 'react';
import { Platform, StyleSheet, View, type ViewStyle } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { ensureRewardsFxStyles, webFxClass } from '@/components/rewards/rewards-fx';
import {
  displayedAuraId,
  QUESTIONNAIRE_AURAS,
  type QuestionnaireAuraId,
  type RewardBadgeType,
} from '@/data/rewards/catalog';

type Props = {
  auraId?: QuestionnaireAuraId | null;
  badges?: RewardBadgeType[] | null;
};

function Layer({ className, style }: { className: string; style?: ViewStyle }) {
  return <View pointerEvents="none" {...webFxClass(className)} style={[styles.abs, style]} />;
}

function Bits({
  className,
  count,
  mode = 'scatter',
}: {
  className: string;
  count: number;
  mode?: 'scatter' | 'fall' | 'rise';
}) {
  return (
    <>
      {Array.from({ length: count }, (_, i) => {
        const left = (i * 37 + 7) % 98;
        const top =
          mode === 'fall' ? -14 - (i % 16) * 6 : mode === 'rise' ? 88 + (i % 10) * 5 : (i * 53 + 9) % 94;
        return (
          <View
            key={`${className}-${i}`}
            pointerEvents="none"
            {...webFxClass(className)}
            style={[
              styles.abs,
              {
                left: `${left}%`,
                top: `${top}%`,
                animationDelay: `${-(i * 0.11)}s`,
              } as ViewStyle,
            ]}
          />
        );
      })}
    </>
  );
}

export function QuestionnaireAura({ auraId, badges }: Props) {
  const resolved = displayedAuraId(badges ?? [], auraId);
  if (resolved === 'none') {
    return null;
  }
  if (Platform.OS === 'web') {
    return <WebAura key={resolved} id={resolved} />;
  }
  return <NativeAura id={resolved} />;
}

function WebAura({ id }: { id: Exclude<QuestionnaireAuraId, 'none'> }) {
  ensureRewardsFxStyles();
  useEffect(() => {
    ensureRewardsFxStyles();
  }, []);

  return (
    <View pointerEvents="none" style={styles.host} {...webFxClass(`adv-aura adv-aura--${id}`)}>
      {renderAuraLayers(id)}
    </View>
  );
}

function NativeAura({ id }: { id: Exclude<QuestionnaireAuraId, 'none'> }) {
  const drift = useSharedValue(0);
  useEffect(() => {
    drift.value = withRepeat(withTiming(1, { duration: 4200, easing: Easing.inOut(Easing.quad) }), -1, true);
  }, [drift]);
  const style = useAnimatedStyle(() => ({
    opacity: 0.16 + drift.value * 0.12,
  }));

  return (
    <Animated.View
      pointerEvents="none"
      style={[StyleSheet.absoluteFill, style, { backgroundColor: `${QUESTIONNAIRE_AURAS[id].accent}33` }]}
    />
  );
}

function renderAuraLayers(id: Exclude<QuestionnaireAuraId, 'none'>): ReactNode {
  switch (id) {
    case 'aurora':
      return (
        <>
          <Layer className="adv-aura-blob" style={{ top: '-12%', left: '-10%', backgroundColor: 'rgba(232,195,106,0.5)' }} />
          <Layer className="adv-aura-blob alt" style={{ bottom: '-8%', right: '-6%', backgroundColor: 'rgba(57,243,255,0.28)' }} />
          <Bits className="adv-aura-spark gold" count={42} />
          <Bits className="adv-aura-spark pale" count={18} />
        </>
      );
    case 'neon_grid':
      return (
        <>
          <Layer className="adv-aura-grid" />
          <Layer className="adv-aura-scan" />
          <Bits className="adv-aura-spark cyan" count={28} />
          <Bits className="adv-aura-spark prism" count={12} />
        </>
      );
    case 'void_runes':
      return (
        <>
          <Layer className="adv-aura-blob" style={{ top: '8%', left: '16%', backgroundColor: 'rgba(124,58,237,0.46)' }} />
          <Layer className="adv-aura-runes" />
          <Layer className="adv-aura-runes inner" />
          <Bits className="adv-ember" count={36} mode="rise" />
          <Bits className="adv-aura-spark prism" count={14} />
        </>
      );
    case 'sakura_mist':
      return (
        <>
          <Layer className="adv-aura-blob" style={{ top: '-14%', right: '-8%', backgroundColor: 'rgba(244,114,182,0.46)' }} />
          <Layer className="adv-aura-blob alt" style={{ bottom: '-10%', left: '-6%', backgroundColor: 'rgba(251,207,232,0.34)' }} />
          <Bits className="adv-aura-petal" count={64} mode="fall" />
          <Bits className="adv-aura-spark rose" count={16} />
        </>
      );
    case 'storm_veil':
      return (
        <>
          <Layer className="adv-aura-rain" />
          <Layer className="adv-aura-flash" />
          <Bits className="adv-aura-drop" count={54} mode="fall" />
          <Bits className="adv-aura-bolt" count={8} />
          <Bits className="adv-aura-spark cyan" count={14} />
        </>
      );
    case 'blood_haze':
      return (
        <>
          <Layer className="adv-aura-vignette" />
          <Layer className="adv-aura-blob" style={{ bottom: '-16%', left: '18%', backgroundColor: 'rgba(225,29,72,0.42)' }} />
          <Bits className="adv-aura-drop blood" count={38} mode="fall" />
          <Bits className="adv-aura-spark rose" count={22} />
        </>
      );
    case 'prism_shift':
      return (
        <>
          <Layer className="adv-aura-foil" />
          <Layer className="adv-aura-foil alt" />
          <Bits className="adv-aura-shard" count={36} mode="fall" />
          <Bits className="adv-aura-spark prism" count={28} />
        </>
      );
    case 'pixel_rain':
      return (
        <>
          <Layer className="adv-aura-matrix" />
          <Bits className="adv-aura-glyph" count={48} mode="fall" />
          <Bits className="adv-aura-spark lime" count={12} />
        </>
      );
    case 'forest_glow':
      return (
        <>
          <Layer className="adv-aura-blob" style={{ bottom: '-14%', left: '-6%', backgroundColor: 'rgba(163,230,53,0.32)' }} />
          <Bits className="adv-aura-leaf" count={32} mode="fall" />
          <Bits className="adv-aura-firefly" count={44} />
        </>
      );
    case 'tide_caustic':
      return (
        <>
          <Layer className="adv-aura-caustic" />
          <Layer className="adv-aura-caustic alt" />
          <Bits className="adv-aura-bubble" count={40} mode="rise" />
          <Bits className="adv-aura-spark cyan" count={16} />
        </>
      );
    case 'ghost_fog':
      return (
        <>
          <Layer className="adv-aura-fog" />
          <Layer className="adv-aura-fog alt" />
          <Layer className="adv-aura-fog late" />
          <Bits className="adv-aura-spark pale" count={36} />
          <Bits className="adv-aura-wisp" count={18} />
        </>
      );
    case 'magma_flow':
      return (
        <>
          <Layer className="adv-aura-magma" />
          <Layer className="adv-aura-magma alt" />
          <Bits className="adv-ember magma" count={40} mode="rise" />
          <Bits className="adv-aura-spark gold" count={16} />
        </>
      );
    case 'star_field':
      return (
        <>
          <Bits className="adv-aura-spark gold" count={52} />
          <Bits className="adv-aura-spark pale" count={28} />
          <Bits className="adv-aura-star" count={18} />
        </>
      );
    case 'oak_shield':
      return (
        <>
          <Layer className="adv-aura-wood" />
          <Layer
            className="adv-aura-blob"
            style={{ bottom: '-16%', left: '18%', backgroundColor: 'rgba(196,122,58,0.42)' }}
          />
          <Layer
            className="adv-aura-blob alt"
            style={{ top: '-10%', right: '-4%', backgroundColor: 'rgba(246,226,179,0.22)' }}
          />
          <Bits className="adv-ember oak" count={22} mode="rise" />
          <Bits className="adv-aura-foam" count={16} mode="rise" />
          <Bits className="adv-aura-spark gold" count={14} />
        </>
      );
  }
}

const styles = StyleSheet.create({
  host: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'hidden',
    pointerEvents: 'none',
  },
  abs: {
    position: 'absolute',
  },
});
