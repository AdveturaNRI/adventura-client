import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  ActivityIndicator,
  Animated,
  Easing,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
  type GestureResponderEvent,
  type LayoutChangeEvent,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useIsDesktopWeb } from '@/components/navigation/DesktopThemeToggle';
import { avatarFrameOuterSize } from '@/components/rewards/AvatarFrame';
import { NameWithBadges } from '@/components/rewards/RewardBadge';
import { UserAvatar } from '@/components/navigation/UserAvatar';
import type { RewardBadgeType } from '@/data/rewards/catalog';
import { VoiceCallDiceLayer } from '@/components/chats/VoiceCallDiceLayer';
import { CallBardSheet } from '@/components/chats/CallBardSheet';
import type { CallMusicQueueEntry } from '@/hooks/use-call-shared-music';
import { CallVideoView } from '@/components/chats/CallVideoView';
import { FontSize, Radius, Spacing } from '@/constants/theme';
import { useProfile } from '@/context/ProfileContext';
import type { ChatLiveVoiceParticipant, ChatLiveVoiceStatus } from '@/hooks/use-chat-live-voice';
import type { VideoTrack } from 'livekit-client';

export const BARD_TILE_KEY = 'bard';

type OverlayTile = {
  key: string;
  name: string;
  avatarUrl: string | null;
  speaking: boolean;
  muted: boolean;
  cameraOn: boolean;
  videoTrack: VideoTrack | null;
  isLocal: boolean;
  waiting?: boolean;
  /** Accepted, still joining LiveKit. */
  connecting?: boolean;
  urgent?: boolean;
  badges?: RewardBadgeType[];
  frameId?: string | null;
  /** Local playback gain 0…1 (remote only). */
  volume?: number;
  isBard?: boolean;
  bardPlaque?: string | null;
  bardPlaying?: boolean;
  /** Local track buffering — spinner around Bard avatar. */
  bardLoading?: boolean;
};

export type VoiceCallWaitingPeer = {
  id: string;
  name: string;
  avatarUrl: string | null;
  connecting?: boolean;
};

type Props = {
  visible: boolean;
  minimized?: boolean;
  title: string;
  isGroup?: boolean;
  status: ChatLiveVoiceStatus;
  ringing?: boolean;
  error: string | null;
  muted: boolean;
  deafened: boolean;
  cameraOn?: boolean;
  participants: ChatLiveVoiceParticipant[];
  /** Members still being rung / not yet in LiveKit. */
  waitingPeers?: VoiceCallWaitingPeer[];
  /** identity → urgent flag (sticky until sender clears) */
  urgentById?: Record<string, boolean>;
  /** Local playback gain per remote identity (0…1). */
  volumeById?: Record<string, number>;
  /** Chat to post dice rolls into (same conversation as the call). */
  conversationId?: string | null;
  diceSenderNickname?: string;
  onToggleMute: () => void;
  /** Web: start getUserMedia while finger is down (unmute / retry). */
  onMicGesture?: () => void;
  onToggleDeafen: () => void;
  onToggleCamera?: () => void;
  onHangup: () => void;
  onRetry?: () => void;
  onMinimize?: () => void;
  onExpand?: () => void;
  onUrgentRequest?: () => void;
  onSetParticipantVolume?: (identity: string, volume: number) => void;
  canControlMusic?: boolean;
  bardPresent?: boolean;
  bardTrackTitle?: string | null;
  bardPlaying?: boolean;
  bardLoading?: boolean;
  bardTrackId?: string | null;
  bardCurrentEntryId?: string | null;
  bardQueue?: CallMusicQueueEntry[];
  bardPositionSec?: number;
  bardDurationSec?: number;
  bardLocalVolume?: number;
  bardGlobalVolume?: number;
  bardLocalDisplayName?: string;
  onSummonBard?: () => void;
  onDismissBard?: () => void;
  onSetBardLocalVolume?: (volume: number) => void;
  onEnqueueBardTrack?: (
    trackId: string,
    title: string,
    durationSec: number | null,
    playUrl?: string | null,
  ) => void;
  onPlayBardQueueEntry?: (entryId: string) => void;
  onRemoveBardQueueEntry?: (entryId: string) => void;
  onToggleBardPlay?: () => void;
  onSeekBard?: (positionSec: number) => void;
  onStopBardTrack?: () => void;
  onSetBardGlobalVolume?: (volume: number) => void;
  onRequestBardSync?: () => void;
  /** Unlock + retry Bard audio (web autoplay) from a user gesture. */
  onResumeBardAudio?: () => void;
};

/** Survives expand/collapse while the call is up. */
let savedMiniOffset = { x: 0, y: 0 };

function clampMiniOffset(
  offset: { x: number; y: number },
  viewport: { width: number; height: number },
  bar: { width: number; height: number },
  anchor: { right: number; bottom: number },
) {
  const margin = 8;
  const minX = margin - (viewport.width - bar.width - anchor.right);
  const maxX = Math.max(minX, anchor.right - margin);
  const minY = margin - (viewport.height - bar.height - anchor.bottom);
  const maxY = Math.max(minY, anchor.bottom - margin);
  return {
    x: Math.min(maxX, Math.max(minX, offset.x)),
    y: Math.min(maxY, Math.max(minY, offset.y)),
  };
}

function formatCallDuration(totalSec: number) {
  const safe = Math.max(0, Math.floor(totalSec));
  const h = Math.floor(safe / 3600);
  const m = Math.floor((safe % 3600) / 60);
  const s = safe % 60;
  if (h > 0) {
    return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }
  return `${m}:${String(s).padStart(2, '0')}`;
}

function WaitingPulseRings({ size }: { size: number }) {
  const pulseA = useRef(new Animated.Value(0)).current;
  const pulseB = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const makeLoop = (value: Animated.Value, delayMs: number) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(delayMs),
          Animated.timing(value, {
            toValue: 1,
            duration: 1600,
            easing: Easing.out(Easing.quad),
            useNativeDriver: true,
          }),
          Animated.timing(value, {
            toValue: 0,
            duration: 0,
            useNativeDriver: true,
          }),
        ]),
      );

    const loopA = makeLoop(pulseA, 0);
    const loopB = makeLoop(pulseB, 800);
    loopA.start();
    loopB.start();
    return () => {
      loopA.stop();
      loopB.stop();
      pulseA.setValue(0);
      pulseB.setValue(0);
    };
  }, [pulseA, pulseB]);

  const ringStyle = (value: Animated.Value) => ({
    width: size,
    height: size,
    borderRadius: size / 2,
    opacity: value.interpolate({
      inputRange: [0, 0.15, 1],
      outputRange: [0.55, 0.35, 0],
    }),
    transform: [
      {
        scale: value.interpolate({
          inputRange: [0, 1],
          outputRange: [1, 1.55],
        }),
      },
    ],
  });

  return (
    <View pointerEvents="none" style={[styles.pulseLayer, { width: size, height: size }]}>
      <Animated.View style={[styles.pulseRing, ringStyle(pulseA)]} />
      <Animated.View style={[styles.pulseRing, ringStyle(pulseB)]} />
    </View>
  );
}

function UrgentPulseRings({ size }: { size: number }) {
  const pulseA = useRef(new Animated.Value(0)).current;
  const pulseB = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const makeLoop = (value: Animated.Value, delayMs: number) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(delayMs),
          Animated.timing(value, {
            toValue: 1,
            duration: 900,
            easing: Easing.out(Easing.quad),
            useNativeDriver: true,
          }),
          Animated.timing(value, {
            toValue: 0,
            duration: 0,
            useNativeDriver: true,
          }),
        ]),
      );

    const loopA = makeLoop(pulseA, 0);
    const loopB = makeLoop(pulseB, 450);
    loopA.start();
    loopB.start();
    return () => {
      loopA.stop();
      loopB.stop();
      pulseA.setValue(0);
      pulseB.setValue(0);
    };
  }, [pulseA, pulseB]);

  const ringStyle = (value: Animated.Value) => ({
    width: size,
    height: size,
    borderRadius: size / 2,
    opacity: value.interpolate({
      inputRange: [0, 0.12, 1],
      outputRange: [0.7, 0.4, 0],
    }),
    transform: [
      {
        scale: value.interpolate({
          inputRange: [0, 1],
          outputRange: [1, 1.65],
        }),
      },
    ],
  });

  return (
    <View pointerEvents="none" style={[styles.pulseLayer, { width: size, height: size }]}>
      <Animated.View style={[styles.urgentPulseRing, ringStyle(pulseA)]} />
      <Animated.View style={[styles.urgentPulseRing, ringStyle(pulseB)]} />
    </View>
  );
}

