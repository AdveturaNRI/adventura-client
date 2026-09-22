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
import { ensureRewardsFxStyles, webFxClass } from '@/components/rewards/rewards-fx';
import {
  AVATAR_FRAMES,
  displayedFrameId,
  isStaticAvatarFrame,
  type AvatarFrameId,
  type RewardBadgeType,
} from '@/data/rewards/catalog';

type Props = {
  size: number;
  badges?: RewardBadgeType[] | null;
  frameId?: AvatarFrameId | null;
  children: ReactNode;
};

function OrbitBits({
  className,
  count,
  duration = 8,
  ring = 'outer',
  reverse = false,
}: {
  className: string;
  count: number;
  duration?: number;
  ring?: 'outer' | 'inner';
  reverse?: boolean;
}) {
  return (
    <>
      {Array.from({ length: count }, (_, i) => (
        <View
          key={`${className}-${ring}-${i}`}
          pointerEvents="none"
          {...webFxClass(
            `${className} adv-fx-spoke${ring === 'inner' ? ' is-inner' : ''}${reverse ? ' is-rev' : ''}`,
          )}
          style={{
            position: 'absolute',
            left: '50%',
            top: '50%',
            width: ring === 'inner' ? '36%' : '47%',
            height: 0,
            overflow: 'visible',
            transformOrigin: '0px 0px',
            animationDelay: `${-((i / count) * duration)}s`,
            animationDuration: `${duration}s`,
          }}
        />
      ))}
    </>
  );
}

function orbitCount(full: number, size: number) {
  if (size <= 36) {
    return Math.max(4, Math.round(full * 0.28));
  }
  if (size <= 56) {
    return Math.max(6, Math.round(full * 0.5));
  }
  return full;
}

function FrameExtras({ id, size }: { id: Exclude<AvatarFrameId, 'none'>; size: number }) {
  const mini = size <= 36;
  switch (id) {
    case 'sakura_fall':
      return (
        <>
          <OrbitBits className="adv-fx-petal" count={orbitCount(16, size)} duration={9} />
          {mini ? null : <OrbitBits className="adv-fx-petal" count={10} duration={13} ring="inner" reverse />}
        </>
      );
    case 'storm_arc':
      return (
        <>
          <View pointerEvents="none" {...webFxClass('adv-fx-bolt')} style={StyleSheet.absoluteFill} />
          {mini ? null : <View pointerEvents="none" {...webFxClass('adv-fx-bolt alt')} style={StyleSheet.absoluteFill} />}
          {mini ? null : <View pointerEvents="none" {...webFxClass('adv-fx-bolt late')} style={StyleSheet.absoluteFill} />}
          <OrbitBits className="adv-fx-star cyan" count={orbitCount(12, size)} />
        </>
      );
    case 'blood_moon':
      return (
        <>
          <View pointerEvents="none" {...webFxClass('adv-fx-eclipse')} style={StyleSheet.absoluteFill} />
          <OrbitBits className="adv-fx-star rose" count={orbitCount(14, size)} />
        </>
      );
    case 'prism_halo':
      return (
        <>
          <View pointerEvents="none" {...webFxClass('adv-fx-foil')} style={StyleSheet.absoluteFill} />
          <OrbitBits className="adv-fx-star prism" count={orbitCount(16, size)} />
        </>
      );
    case 'pixel_spark':
      return <OrbitBits className="adv-fx-pixel" count={orbitCount(18, size)} duration={5.2} />;
    case 'leaf_crown':
      return (
        <>
          <OrbitBits className="adv-fx-leaf" count={orbitCount(14, size)} duration={11} />
          {mini ? null : <OrbitBits className="adv-fx-leaf" count={8} duration={16} ring="inner" reverse />}
        </>
      );
    case 'tide_ring':
      return (
        <>
          <View pointerEvents="none" {...webFxClass('adv-fx-wave')} style={StyleSheet.absoluteFill} />
          {mini ? null : (
            <View pointerEvents="none" {...webFxClass('adv-fx-wave alt')} style={StyleSheet.absoluteFill} />
          )}
          <OrbitBits className="adv-fx-star cyan" count={orbitCount(14, size)} />
        </>
      );
    case 'ghost_veil':
      return (
        <>
          <View pointerEvents="none" {...webFxClass('adv-fx-mist')} style={StyleSheet.absoluteFill} />
          {mini ? null : (
            <View pointerEvents="none" {...webFxClass('adv-fx-mist alt')} style={StyleSheet.absoluteFill} />
          )}
          <OrbitBits className="adv-fx-star pale" count={orbitCount(14, size)} />
        </>
      );
    case 'copper_gear':
      return (
        <>
          <View pointerEvents="none" {...webFxClass('adv-fx-gear')} style={StyleSheet.absoluteFill} />
          <View pointerEvents="none" {...webFxClass('adv-fx-gear inner')} style={StyleSheet.absoluteFill} />
          <OrbitBits className="adv-fx-star gold" count={orbitCount(8, size)} />
        </>
      );
    case 'star_orbit':
      return <OrbitBits className="adv-fx-star gold" count={orbitCount(26, size)} />;
    case 'solar_flare':
      return <OrbitBits className="adv-fx-star gold" count={orbitCount(16, size)} />;
    case 'frost_ring':
      return (
        <>
          <OrbitBits className="adv-fx-star cyan" count={orbitCount(12, size)} duration={9} />
          {mini ? null : (
            <OrbitBits className="adv-fx-star cyan" count={8} duration={14} ring="inner" reverse />
          )}
        </>
      );
    case 'hex_circuit':
      return <OrbitBits className="adv-fx-pixel teal" count={orbitCount(16, size)} />;
    case 'void_orbit':
      return <OrbitBits className="adv-fx-star prism" count={orbitCount(18, size)} />;
    case 'alpha_runes':
      return <OrbitBits className="adv-fx-star gold" count={orbitCount(12, size)} />;
    case 'neon_scan':
      return <OrbitBits className="adv-fx-star cyan" count={orbitCount(12, size)} />;
    case 'founding_embers':
      return <OrbitBits className="adv-fx-star rose" count={orbitCount(12, size)} />;
    case 'oak_tankard':
      return <OakHoop size={size} />;
    default:
      return null;
  }
}