/** Soft blue pulse + border shimmer while Bard is playing. */
function BardPlayingAura({ size, active }: { size: number; active: boolean }) {
  const pulseA = useRef(new Animated.Value(0)).current;
  const pulseB = useRef(new Animated.Value(0)).current;
  const shimmer = useRef(new Animated.Value(0)).current;
  const breath = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!active) {
      pulseA.setValue(0);
      pulseB.setValue(0);
      shimmer.setValue(0);
      breath.setValue(0);
      return;
    }

    const makePulse = (value: Animated.Value, delayMs: number) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(delayMs),
          Animated.timing(value, {
            toValue: 1,
            duration: 1400,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }),
          Animated.timing(value, {
            toValue: 0,
            duration: 0,
            useNativeDriver: true,
          }),
        ]),
      );

    const shimmerLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(shimmer, {
          toValue: 1,
          duration: 700,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(shimmer, {
          toValue: 0,
          duration: 700,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ]),
    );

    const breathLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(breath, {
          toValue: 1,
          duration: 1100,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(breath, {
          toValue: 0,
          duration: 1100,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
    );

    const loopA = makePulse(pulseA, 0);
    const loopB = makePulse(pulseB, 700);
    loopA.start();
    loopB.start();
    shimmerLoop.start();
    breathLoop.start();
    return () => {
      loopA.stop();
      loopB.stop();
      shimmerLoop.stop();
      breathLoop.stop();
      pulseA.setValue(0);
      pulseB.setValue(0);
      shimmer.setValue(0);
      breath.setValue(0);
    };
  }, [active, breath, pulseA, pulseB, shimmer]);

  if (!active) {
    return null;
  }

  const ringStyle = (value: Animated.Value) => ({
    width: size,
    height: size,
    borderRadius: size / 2,
    opacity: value.interpolate({
      inputRange: [0, 0.2, 1],
      outputRange: [0.5, 0.28, 0],
    }),
    transform: [
      {
        scale: value.interpolate({
          inputRange: [0, 1],
          outputRange: [1, 1.48],
        }),
      },
    ],
  });

  return (
    <View pointerEvents="none" style={[styles.pulseLayer, { width: size, height: size }]}>
      <Animated.View style={[styles.bardPulseRing, ringStyle(pulseA)]} />
      <Animated.View style={[styles.bardPulseRing, ringStyle(pulseB)]} />
      <Animated.View
        style={[
          styles.bardShimmerRing,
          {
            width: size,
            height: size,
            borderRadius: size / 2,
            opacity: shimmer.interpolate({
              inputRange: [0, 1],
              outputRange: [0.35, 0.95],
            }),
            transform: [
              {
                scale: breath.interpolate({
                  inputRange: [0, 1],
                  outputRange: [1, 1.04],
                }),
              },
            ],
          },
        ]}
      />
      <Animated.View
        style={[
          styles.bardCoreGlow,
          {
            width: size * 0.72,
            height: size * 0.72,
            borderRadius: (size * 0.72) / 2,
            opacity: breath.interpolate({
              inputRange: [0, 1],
              outputRange: [0.22, 0.42],
            }),
            transform: [
              {
                scale: breath.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0.92, 1.06],
                }),
              },
            ],
          },
        ]}
      />
    </View>
  );
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) {
    return 1;
  }
  return Math.min(1, Math.max(0, value));
}

function volumeIconName(value: number): 'volume-mute' | 'volume-low' | 'volume-medium' | 'volume-high' {
  if (value < 0.02) {
    return 'volume-mute';
  }
  if (value < 0.34) {
    return 'volume-low';
  }
  if (value < 0.67) {
    return 'volume-medium';
  }
  return 'volume-high';
}

/** Compact glass volume dock — horizontal on wide tiles, vertical on narrow. */
function ParticipantVolumeDock({
  value,
  onChange,
  orientation,
  participantName,
  caption,
}: {
  value: number;
  onChange: (next: number) => void;
  orientation: 'horizontal' | 'vertical';
  participantName: string;
  /** Visible Discord-style label above the slider. */
  caption?: string;
}) {
  const trackSizeRef = useRef({ width: 1, height: 1 });
  const [dragging, setDragging] = useState(false);
  const beforeMuteRef = useRef(1);
  const appear = useRef(new Animated.Value(0)).current;
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const valueRef = useRef(value);
  valueRef.current = value;

  useEffect(() => {
    appear.setValue(0);
    Animated.spring(appear, {
      toValue: 1,
      friction: 7,
      tension: 120,
      useNativeDriver: true,
    }).start();
  }, [appear]);

  const applyFromLocal = (locationX: number, locationY: number) => {
    const { width, height } = trackSizeRef.current;
    let next: number;
    if (orientation === 'vertical') {
      next = 1 - locationY / Math.max(1, height);
    } else {
      next = locationX / Math.max(1, width);
    }
    if (!Number.isFinite(next)) {
      return;
    }
    onChangeRef.current(Math.min(1, Math.max(0, next)));
  };

  const onTrackLayout = (event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    trackSizeRef.current = {
      width: Math.max(1, width),
      height: Math.max(1, height),
    };
  };

  const onGrant = (event: GestureResponderEvent) => {
    setDragging(true);
    applyFromLocal(event.nativeEvent.locationX, event.nativeEvent.locationY);
  };

  const onMove = (event: GestureResponderEvent) => {
    applyFromLocal(event.nativeEvent.locationX, event.nativeEvent.locationY);
  };

  const onRelease = () => {
    setDragging(false);
  };

  const muted = value < 0.02;
  const fill = Math.round(clamp01(value) * 100);
  const iconName = volumeIconName(value);
  const isVertical = orientation === 'vertical';

  const toggleMute = () => {
    if (muted) {
      onChange(beforeMuteRef.current > 0.02 ? beforeMuteRef.current : 1);
      return;
    }
    beforeMuteRef.current = value > 0.02 ? value : 1;
    onChange(0);
  };

  return (
    <Animated.View
      pointerEvents="box-none"
      accessibilityLabel={
        caption
          ? `${caption}: ${fill}%`
          : `Громкость ${participantName}: ${fill}%`
      }
      {...(Platform.OS === 'web' && caption
        ? ({ title: caption } as object)
        : null)}
      style={[
        styles.volumeDock,
        isVertical ? styles.volumeDockVertical : styles.volumeDockHorizontal,
        caption ? styles.volumeDockWithCaption : null,
        {
          opacity: appear,
          transform: [
            {
              scale: appear.interpolate({
                inputRange: [0, 1],
                outputRange: [0.92, 1],
              }),
            },
            isVertical
              ? {
                  translateX: appear.interpolate({
                    inputRange: [0, 1],
                    outputRange: [10, 0],
                  }),
                }
              : {
                  translateY: appear.interpolate({
                    inputRange: [0, 1],
                    outputRange: [8, 0],
                  }),
                },
          ],
        },
      ]}>
      {caption ? (
        <Text style={styles.volumeCaption} numberOfLines={1}>
          {caption}
        </Text>
      ) : null}
      <View
        style={[
          styles.volumeDockControls,
          isVertical ? styles.volumeDockControlsVertical : styles.volumeDockControlsHorizontal,
        ]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={muted ? 'Включить звук' : 'Выключить звук'}
        accessibilityHint="Только у тебя"
        hitSlop={6}
        onPress={toggleMute}
        {...(Platform.OS === 'web'
          ? ({ title: muted ? 'Включить звук' : 'Выключить звук' } as object)
          : null)}
        style={({ pressed }) => [
          styles.volumeMuteBtn,
          muted && styles.volumeMuteBtnActive,
          pressed && styles.pressed,
        ]}>
        <Ionicons name={iconName} size={15} color={muted ? '#FFFFFF' : '#F2F3F5'} />
      </Pressable>

      <View
        style={[
          styles.volumeTrackHit,
          isVertical ? styles.volumeTrackHitVertical : styles.volumeTrackHitHorizontal,
        ]}
        onLayout={onTrackLayout}
        onStartShouldSetResponder={() => true}
        onMoveShouldSetResponder={() => true}
        onStartShouldSetResponderCapture={() => true}
        onMoveShouldSetResponderCapture={() => true}
        onResponderTerminationRequest={() => false}
        onResponderGrant={onGrant}
        onResponderMove={onMove}
        onResponderRelease={onRelease}
        onResponderTerminate={onRelease}>
        <View
          style={[
            styles.volumeTrackRail,
            isVertical ? styles.volumeTrackRailVertical : styles.volumeTrackRailHorizontal,
            dragging &&
              (isVertical
                ? styles.volumeTrackRailActiveVertical
                : styles.volumeTrackRailActiveHorizontal),
          ]}>
          <View
            style={[
              styles.volumeFill,
              isVertical
                ? { height: `${fill}%`, width: '100%' }
                : { width: `${fill}%`, height: '100%' },
              muted && styles.volumeFillMuted,
            ]}
          />
        </View>
        <View
          pointerEvents="none"
          style={[
            styles.volumeThumb,
            dragging && styles.volumeThumbActive,
            isVertical
              ? { bottom: `${fill}%`, left: '50%', marginLeft: -8, marginBottom: -8 }
              : { left: `${fill}%`, top: '50%', marginTop: -8, marginLeft: -8 },
          ]}
        />
      </View>

      <Text
        style={[styles.volumePercent, muted && styles.volumePercentMuted]}
        numberOfLines={1}>
        {muted ? 'выкл' : `${fill}%`}
      </Text>
      </View>
    </Animated.View>
  );
}

function ParticipantTile({
  tile,
  avatarSize,
  tileWidth,
  videoHeight,
  volumeOpen,
  onToggleVolume,
  onVolumeChange,
  onPress,
  onOpenMenu,
}: {
  tile: OverlayTile;
  avatarSize: number;
  tileWidth: number;
  videoHeight: number | null;
  volumeOpen?: boolean;
  onToggleVolume?: () => void;
  onVolumeChange?: (volume: number) => void;
  onPress?: () => void;
  onOpenMenu?: () => void;
}) {
  const avatarOuter = avatarFrameOuterSize(avatarSize);
  const ringBox = avatarOuter + 8;
  const showVideo = Boolean(tile.cameraOn && tile.videoTrack && videoHeight);
  const canAdjustVolume =
    Boolean(onToggleVolume && onVolumeChange) && !tile.isLocal && !tile.waiting;
  const volume = clamp01(tile.volume ?? 1);
  const mutedLocally = volume < 0.02;
  // Narrow tiles: vertical dock on the side; wide / video: horizontal under media.
  const volumeOrientation: 'horizontal' | 'vertical' =
    !showVideo && tileWidth < 168 ? 'vertical' : 'horizontal';
  const volumeCaption = tile.isBard ? 'Громкость у тебя' : 'Громкость пользователя';
  const volumeChipTip = tile.isBard
    ? 'Громкость у тебя'
    : `Громкость · ${tile.name}`;

  const openMenu = () => {
    onOpenMenu?.();
  };

  const mediaPressHandlers =
    onPress || onOpenMenu
      ? {
          accessibilityRole: 'button' as const,
          accessibilityLabel: tile.isBard
            ? onPress
              ? 'Бард — открыть плеер'
              : 'Бард'
            : `Меню ${tile.name}`,
          accessibilityHint: onOpenMenu
            ? 'Удерживайте, чтобы открыть меню'
            : undefined,
          onPress,
          onLongPress: onOpenMenu ? openMenu : undefined,
          delayLongPress: onOpenMenu ? 350 : undefined,
          // @ts-expect-error RN Web: native context menu
          onContextMenu: onOpenMenu
            ? (event: GestureResponderEvent) => {
                event.preventDefault?.();
                openMenu();
              }
            : undefined,
        }
      : null;

  const wrapMenuHit = (node: ReactNode) =>
    mediaPressHandlers ? (
      <Pressable {...mediaPressHandlers} style={styles.tileMediaMenuHit}>
        {node}
      </Pressable>
    ) : (
      <View style={styles.tileMediaMenuHit}>{node}</View>
    );

  return (
    <View
      style={[
        styles.tile,
        { width: tileWidth },
        showVideo ? styles.tileVideo : null,
        tile.waiting && styles.tileWaiting,
        tile.urgent && styles.tileUrgent,
        tile.isBard && styles.tileBard,
      ]}>
      {/*
        Menu hit-target is only the media (no nested volume Pressables).
        Safari/RN-web: outer Pressable wrapping volume chip → nested <button>.
      */}
      <View style={styles.tilePressable}>
        <View style={styles.tileMedia}>
          {showVideo ? (
            <View style={styles.tileMediaMenuHost}>
              {wrapMenuHit(
                <View
                  style={[
                    styles.videoFrame,
                    {
                      height: videoHeight ?? 180,
                      borderColor: tile.urgent
                        ? '#ED4245'
                        : tile.speaking
                          ? '#23A559'
                          : 'rgba(255,255,255,0.08)',
                    },
                  ]}>
                  <CallVideoView track={tile.videoTrack} mirror={tile.isLocal} />
                  {tile.muted ? (
                    <View style={styles.videoMuteBadge}>
                      <Ionicons name="mic-off" size={12} color="#FFFFFF" />
                    </View>
                  ) : null}
                  {tile.urgent ? (
                    <View style={styles.videoUrgentChip} pointerEvents="none">
                      <Text style={styles.urgentBubbleText}>срочная заявка</Text>
                    </View>
                  ) : null}
                </View>,
              )}
              {canAdjustVolume && volumeOpen && onVolumeChange ? (
                <View style={styles.volumeDockOverlay} pointerEvents="box-none">
                  <ParticipantVolumeDock
                    value={volume}
                    onChange={onVolumeChange}
                    orientation="horizontal"
                    participantName={tile.name}
                    caption={volumeCaption}
                  />
                </View>
              ) : null}
            </View>
          ) : (
            <View style={[styles.avatarWrap, { width: ringBox + 28, height: ringBox + 28 }]}>
              {wrapMenuHit(
                <>
                  {tile.urgent ? <UrgentPulseRings size={ringBox} /> : null}
                  {!tile.urgent && tile.waiting && !tile.connecting ? (
                    <WaitingPulseRings size={ringBox} />
                  ) : null}
                  {tile.isBard ? (
                    <BardPlayingAura size={ringBox} active={Boolean(tile.bardPlaying)} />
                  ) : null}
                  {tile.isBard && tile.bardLoading ? (
                    <View
                      pointerEvents="none"
                      style={[
                        styles.bardLoadingRing,
                        {
                          width: ringBox + 10,
                          height: ringBox + 10,
                          borderRadius: (ringBox + 10) / 2,
                        },
                      ]}>
                      <ActivityIndicator size="small" color="#84B9FF" />
                    </View>
                  ) : null}
                  <View
                    style={[
                      styles.avatarRing,
                      tile.isBard && styles.bardRing,
                      tile.isBard && tile.bardPlaying && styles.bardRingPlaying,
                      tile.isBard && tile.bardLoading && styles.bardRingLoading,
                      {
                        width: ringBox,
                        height: ringBox,
                        borderRadius: ringBox / 2,
                        borderColor: tile.isBard
                          ? tile.bardPlaying
                            ? 'rgba(132, 185, 255, 0.95)'
                            : 'rgba(21, 122, 254, 0.75)'
                          : tile.urgent
                            ? '#ED4245'
                            : tile.speaking
                              ? '#23A559'
                              : tile.waiting
                                ? 'rgba(21, 122, 254, 0.85)'
                                : 'transparent',
                      },
                    ]}>
                    <View style={[styles.avatarSlot, { width: avatarOuter, height: avatarOuter }]}>
                      {tile.isBard ? (
                        <View
                          style={[
                            styles.bardAvatar,
                            tile.bardPlaying && styles.bardAvatarPlaying,
                            {
                              width: avatarSize,
                              height: avatarSize,
                              borderRadius: avatarSize / 2,
                            },
                          ]}>
                          <View style={styles.bardAvatarInner}>
                            <Ionicons
                              name={tile.bardPlaying ? 'musical-notes' : 'musical-note'}
                              size={Math.round(avatarSize * 0.4)}
                              color={tile.bardPlaying ? '#E8F2FF' : '#84B9FF'}
                            />
                          </View>
                        </View>
                      ) : (
                        <UserAvatar
                          nickname={tile.name}
                          avatarUrl={tile.avatarUrl}
                          size={avatarSize}
                          badges={tile.badges}
                          frameId={tile.frameId}
                        />
                      )}
                    </View>
                    {tile.connecting ? (
                      <View style={styles.connectingOverlay} pointerEvents="none">
                        <ActivityIndicator size="small" color="#FFFFFF" />
                      </View>
                    ) : null}
                    {tile.muted && !tile.waiting && !tile.isBard ? (
                      <View style={styles.muteBadge}>
                        <Ionicons name="mic-off" size={12} color="#FFFFFF" />
                      </View>
                    ) : null}
                  </View>
                  {tile.isBard ? (
                    <View
                      style={[styles.bardPlaque, tile.bardPlaying && styles.bardPlaquePlaying]}
                      pointerEvents="none">
                      <View
                        style={[
                          styles.bardPlaqueIcon,
                          tile.bardPlaying && styles.bardPlaqueIconPlaying,
                        ]}>
                        <Ionicons
                          name={tile.bardPlaying ? 'play' : 'musical-note'}
                          size={10}
                          color="#FFFFFF"
                        />
                      </View>
                      <Text style={styles.bardPlaqueText} numberOfLines={1}>
                        {tile.bardPlaque?.trim() || 'Выбери трек'}
                      </Text>
                    </View>
                  ) : null}
                  {tile.urgent ? (
                    <View style={styles.urgentBubble} pointerEvents="none">
                      <Text style={styles.urgentBubbleText}>срочная заявка</Text>
                    </View>
                  ) : null}
                </>,
              )}
              {canAdjustVolume &&
              volumeOpen &&
              onVolumeChange &&
              volumeOrientation === 'vertical' ? (
                <View style={styles.volumeDockSide} pointerEvents="box-none">
                  <ParticipantVolumeDock
                    value={volume}
                    onChange={onVolumeChange}
                    orientation="vertical"
                    participantName={tile.name}
                    caption={volumeCaption}
                  />
                </View>
              ) : null}
            </View>
          )}

          {canAdjustVolume ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={
                volumeOpen
                  ? `Скрыть громкость ${tile.name}`
                  : volumeChipTip
              }
              accessibilityHint={
                tile.isBard
                  ? 'Только у тебя, на остальных не влияет'
                  : 'Только у тебя, собеседник себя не слышит тише'
              }
              accessibilityState={{ expanded: Boolean(volumeOpen) }}
              hitSlop={6}
              onPress={onToggleVolume}
              {...(Platform.OS === 'web'
                ? ({ title: volumeChipTip } as object)
                : null)}
              style={({ pressed }) => [
                styles.volumeChip,
                mutedLocally && styles.volumeChipMuted,
                volumeOpen && styles.volumeChipOpen,
                pressed && styles.pressed,
              ]}>
              <Ionicons
                name={volumeIconName(volume)}
                size={13}
                color={mutedLocally ? '#FFFFFF' : volumeOpen ? '#84B9FF' : '#E3E5E8'}
              />
            </Pressable>
          ) : null}
        </View>

        {!tile.isBard ? (
          <NameWithBadges
            name={tile.isLocal ? `${tile.name} (вы)` : tile.name}
            badges={tile.badges}
            textStyle={styles.tileName}
            badgeSize={12}
            layout="stack"
            align="center"
          />
        ) : null}
        {tile.connecting ? (
          <Text style={styles.tileHint}>подключение…</Text>
        ) : tile.waiting && !tile.urgent ? (
          <Text style={styles.tileHint}>ожидание</Text>
        ) : null}

        {canAdjustVolume &&
        volumeOpen &&
        onVolumeChange &&
        !showVideo &&
        volumeOrientation === 'horizontal' ? (
          <ParticipantVolumeDock
            value={volume}
            onChange={onVolumeChange}
            orientation="horizontal"
            participantName={tile.name}
            caption={volumeCaption}
          />
        ) : null}
      </View>
    </View>
  );
}