function OakHoop({ size }: { size: number }) {
  const rivets = orbitCount(10, size);
  const mini = size <= 36;
  return (
    <>
      <View pointerEvents="none" {...webFxClass('adv-fx-grain')} style={StyleSheet.absoluteFill} />
      {mini ? null : (
        <View pointerEvents="none" {...webFxClass('adv-fx-hearth')} style={StyleSheet.absoluteFill} />
      )}
      {Array.from({ length: rivets }, (_, i) => (
        <View
          key={`oak-rivet-${i}`}
          pointerEvents="none"
          {...webFxClass('adv-fx-rivet adv-fx-spoke')}
          style={{
            position: 'absolute',
            left: '50%',
            top: '50%',
            width: '47%',
            height: 0,
            overflow: 'visible',
            transformOrigin: '0px 0px',
            transform: [{ rotate: `${(i / rivets) * 360}deg` }],
          }}
        />
      ))}
      <OrbitBits className="adv-fx-star gold" count={orbitCount(12, size)} duration={11} />
    </>
  );
}

export function avatarFramePad(size: number) {
  return Math.max(8, Math.round(size * 0.11));
}

export function avatarFrameOuterSize(size: number) {
  return size + avatarFramePad(size) * 2;
}

export function AvatarFrame({ size, badges, frameId, children }: Props) {
  const resolved = displayedFrameId(badges ?? [], frameId);
  if (resolved === 'none') {
    return <>{children}</>;
  }

  const box = avatarFrameOuterSize(size);

  return (
    <View style={{ width: box, height: box, alignItems: 'center', justifyContent: 'center', overflow: 'visible' }}>
      {Platform.OS === 'web' ? (
        <WebFrame key={resolved} id={resolved} size={size} />
      ) : (
        <NativeFrame id={resolved} size={box} />
      )}
      <View style={{ width: size, height: size, borderRadius: size / 2, overflow: 'hidden', zIndex: 1 }}>
        {children}
      </View>
      {resolved === 'oak_tankard' ? <AleMugs size={size} variant="frame" /> : null}
    </View>
  );
}

function WebFrame({ id, size }: { id: Exclude<AvatarFrameId, 'none'>; size: number }) {
  ensureRewardsFxStyles();
  useEffect(() => {
    ensureRewardsFxStyles();
  }, []);

  const staticFrame = isStaticAvatarFrame(id);
  const scale = size <= 36 ? ' is-mini' : size <= 56 ? ' is-compact' : '';

  return (
    <View
      pointerEvents="none"
      style={[StyleSheet.absoluteFill, { overflow: 'visible' }]}
      {...webFxClass(`adv-fx adv-fx--${id}${staticFrame ? ' is-static' : ''}${scale}`)}>
      <View {...webFxClass('adv-fx-glow')} />
      <View {...webFxClass('adv-fx-track')} />
      {staticFrame ? null : (
        <View {...webFxClass('adv-fx-spin')}>
          <View {...webFxClass('adv-fx-conic')} />
        </View>
      )}
      <FrameExtras id={id} size={size} />
      <View {...webFxClass('adv-fx-rim')} />
    </View>
  );
}

function NativeFrame({ id, size }: { id: Exclude<AvatarFrameId, 'none'>; size: number }) {
  const pulse = useSharedValue(0.55);
  const accent = AVATAR_FRAMES[id].accent;
  const staticFrame = isStaticAvatarFrame(id);

  useEffect(() => {
    if (staticFrame) {
      return;
    }
    pulse.value = withRepeat(withTiming(1, { duration: 2800, easing: Easing.inOut(Easing.quad) }), -1, true);
  }, [pulse, staticFrame]);

  const pulseStyle = useAnimatedStyle(() => ({
    opacity: staticFrame ? 0.85 : 0.4 + pulse.value * 0.35,
  }));

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        StyleSheet.absoluteFill,
        pulseStyle,
        {
          borderRadius: size / 2,
          borderWidth: staticFrame ? 2.5 : 3,
          borderColor: accent,
        },
      ]}
    />
  );
}