function buildConnectionUi(opts: {
  status: ChatLiveVoiceStatus;
  error: string | null;
}): {
  color: string;
  label: string;
  detail: string | null;
  tone: 'connecting' | 'ok' | 'error' | 'warn' | 'idle';
} {
  if (opts.status === 'error') {
    return {
      color: '#ED4245',
      label: 'Ошибка соединения',
      detail: opts.error || 'Не удалось подключиться к голосовому серверу',
      tone: 'error',
    };
  }
  if (opts.status === 'connecting') {
    return {
      color: '#F0B232',
      label: 'Подключение…',
      detail: 'Соединяемся с голосовым сервером',
      tone: 'connecting',
    };
  }
  if (opts.status === 'connected') {
    if (opts.error) {
      return {
        color: '#F0B232',
        label: 'Сервер ок · микрофон не поднялся',
        detail: opts.error,
        tone: 'warn',
      };
    }
    return {
      color: '#23A559',
      label: 'Соединение установлено',
      detail: null,
      tone: 'ok',
    };
  }
  return {
    color: '#B5BAC1',
    label: 'Голосовой чат',
    detail: null,
    tone: 'idle',
  };
}

function buildCallPhaseLabel(opts: {
  isGroup: boolean;
  ringing: boolean;
  mediaReady: boolean;
  liveCount: number;
  waitingCount: number;
}): string | null {
  const { isGroup, ringing, mediaReady, liveCount, waitingCount } = opts;
  if (!mediaReady) {
    return null;
  }
  if (ringing) {
    if (isGroup) {
      if (waitingCount <= 0) {
        return liveCount > 1 ? `${liveCount} в эфире` : 'Ждём, кто присоединится';
      }
      if (waitingCount === 1) {
        return 'Вызов · ждём 1';
      }
      return `Вызов · ждём ${waitingCount}`;
    }
    return waitingCount > 0 ? 'Вызов…' : 'Ждём, кто присоединится';
  }
  if (isGroup) {
    const liveLabel =
      liveCount <= 1 ? 'Ждём, кто присоединится' : `${liveCount} в эфире`;
    if (waitingCount > 0) {
      return liveCount <= 1
        ? `Вызов · ждём ${waitingCount}`
        : `${liveCount} в эфире · ждём ${waitingCount}`;
    }
    return liveLabel;
  }
  if (waitingCount > 0) {
    return 'Ждём ответа';
  }
  if (liveCount > 1) {
    return 'В эфире';
  }
  return 'Ждём, кто присоединится';
}

/** Discord-style full-screen voice overlay with avatar tiles. */
export function VoiceCallOverlay({
  visible,
  minimized = false,
  title,
  isGroup = false,
  status,
  ringing,
  error,
  muted,
  deafened,
  cameraOn = false,
  participants,
  waitingPeers = [],
  urgentById = {},
  volumeById = {},
  conversationId = null,
  diceSenderNickname = 'Вы',
  onToggleMute,
  onMicGesture,
  onToggleDeafen,
  onToggleCamera,
  onHangup,
  onRetry,
  onMinimize,
  onExpand,
  onUrgentRequest,
  onSetParticipantVolume,
  canControlMusic = false,
  bardPresent = false,
  bardTrackTitle = null,
  bardPlaying = false,
  bardLoading = false,
  bardTrackId = null,
  bardCurrentEntryId = null,
  bardQueue = [],
  bardPositionSec = 0,
  bardDurationSec = 0,
  bardLocalVolume = 1,
  bardGlobalVolume = 1,
  bardLocalDisplayName = 'Участник',
  onSummonBard,
  onDismissBard,
  onSetBardLocalVolume,
  onEnqueueBardTrack,
  onPlayBardQueueEntry,
  onRemoveBardQueueEntry,
  onToggleBardPlay,
  onSeekBard,
  onStopBardTrack,
  onSetBardGlobalVolume,
  onRequestBardSync,
  onResumeBardAudio,
}: Props) {
  const insets = useSafeAreaInsets();
  const isDesktop = useIsDesktopWeb();
  const { avatarUrl: profileAvatarUrl } = useProfile();
  const { width, height } = useWindowDimensions();
  const [miniOffset, setMiniOffset] = useState(savedMiniOffset);
  const miniOffsetRef = useRef(savedMiniOffset);
  const miniSizeRef = useRef({ width: 280, height: 56 });
  const suppressExpandRef = useRef(false);
  const [volumeOpenId, setVolumeOpenId] = useState<string | null>(null);
  const [bardSheetOpen, setBardSheetOpen] = useState(false);
  const failed = status === 'error';
  const mediaReady = status === 'connected';
  const linking = status === 'connecting';
  const [elapsedSec, setElapsedSec] = useState(0);
  const startedAtRef = useRef<number | null>(null);
  const [nowTick, setNowTick] = useState(Date.now());
  const [diceOpen, setDiceOpen] = useState(false);
  const connectPulse = useRef(new Animated.Value(1)).current;
  // Пока звонок на экране — не ждём LiveKit `connected` / ответ собеседника.
  const canRollDice = Boolean(conversationId?.trim()) && status !== 'error';
  const showMusicControls = canControlMusic && mediaReady;
  /** Non-controllers open the sheet via the note button when Bard is already present. */
  const showBardOpenButton = mediaReady && bardPresent && !canControlMusic;

  useEffect(() => {
    if (!linking) {
      connectPulse.setValue(1);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(connectPulse, {
          toValue: 0.3,
          duration: 650,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(connectPulse, {
          toValue: 1,
          duration: 650,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [connectPulse, linking]);

  useEffect(() => {
    if (!visible || failed || !mediaReady) {
      startedAtRef.current = null;
      setElapsedSec(0);
      return;
    }
    if (startedAtRef.current == null) {
      startedAtRef.current = Date.now();
      setElapsedSec(0);
    }
    const tick = () => {
      const started = startedAtRef.current;
      if (started == null) {
        return;
      }
      setElapsedSec(Math.floor((Date.now() - started) / 1000));
      setNowTick(Date.now());
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [failed, mediaReady, visible]);

  useEffect(() => {
    if (!visible) {
      setDiceOpen(false);
      setVolumeOpenId(null);
      setBardSheetOpen(false);
      savedMiniOffset = { x: 0, y: 0 };
      miniOffsetRef.current = savedMiniOffset;
      setMiniOffset(savedMiniOffset);
    }
  }, [visible]);

  useEffect(() => {
    if (!bardPresent) {
      setBardSheetOpen(false);
    }
  }, [bardPresent]);

  const beginMiniDrag = useCallback(
    (clientX: number, clientY: number) => {
      const origin = { ...miniOffsetRef.current };
      const startX = clientX;
      const startY = clientY;
      let moved = false;

      const anchor = {
        right: Math.max(insets.right, 16),
        bottom: Math.max(insets.bottom, 16) + 12,
      };

      const move = (nextX: number, nextY: number) => {
        const dx = nextX - startX;
        const dy = nextY - startY;
        if (Math.abs(dx) + Math.abs(dy) > 6) {
          moved = true;
        }
        const next = clampMiniOffset(
          { x: origin.x + dx, y: origin.y + dy },
          { width, height },
          miniSizeRef.current,
          anchor,
        );
        savedMiniOffset = next;
        miniOffsetRef.current = next;
        setMiniOffset(next);
      };

      const finish = () => {
        suppressExpandRef.current = moved;
      };

      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        const onMove = (event: PointerEvent) => move(event.clientX, event.clientY);
        const onUp = () => {
          window.removeEventListener('pointermove', onMove);
          window.removeEventListener('pointerup', onUp);
          finish();
        };
        window.addEventListener('pointermove', onMove);
        window.addEventListener('pointerup', onUp);
        return;
      }

      finish();
    },
    [height, insets.bottom, insets.right, width],
  );

  const tiles = useMemo<OverlayTile[]>(() => {
    const live = participants.map((p) => ({
      key: p.identity,
      name: p.name,
      avatarUrl: p.isLocal && profileAvatarUrl ? profileAvatarUrl : p.avatarUrl,
      speaking: p.speaking,
      muted: p.muted,
      cameraOn: p.cameraOn,
      videoTrack: p.videoTrack,
      isLocal: p.isLocal,
      badges: p.badges,
      frameId: p.avatarFrameId,
      urgent: Boolean(urgentById[p.identity]),
      volume: p.isLocal ? undefined : clamp01(volumeById[p.identity] ?? 1),
    }));
    const liveIds = new Set(live.map((p) => p.key));
    for (const peer of waitingPeers) {
      if (!peer.id || liveIds.has(peer.id)) {
        continue;
      }
      live.push({
        key: peer.id,
        name: peer.name,
        avatarUrl: peer.avatarUrl,
        speaking: false,
        muted: false,
        cameraOn: false,
        videoTrack: null,
        isLocal: false,
        waiting: true,
        connecting: Boolean(peer.connecting),
        urgent: Boolean(urgentById[peer.id]),
      });
      liveIds.add(peer.id);
    }
    if (bardPresent) {
      live.push({
        key: BARD_TILE_KEY,
        name: 'Бард',
        avatarUrl: null,
        speaking: Boolean(bardPlaying),
        muted: false,
        cameraOn: false,
        videoTrack: null,
        isLocal: false,
        isBard: true,
        bardPlaque: bardTrackTitle,
        bardPlaying,
        bardLoading,
        volume: clamp01(bardLocalVolume),
      });
    }
    // Local first, then live remotes, bard near end, waiting last.
    return live.sort((a, b) => {
      if (a.isLocal !== b.isLocal) {
        return a.isLocal ? -1 : 1;
      }
      if (Boolean(a.waiting) !== Boolean(b.waiting)) {
        return a.waiting ? 1 : -1;
      }
      if (Boolean(a.isBard) !== Boolean(b.isBard)) {
        return a.isBard ? 1 : -1;
      }
      return a.name.localeCompare(b.name, 'ru');
    });
  }, [
    bardLocalVolume,
    bardLoading,
    bardPlaying,
    bardPresent,
    bardTrackTitle,
    participants,
    profileAvatarUrl,
    urgentById,
    volumeById,
    waitingPeers,
  ]);

  useEffect(() => {
    if (!volumeOpenId) {
      return;
    }
    const stillThere = tiles.some(
      (tile) =>
        tile.key === volumeOpenId &&
        !tile.isLocal &&
        !tile.waiting &&
        (tile.isBard ? Boolean(onSetBardLocalVolume) : true),
    );
    if (!stillThere) {
      setVolumeOpenId(null);
    }
  }, [onSetBardLocalVolume, tiles, volumeOpenId]);

  const liveCount = participants.length;
  const localUrgent = participants.some((p) => p.isLocal && Boolean(urgentById[p.identity]));
  const waitingCount = waitingPeers.filter(
    (peer) => peer.id && !participants.some((p) => p.identity === peer.id),
  ).length;

  const connection = buildConnectionUi({ status, error });
  const callPhase = buildCallPhaseLabel({
    isGroup,
    ringing: Boolean(ringing),
    mediaReady,
    liveCount,
    waitingCount,
  });
  const statusLine =
    connection.tone === 'ok' && callPhase
      ? `${connection.label} · ${callPhase}`
      : connection.label;
  const miniStatusLine = failed
    ? connection.detail || connection.label
    : linking || connection.tone === 'warn'
      ? connection.detail || connection.label
      : `${statusLine}${mediaReady ? ` · ${formatCallDuration(elapsedSec)}` : ''}`;

  const layout = useMemo(() => {
    const count = Math.max(tiles.length, 1);
    const stageWidth = Math.min(width - Spacing.md * 4, isDesktop ? 680 : width - 48);
    let columns = 1;
    if (count === 2) {
      columns = 2;
    } else if (count === 3) {
      columns = width < 420 ? 2 : 3;
    } else if (count >= 4) {
      columns = width < 420 ? 2 : 3;
    }
    const gap = count >= 5 ? 12 : 16;
    const tileWidth = Math.floor((stageWidth - gap * (columns - 1)) / columns);
    let avatarSize = 96;
    if (count <= 1) {
      avatarSize = isDesktop ? 128 : 112;
    } else if (count === 2) {
      avatarSize = isDesktop ? 104 : 92;
    } else if (count <= 4) {
      avatarSize = isDesktop ? 84 : 72;
    } else {
      avatarSize = isDesktop ? 72 : 64;
    }
    avatarSize = Math.min(avatarSize, Math.max(52, tileWidth - 56));
    const videoMode = tiles.some((tile) => tile.cameraOn);
    const videoHeight = videoMode ? Math.max(148, Math.round(tileWidth * 0.72)) : null;
    return { columns, gap, tileWidth, avatarSize, stageWidth, videoHeight };
  }, [isDesktop, tiles, width]);

  if (!visible) {
    return null;
  }

  const statusColor = connection.color;
  const timerLabel = formatCallDuration(elapsedSec);

  const diceLayer =
    conversationId?.trim() ? (
      <VoiceCallDiceLayer
        conversationId={conversationId.trim()}
        senderNickname={diceSenderNickname}
        open={diceOpen}
        onOpenChange={setDiceOpen}
      />
    ) : null;

  if (minimized) {
    const pinToTop = !isDesktop;
    const miniAnchor = {
      right: Math.max(insets.right, 16),
      bottom: Math.max(insets.bottom, 16) + 12,
    };
    const miniBar = (
      <View style={pinToTop ? styles.miniPinnedBar : styles.miniBar}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={
            pinToTop ? 'Развернуть звонок' : 'Развернуть звонок. Потяните, чтобы перенести'
          }
          onPress={() => {
            if (suppressExpandRef.current) {
              suppressExpandRef.current = false;
              return;
            }
            onExpand?.();
          }}
          // @ts-expect-error RN-web pointer drag
          onPointerDown={(event: { button?: number; clientX: number; clientY: number }) => {
            if (pinToTop) {
              return;
            }
            if (event.button != null && event.button !== 0) {
              return;
            }
            beginMiniDrag(event.clientX, event.clientY);
          }}
          style={({ pressed }) => [
            styles.miniMain,
            Platform.OS === 'web' && !pinToTop
              ? ({ cursor: 'grab', touchAction: 'none' } as const)
              : null,
            pressed && styles.pressed,
          ]}>
          <Animated.View
            style={[
              styles.miniDot,
              { backgroundColor: statusColor, opacity: linking ? connectPulse : 1 },
            ]}
          />
          <View style={styles.miniCopy}>
            <Text style={styles.miniTitle} numberOfLines={1}>
              {title}
            </Text>
            <Text
              style={[styles.miniMeta, failed && styles.statusError]}
              numberOfLines={1}>
              {miniStatusLine}
            </Text>
          </View>
          {pinToTop ? null : <Ionicons name="expand" size={18} color="#F2F3F5" />}
        </Pressable>
        <View style={styles.miniActions}>
          {canRollDice ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Бросить кости"
              onPress={() => setDiceOpen(true)}
              style={({ pressed }) => [
                pinToTop ? styles.miniCtrlCompact : styles.miniCtrl,
                pressed && styles.pressed,
              ]}>
              <Ionicons name="dice-outline" size={pinToTop ? 17 : 18} color="#FFFFFF" />
            </Pressable>
          ) : null}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={
              muted ? 'Включить микрофон (Ctrl+Shift+M)' : 'Выключить микрофон (Ctrl+Shift+M)'
            }
            onPressIn={muted ? onMicGesture : undefined}
            onPress={onToggleMute}
            style={({ pressed }) => [
              pinToTop ? styles.miniCtrlCompact : styles.miniCtrl,
              muted && styles.miniCtrlDanger,
              pressed && styles.pressed,
            ]}>
            <Ionicons name={muted ? 'mic-off' : 'mic'} size={pinToTop ? 17 : 18} color="#FFFFFF" />
          </Pressable>
          {onToggleCamera && !pinToTop ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={
                cameraOn ? 'Выключить камеру (Ctrl+Shift+V)' : 'Включить камеру (Ctrl+Shift+V)'
              }
              onPress={onToggleCamera}
              style={({ pressed }) => [
                styles.miniCtrl,
                !cameraOn && styles.miniCtrlOff,
                pressed && styles.pressed,
              ]}>
              <Ionicons name={cameraOn ? 'videocam' : 'videocam-off'} size={18} color="#FFFFFF" />
            </Pressable>
          ) : null}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Завершить звонок"
            onPress={onHangup}
            style={({ pressed }) => [
              pinToTop ? styles.miniCtrlCompact : styles.miniCtrl,
              styles.miniCtrlHangup,
              pressed && styles.pressed,
            ]}>
            <Ionicons
              name="call"
              size={pinToTop ? 15 : 16}
              color="#FFFFFF"
              style={styles.hangupIcon}
            />
          </Pressable>
        </View>
      </View>
    );

    if (pinToTop) {
      return (
        <>
          <View
            style={[
              styles.miniPinned,
              {
                paddingTop: insets.top,
                backgroundColor: mediaReady ? '#123524' : linking || failed ? '#2B1D1D' : '#1E1F22',
              },
            ]}>
            {miniBar}
          </View>
          {diceLayer}
        </>
      );
    }

    return (
      <>
        <View
          pointerEvents="box-none"
          onLayout={(event) => {
            const { width: barWidth, height: barHeight } = event.nativeEvent.layout;
            if (barWidth > 0 && barHeight > 0) {
              miniSizeRef.current = { width: barWidth, height: barHeight };
            }
          }}
          style={[
            styles.miniRoot,
            {
              bottom: miniAnchor.bottom,
              right: miniAnchor.right,
              transform: [{ translateX: miniOffset.x }, { translateY: miniOffset.y }],
            },
          ]}>
          {miniBar}
        </View>
        {diceLayer}
      </>
    );
  }

  return (
    <>
    <Modal visible transparent animationType="fade" statusBarTranslucent>
      <View style={styles.modalRoot}>
        <View
          style={[
            styles.root,
            {
              paddingTop: Math.max(insets.top, Spacing.md),
              paddingBottom: Math.max(insets.bottom, Spacing.md),
            },
          ]}>
          {onMinimize ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Свернуть звонок"
              onPress={onMinimize}
              style={styles.backdropHit}
            />
          ) : null}
        <View style={[styles.shell, isDesktop && styles.shellDesktop]}>
          <View style={styles.header}>
            <View style={styles.headerCopy}>
              <Text style={styles.title} numberOfLines={1}>
                {title}
              </Text>
              <View style={styles.statusRow}>
                <Animated.View
                  style={[
                    styles.statusDot,
                    {
                      backgroundColor: statusColor,
                      opacity: linking ? connectPulse : 1,
                    },
                  ]}
                />
                <Text
                  style={[
                    styles.statusText,
                    failed && styles.statusError,
                    mediaReady && !error && styles.statusOk,
                    (linking || Boolean(mediaReady && error)) && styles.statusConnecting,
                  ]}
                  numberOfLines={1}>
                  {statusLine}
                </Text>
                {mediaReady ? (
                  <Text style={styles.timerText} accessibilityLabel={`Длительность ${timerLabel}`}>
                    {timerLabel}
                  </Text>
                ) : null}
              </View>
            </View>
            {onMinimize ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Свернуть звонок"
                onPress={onMinimize}
                style={({ pressed }) => [styles.headerAction, pressed && styles.pressed]}>
                <Ionicons name="remove" size={20} color="#F2F3F5" />
              </Pressable>
            ) : null}
            {isGroup ? (
              <View style={styles.headerBadge}>
                <Ionicons name="people" size={14} color="#B5BAC1" />
                <Text style={styles.headerBadgeText}>{tiles.length}</Text>
              </View>
            ) : null}
          </View>

          {linking || failed || connection.tone === 'warn' ? (
            <View
              style={[
                styles.connectionBanner,
                failed
                  ? styles.connectionBannerError
                  : styles.connectionBannerConnecting,
              ]}>
              <Ionicons
                name={
                  failed
                    ? 'cloud-offline-outline'
                    : connection.tone === 'warn'
                      ? 'mic-off-outline'
                      : 'sync-outline'
                }
                size={18}
                color={failed ? '#FFB4B4' : '#FFE6A8'}
              />
              <View style={styles.connectionBannerCopy}>
                <Text
                  style={[
                    styles.connectionBannerTitle,
                    failed && styles.connectionBannerTitleError,
                  ]}>
                  {connection.label}
                </Text>
                {connection.detail ? (
                  <Text style={styles.connectionBannerDetail} numberOfLines={4}>
                    {connection.detail}
                  </Text>
                ) : null}
              </View>
            </View>
          ) : null}

          <ScrollView
            style={styles.stageScroll}
            contentContainerStyle={styles.stageContent}
            showsVerticalScrollIndicator={false}>
            <View
              style={[
                styles.grid,
                {
                  width: layout.stageWidth,
                  gap: layout.gap,
                },
              ]}>
              {tiles.map((tile) => (
                <ParticipantTile
                  key={tile.key}
                  tile={tile}
                  avatarSize={layout.avatarSize}
                  tileWidth={layout.tileWidth}
                  videoHeight={layout.videoHeight}
                  volumeOpen={volumeOpenId === tile.key}
                  onToggleVolume={
                    tile.isBard
                      ? onSetBardLocalVolume
                        ? () =>
                            setVolumeOpenId((current) =>
                              current === tile.key ? null : tile.key,
                            )
                        : undefined
                      : onSetParticipantVolume && !tile.isLocal && !tile.waiting
                        ? () =>
                            setVolumeOpenId((current) =>
                              current === tile.key ? null : tile.key,
                            )
                        : undefined
                  }
                  onVolumeChange={
                    tile.isBard
                      ? onSetBardLocalVolume
                      : onSetParticipantVolume && !tile.isLocal && !tile.waiting
                        ? (volume) => onSetParticipantVolume(tile.key, volume)
                        : undefined
                  }
                  onPress={
                    tile.isBard
                      ? () => {
                          onResumeBardAudio?.();
                          setBardSheetOpen(true);
                        }
                      : undefined
                  }
                />
              ))}
            </View>
          </ScrollView>

          <View style={styles.controls}>
            {failed && onRetry ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Повторить"
                onPressIn={onMicGesture}
                onPress={onRetry}
                style={({ pressed }) => [
                  styles.controlBtn,
                  styles.controlBtnSecondary,
                  pressed && styles.pressed,
                ]}>
                <Ionicons name="refresh" size={22} color="#FFFFFF" />
              </Pressable>
            ) : null}

            <Pressable
              accessibilityRole="button"
              accessibilityLabel={
                muted ? 'Включить микрофон (Ctrl+Shift+M)' : 'Выключить микрофон (Ctrl+Shift+M)'
              }
              disabled={!mediaReady}
              onPressIn={muted ? onMicGesture : undefined}
              onPress={onToggleMute}
              style={({ pressed }) => [
                styles.controlBtn,
                muted ? styles.controlBtnMuted : styles.controlBtnSecondary,
                pressed && styles.pressed,
                !mediaReady && styles.controlDisabled,
              ]}>
              <Ionicons name={muted ? 'mic-off' : 'mic'} size={22} color="#FFFFFF" />
            </Pressable>

            {onToggleCamera ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={
                  cameraOn ? 'Выключить камеру (Ctrl+Shift+V)' : 'Включить камеру (Ctrl+Shift+V)'
                }
                disabled={!mediaReady}
                onPress={onToggleCamera}
                style={({ pressed }) => [
                  styles.controlBtn,
                  cameraOn ? styles.controlBtnSecondary : styles.controlBtnMuted,
                  pressed && styles.pressed,
                  !mediaReady && styles.controlDisabled,
                ]}>
                <Ionicons name={cameraOn ? 'videocam' : 'videocam-off'} size={22} color="#FFFFFF" />
              </Pressable>
            ) : null}

            <Pressable
              accessibilityRole="button"
              accessibilityLabel={
                deafened ? 'Включить звук (Ctrl+Shift+D)' : 'Отключить звук (Ctrl+Shift+D)'
              }
              disabled={!mediaReady}
              onPress={onToggleDeafen}
              style={({ pressed }) => [
                styles.controlBtn,
                deafened ? styles.controlBtnMuted : styles.controlBtnSecondary,
                pressed && styles.pressed,
                !mediaReady && styles.controlDisabled,
              ]}>
              <MaterialCommunityIcons
                name={deafened ? 'headphones-off' : 'headphones'}
                size={24}
                color="#FFFFFF"
              />
            </Pressable>

            {canRollDice ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Бросить кости"
                onPress={() => setDiceOpen(true)}
                style={({ pressed }) => [
                  styles.controlBtn,
                  styles.controlBtnSecondary,
                  pressed && styles.pressed,
                ]}>
                <Ionicons name="dice-outline" size={22} color="#FFFFFF" />
              </Pressable>
            ) : null}

            {showMusicControls || showBardOpenButton ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={
                  bardPresent
                    ? 'Очередь и библиотека Барда'
                    : 'Призвать Барда'
                }
                accessibilityState={{ selected: bardPresent }}
                onPress={() => {
                  onResumeBardAudio?.();
                  if (bardPresent) {
                    setBardSheetOpen(true);
                    return;
                  }
                  onSummonBard?.();
                }}
                style={({ pressed }) => [
                  styles.controlBtn,
                  bardPresent ? styles.controlBtnMusicOn : styles.controlBtnSecondary,
                  pressed && styles.pressed,
                ]}>
                <Ionicons name="musical-notes" size={22} color="#FFFFFF" />
              </Pressable>
            ) : null}

            {onUrgentRequest ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={localUrgent ? 'Снять срочную заявку' : 'Срочная заявка'}
                accessibilityState={{ selected: localUrgent }}
                disabled={!mediaReady}
                onPress={onUrgentRequest}
                style={({ pressed }) => [
                  styles.controlBtn,
                  localUrgent ? styles.controlBtnUrgent : styles.controlBtnSecondary,
                  pressed && styles.pressed,
                  !mediaReady && styles.controlDisabled,
                ]}>
                <Ionicons name="flash" size={22} color="#FFFFFF" />
              </Pressable>
            ) : null}

            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Завершить звонок"
              onPress={onHangup}
              style={({ pressed }) => [
                styles.controlBtn,
                styles.controlBtnHangup,
                pressed && styles.pressed,
              ]}>
              <Ionicons name="call" size={22} color="#FFFFFF" style={styles.hangupIcon} />
            </Pressable>
          </View>
        </View>
        </View>
      </View>
    </Modal>
    {diceLayer}
    <CallBardSheet
      visible={bardSheetOpen && bardPresent}
      canControl={canControlMusic}
      localDisplayName={bardLocalDisplayName}
      trackId={bardTrackId}
      trackTitle={bardTrackTitle}
      currentEntryId={bardCurrentEntryId}
      playing={bardPlaying}
      trackLoading={bardLoading}
      positionSec={bardPositionSec}
      durationSec={bardDurationSec}
      globalVolume={bardGlobalVolume}
      queue={bardQueue}
      onClose={() => setBardSheetOpen(false)}
      onEnqueueTrack={(trackId, title, durationSec, playUrl) =>
        onEnqueueBardTrack?.(trackId, title, durationSec, playUrl)
      }
      onPlayQueueEntry={(entryId) => onPlayBardQueueEntry?.(entryId)}
      onRemoveQueueEntry={(entryId) => onRemoveBardQueueEntry?.(entryId)}
      onTogglePlay={() => onToggleBardPlay?.()}
      onSeek={(positionSec) => onSeekBard?.(positionSec)}
      onStopTrack={() => onStopBardTrack?.()}
      onGlobalVolumeChange={(volume) => onSetBardGlobalVolume?.(volume)}
      onDismissBard={() => onDismissBard?.()}
      onRequestSync={() => onRequestBardSync?.()}
      onAudioGesture={() => onResumeBardAudio?.()}
    />
    </>
  );
}

const styles = StyleSheet.create({
  modalRoot: {
    flex: 1,
  },
  root: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.72)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.md,
  },
  backdropHit: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 0,
  },
  miniRoot: {
    position: 'absolute',
    zIndex: 10050,
    maxWidth: 420,
  },
  miniPinned: {
    width: '100%',
    zIndex: 10050,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  miniPinnedBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    minHeight: 48,
    paddingLeft: 14,
    paddingRight: 10,
    paddingVertical: 6,
  },
  miniBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingLeft: 14,
    paddingRight: 8,
    paddingVertical: 8,
    borderRadius: 16,
    backgroundColor: '#1E1F22',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 12,
  },
  miniActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexShrink: 0,
  },
  miniMain: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minWidth: 0,
    flexShrink: 1,
    paddingVertical: 4,
  },
  miniDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  miniCopy: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  miniTitle: {
    color: '#F2F3F5',
    fontSize: 13,
    fontWeight: '700',
  },
  miniMeta: {
    color: '#B5BAC1',
    fontSize: 11,
    fontWeight: '600',
  },
  miniCtrl: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#4E5058',
    flexShrink: 0,
  },
  miniCtrlCompact: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#4E5058',
    flexShrink: 0,
  },
  miniCtrlDanger: {
    backgroundColor: '#ED4245',
  },
  miniCtrlOff: {
    backgroundColor: '#3A3C41',
  },
  miniCtrlHangup: {
    backgroundColor: '#ED4245',
  },
  shell: {
    flex: 1,
    width: '100%',
    maxWidth: 720,
    borderRadius: 20,
    backgroundColor: '#1E1F22',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    zIndex: 1,
  },
  shellDesktop: {
    flexGrow: 0,
    minHeight: 520,
    maxHeight: '86%',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.sm,
  },
  headerCopy: {
    flex: 1,
    minWidth: 0,
    gap: 6,
  },
  headerAction: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
    marginTop: 0,
  },
  title: {
    color: '#F2F3F5',
    fontSize: 18,
    fontWeight: '700',
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusText: {
    color: '#B5BAC1',
    fontSize: FontSize.caption,
    fontWeight: '600',
    flexShrink: 1,
  },
  timerText: {
    color: '#F2F3F5',
    fontSize: FontSize.caption,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
    letterSpacing: 0.3,
    marginLeft: 2,
  },
  statusError: {
    color: '#ED4245',
  },
  statusOk: {
    color: '#3BA55D',
  },
  statusConnecting: {
    color: '#F0B232',
  },
  connectionBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginHorizontal: Spacing.md,
    marginBottom: Spacing.sm,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  connectionBannerConnecting: {
    backgroundColor: 'rgba(240, 178, 50, 0.12)',
    borderColor: 'rgba(240, 178, 50, 0.35)',
  },
  connectionBannerError: {
    backgroundColor: 'rgba(237, 66, 69, 0.14)',
    borderColor: 'rgba(237, 66, 69, 0.4)',
  },
  connectionBannerCopy: {
    flex: 1,
    gap: 4,
  },
  connectionBannerTitle: {
    color: '#FFE6A8',
    fontSize: FontSize.caption,
    fontWeight: '700',
  },
  connectionBannerTitleError: {
    color: '#FFB4B4',
  },
  connectionBannerDetail: {
    color: '#DCDDDE',
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '500',
  },
  headerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.06)',
    marginTop: 2,
  },
  headerBadgeText: {
    color: '#B5BAC1',
    fontSize: 12,
    fontWeight: '700',
  },
  stageScroll: {
    flex: 1,
  },
  stageContent: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.lg,
    minHeight: 240,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  tile: {
    alignItems: 'center',
    gap: 10,
    paddingVertical: 14,
    paddingHorizontal: 10,
    borderRadius: 16,
    backgroundColor: '#2B2D31',
    overflow: 'visible',
    position: 'relative',
  },
  tileVideo: {
    paddingHorizontal: 6,
    paddingTop: 6,
    alignItems: 'stretch',
  },
  videoFrame: {
    width: '100%',
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#111214',
    borderWidth: 2,
    position: 'relative',
    minHeight: 120,
  },
  videoMuteBadge: {
    position: 'absolute',
    left: 8,
    bottom: 8,
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ED4245',
    borderWidth: 2,
    borderColor: '#2B2D31',
  },
  videoUrgentChip: {
    position: 'absolute',
    top: 8,
    right: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: '#ED4245',
  },
  tileWaiting: {
    backgroundColor: '#25272B',
  },
  tileUrgent: {
    backgroundColor: 'rgba(237, 66, 69, 0.18)',
    borderWidth: 1,
    borderColor: 'rgba(237, 66, 69, 0.45)',
  },
  tileBard: {
    backgroundColor: 'rgba(21, 122, 254, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(132, 185, 255, 0.28)',
  },
  tilePressable: {
    alignItems: 'center',
    width: '100%',
  },
  tileMediaMenuHost: {
    width: '100%',
    position: 'relative',
  },
  tileMediaMenuHit: {
    alignItems: 'center',
    width: '100%',
  },
  bardRing: {
    borderWidth: 2.5,
    backgroundColor: 'rgba(12, 24, 42, 0.55)',
  },
  bardRingPlaying: {
    borderWidth: 2.5,
    shadowColor: '#157AFE',
    shadowOpacity: 0.55,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 0 },
    elevation: 6,
  },
  bardRingLoading: {
    borderColor: 'rgba(132, 185, 255, 0.55)',
    opacity: 0.92,
  },
  bardLoadingRing: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'rgba(132, 185, 255, 0.45)',
    backgroundColor: 'rgba(8, 16, 28, 0.35)',
    zIndex: 4,
  },
  bardAvatar: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(21, 122, 254, 0.28)',
    borderWidth: 1,
    borderColor: 'rgba(132, 185, 255, 0.35)',
  },
  bardAvatarPlaying: {
    backgroundColor: 'rgba(21, 122, 254, 0.42)',
    borderColor: 'rgba(180, 214, 255, 0.65)',
  },
  bardAvatarInner: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  bardPlaque: {
    position: 'absolute',
    bottom: 0,
    left: 2,
    right: 2,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingLeft: 4,
    paddingRight: 8,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: 'rgba(17, 74, 160, 0.92)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(132, 185, 255, 0.45)',
  },
  bardPlaquePlaying: {
    backgroundColor: 'rgba(21, 122, 254, 0.98)',
    borderColor: 'rgba(205, 226, 255, 0.7)',
    shadowColor: '#157AFE',
    shadowOpacity: 0.4,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
  },
  bardPlaqueIcon: {
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.14)',
  },
  bardPlaqueIconPlaying: {
    backgroundColor: 'rgba(255,255,255,0.22)',
  },
  bardPlaqueText: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.1,
  },
  bardPulseRing: {
    position: 'absolute',
    borderWidth: 2,
    borderColor: 'rgba(132, 185, 255, 0.7)',
    backgroundColor: 'transparent',
  },
  bardShimmerRing: {
    position: 'absolute',
    borderWidth: 2,
    borderColor: 'rgba(180, 214, 255, 0.95)',
    backgroundColor: 'transparent',
  },
  bardCoreGlow: {
    position: 'absolute',
    backgroundColor: 'rgba(21, 122, 254, 0.55)',
  },
  avatarWrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarSlot: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  pulseLayer: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pulseRing: {
    position: 'absolute',
    borderWidth: 2,
    borderColor: '#157AFE',
    backgroundColor: 'rgba(21, 122, 254, 0.12)',
  },
  urgentPulseRing: {
    position: 'absolute',
    borderWidth: 2.5,
    borderColor: '#ED4245',
    backgroundColor: 'rgba(237, 66, 69, 0.18)',
  },
  urgentBubble: {
    position: 'absolute',
    top: -2,
    right: -6,
    maxWidth: 120,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: '#ED4245',
    borderWidth: 2,
    borderColor: '#1E1F22',
  },
  urgentBubbleText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  avatarRing: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
  },
  muteBadge: {
    position: 'absolute',
    right: 0,
    bottom: 2,
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ED4245',
    borderWidth: 2,
    borderColor: '#2B2D31',
  },
  connectingOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 999,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
  },
  tileName: {
    color: '#F2F3F5',
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'center',
    width: '100%',
    maxWidth: '100%',
  },
  tileHint: {
    color: '#DCDDDE',
    fontSize: 11,
    fontWeight: '700',
    marginTop: -4,
  },
  tileMedia: {
    position: 'relative',
    width: '100%',
    alignItems: 'center',
  },
  volumeChip: {
    position: 'absolute',
    top: 6,
    right: 6,
    zIndex: 4,
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(15, 16, 18, 0.72)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    ...Platform.select({
      web: { backdropFilter: 'blur(8px)', cursor: 'pointer' } as object,
      default: {},
    }),
  },
  volumeChipMuted: {
    backgroundColor: 'rgba(237, 66, 69, 0.92)',
    borderColor: 'rgba(255,255,255,0.2)',
  },
  volumeChipOpen: {
    borderColor: 'rgba(132, 185, 255, 0.65)',
    backgroundColor: 'rgba(21, 122, 254, 0.28)',
  },
  volumeDockOverlay: {
    position: 'absolute',
    left: 8,
    right: 8,
    bottom: 8,
    zIndex: 3,
  },
  volumeDockSide: {
    position: 'absolute',
    right: -4,
    top: '50%',
    marginTop: -72,
    zIndex: 3,
  },
  volumeDock: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 14,
    backgroundColor: 'rgba(15, 16, 18, 0.82)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    ...Platform.select({
      web: { backdropFilter: 'blur(12px)' } as object,
      default: {},
    }),
  },
  volumeDockWithCaption: {
    flexDirection: 'column',
    alignItems: 'stretch',
    gap: 6,
  },
  volumeCaption: {
    color: '#B5BAC1',
    fontSize: 11,
    fontWeight: '600',
  },
  volumeDockControls: {
    alignItems: 'center',
    gap: 8,
  },
  volumeDockControlsHorizontal: {
    flexDirection: 'row',
    width: '100%',
  },
  volumeDockControlsVertical: {
    flexDirection: 'column',
  },
  volumeDockHorizontal: {
    width: '100%',
  },
  volumeDockVertical: {
    flexDirection: 'column',
    width: 52,
    paddingVertical: 10,
    paddingHorizontal: 8,
    gap: 10,
  },
  volumeMuteBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  volumeMuteBtnActive: {
    backgroundColor: '#ED4245',
  },
  volumeTrackHit: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  volumeTrackHitHorizontal: {
    height: 28,
    minWidth: 64,
  },
  volumeTrackHitVertical: {
    width: 28,
    height: 96,
    flex: 0,
  },
  volumeTrackRail: {
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.16)',
    overflow: 'hidden',
  },
  volumeTrackRailHorizontal: {
    width: '100%',
    height: 5,
  },
  volumeTrackRailVertical: {
    width: 5,
    height: '100%',
    justifyContent: 'flex-end',
  },
  volumeTrackRailActiveHorizontal: {
    height: 7,
    backgroundColor: 'rgba(255,255,255,0.22)',
  },
  volumeTrackRailActiveVertical: {
    width: 7,
    backgroundColor: 'rgba(255,255,255,0.22)',
  },
  volumeFill: {
    borderRadius: 999,
    backgroundColor: '#4B99FF',
  },
  volumeFillMuted: {
    backgroundColor: 'rgba(255,255,255,0.28)',
  },
  volumeThumb: {
    position: 'absolute',
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: '#4B99FF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.35,
    shadowRadius: 2,
    elevation: 3,
  },
  volumeThumbActive: {
    borderColor: '#84B9FF',
    transform: [{ scale: 1.12 }],
  },
  volumePercent: {
    minWidth: 36,
    textAlign: 'right',
    color: '#DCDDDE',
    fontSize: 11,
    fontWeight: '700',
  },
  volumePercentMuted: {
    color: '#F23F43',
    textAlign: 'center',
    minWidth: 32,
  },
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    flexWrap: 'wrap',
    gap: 14,
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.lg,
    paddingTop: Spacing.sm,
  },
  controlBtn: {
    width: 56,
    height: 56,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  controlBtnSecondary: {
    backgroundColor: '#4E5058',
  },
  controlBtnMuted: {
    backgroundColor: '#ED4245',
  },
  controlBtnUrgent: {
    backgroundColor: '#ED4245',
  },
  controlBtnMusicOn: {
    backgroundColor: '#157AFE',
  },
  controlBtnHangup: {
    backgroundColor: '#ED4245',
    width: 68,
  },
  controlDisabled: {
    opacity: 0.45,
  },
  hangupIcon: {
    transform: [{ rotate: '135deg' }],
  },
  pressed: {
    opacity: 0.82,
    transform: [{ scale: 0.97 }],
  },
});
