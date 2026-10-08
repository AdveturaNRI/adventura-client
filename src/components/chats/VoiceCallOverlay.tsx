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
import type { CallMusicLayerLive, CallMusicQueueEntry } from '@/hooks/use-call-shared-music';
import { CallVideoView } from '@/components/chats/CallVideoView';
import { FontSize, Radius, Spacing } from '@/constants/theme';
import { useProfile } from '@/context/ProfileContext';
import type {
  ChatLiveScreenStream,
  ChatLiveVoiceParticipant,
  ChatLiveVoiceStatus,
  ScreenShareQuality,
} from '@/hooks/use-chat-live-voice';
import { SCREEN_SHARE_QUALITY_OPTIONS } from '@/hooks/use-chat-live-voice';
import { getWebHostNode } from '@/utils/web-file-drop';
import type { VideoTrack } from 'livekit-client';

type FullscreenCapable = HTMLElement & {
  webkitRequestFullscreen?: () => Promise<void> | void;
  msRequestFullscreen?: () => Promise<void> | void;
};

type FullscreenDocument = Document & {
  webkitFullscreenElement?: Element | null;
  webkitExitFullscreen?: () => Promise<void> | void;
  msExitFullscreen?: () => Promise<void> | void;
};

function getOsFullscreenElement(): Element | null {
  if (typeof document === 'undefined') {
    return null;
  }
  const doc = document as FullscreenDocument;
  return document.fullscreenElement ?? doc.webkitFullscreenElement ?? null;
}

async function tryRequestFullscreen(target: FullscreenCapable): Promise<boolean> {
  try {
    if (typeof target.requestFullscreen === 'function') {
      await target.requestFullscreen();
      return true;
    }
    if (typeof target.webkitRequestFullscreen === 'function') {
      await target.webkitRequestFullscreen();
      return true;
    }
    if (typeof target.msRequestFullscreen === 'function') {
      await target.msRequestFullscreen();
      return true;
    }
  } catch {
    return false;
  }
  return false;
}

async function requestOsFullscreen(host: HTMLElement | null): Promise<void> {
  if (Platform.OS !== 'web' || typeof document === 'undefined') {
    return;
  }
  if (getOsFullscreenElement()) {
    return;
  }
  const root = document.documentElement as FullscreenCapable;
  if (host && (await tryRequestFullscreen(host as FullscreenCapable))) {
    return;
  }
  // Modal host can refuse FS — fall back to the page root (true monitor fullscreen).
  await tryRequestFullscreen(root);
}

async function exitOsFullscreen(): Promise<void> {
  if (Platform.OS !== 'web' || typeof document === 'undefined') {
    return;
  }
  if (!getOsFullscreenElement()) {
    return;
  }
  const doc = document as FullscreenDocument;
  try {
    if (typeof document.exitFullscreen === 'function') {
      await document.exitFullscreen();
      return;
    }
    if (typeof doc.webkitExitFullscreen === 'function') {
      await doc.webkitExitFullscreen();
      return;
    }
    if (typeof doc.msExitFullscreen === 'function') {
      await doc.msExitFullscreen();
    }
  } catch {
    // ignore
  }
}

export const BARD_TILE_KEY = 'bard';

type OverlayTile = {
  key: string;
  /** LiveKit identity — one tile per participant; key === identity for people. */
  identity?: string;
  name: string;
  avatarUrl: string | null;
  speaking: boolean;
  muted: boolean;
  cameraOn: boolean;
  videoTrack: VideoTrack | null;
  /** Watching this participant's screen in their single tile (not a duplicate). */
  screenShareOn?: boolean;
  screenShareTrack?: VideoTrack | null;
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

function tileIdentity(tile: OverlayTile): string {
  return tile.identity ?? tile.key;
}

const SPEAKER_HOLD_MS = 1100;
const SPEAKER_SWITCH_SILENT_MS = 350;

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
  screenShareOn?: boolean;
  /** Currently watched screen-share identity (null = not watching / need pick). */
  selectedScreenIdentity?: string | null;
  /** All published screen shares for the picker. */
  screenStreams?: ChatLiveScreenStream[];
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
  /** Flip front ↔ rear while camera is on. */
  onSwitchCameraFacing?: () => void;
  /** Share monitor / window / tab. Quality required when starting (ignored when stopping). */
  onToggleScreenShare?: (quality?: ScreenShareQuality) => void;
  /** Subscribe to one screen share (null = stop watching). */
  onSelectScreenShare?: (identity: string | null) => void;
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
  bardQueue?: CallMusicQueueEntry[];
  bardLayerLive?: Record<string, CallMusicLayerLive>;
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
  onRemoveBardQueueEntry?: (entryId: string) => void;
  onToggleBardLayerPlay?: (entryId: string) => void;
  onSeekBardLayer?: (entryId: string, positionSec: number) => void;
  onSetBardLayerVolume?: (entryId: string, volume: number) => void;
  onToggleBardLayerLoop?: (entryId: string) => void;
  onToggleBardPlay?: () => void;
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
  onExpandStream,
  spotlight = false,
  compact = false,
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
  /** Screen-share only: enter stream cinema (full stage). */
  onExpandStream?: () => void;
  spotlight?: boolean;
  /** Filmstrip: tighter padding so the name fits inside the row budget. */
  compact?: boolean;
}) {
  const avatarOuter = avatarFrameOuterSize(avatarSize);
  const ringBox = avatarOuter + 8;
  const showingScreenShare = Boolean(tile.screenShareOn && tile.screenShareTrack);
  const displayTrack = showingScreenShare ? tile.screenShareTrack! : tile.videoTrack;
  const showVideo = Boolean(
    displayTrack && videoHeight && (showingScreenShare || tile.cameraOn),
  );
  const canAdjustVolume =
    Boolean(onToggleVolume && onVolumeChange) && !tile.isLocal && !tile.waiting;
  const volume = clamp01(tile.volume ?? 1);
  const mutedLocally = volume < 0.02;
  // Always horizontal overlay on media — vertical side dock gets clipped by filmstrip maxHeight.
  const volumeCaption = tile.isBard ? 'Громкость у тебя' : 'Громкость пользователя';
  const volumeChipTip = tile.isBard
    ? 'Громкость у тебя'
    : `Громкость · ${tile.name}`;
  const volumeDock =
    canAdjustVolume && volumeOpen && onVolumeChange ? (
      <View style={styles.volumeDockOverlay} pointerEvents="box-none">
        <ParticipantVolumeDock
          value={volume}
          onChange={onVolumeChange}
          orientation="horizontal"
          participantName={tile.name}
          caption={volumeCaption}
        />
      </View>
    ) : null;

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
        compact && styles.tileCompact,
        showVideo ? styles.tileVideo : null,
        spotlight && styles.tileSpotlight,
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
                    showingScreenShare && styles.videoFrameScreen,
                    {
                      height: videoHeight ?? 180,
                      borderColor: tile.urgent
                        ? '#ED4245'
                        : tile.speaking
                          ? '#23A559'
                          : 'rgba(255,255,255,0.08)',
                    },
                  ]}>
                  <CallVideoView
                    track={displayTrack}
                    mirror={tile.isLocal && !showingScreenShare}
                    objectFit={showingScreenShare ? 'contain' : 'cover'}
                  />
                  {showingScreenShare ? (
                    <View style={styles.videoScreenBadge} pointerEvents="none">
                      <Ionicons name="desktop-outline" size={12} color="#FFFFFF" />
                    </View>
                  ) : null}
                  {showingScreenShare && onExpandStream ? (
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel="Развернуть стрим на весь экран"
                      hitSlop={8}
                      onPress={onExpandStream}
                      style={({ pressed }) => [
                        styles.videoExpandBtn,
                        pressed && styles.pressed,
                      ]}>
                      <Ionicons name="expand" size={16} color="#FFFFFF" />
                    </Pressable>
                  ) : null}
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
            </View>
          ) : (
            <View
              style={[
                styles.avatarWrap,
                {
                  width: ringBox + (compact ? 8 : 28),
                  height: ringBox + (compact ? 8 : 28),
                },
              ]}>
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
            </View>
          )}

          {/* Full tile width — not inside avatarWrap (too narrow) or filmstrip side-clip. */}
          {volumeDock}

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
  screenShareOn = false,
  selectedScreenIdentity = null,
  screenStreams = [],
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
  onSwitchCameraFacing,
  onToggleScreenShare,
  onSelectScreenShare,
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
  bardQueue = [],
  bardLayerLive = {},
  bardLocalVolume = 1,
  bardGlobalVolume = 1,
  bardLocalDisplayName = 'Участник',
  onSummonBard,
  onDismissBard,
  onSetBardLocalVolume,
  onEnqueueBardTrack,
  onRemoveBardQueueEntry,
  onToggleBardLayerPlay,
  onSeekBardLayer,
  onSetBardLayerVolume,
  onToggleBardLayerLoop,
  onToggleBardPlay,
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
  const [spotlightKey, setSpotlightKey] = useState<string | null>(null);
  const spotlightKeyRef = useRef<string | null>(null);
  spotlightKeyRef.current = spotlightKey;
  const spotlightHoldRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** Target identity we're already waiting to promote — avoid reset on every speak tick. */
  const pendingSpotlightRef = useRef<string | null>(null);
  /** Fill the site viewport (call shell). Stream cinema separately uses OS fullscreen. */
  const [fullscreen, setFullscreen] = useState(false);
  /** Screen-share cinema: OS fullscreen + stream fills stage; speaker HUD top-right. */
  const [streamCinema, setStreamCinema] = useState(false);
  const cinemaHostRef = useRef<View>(null);
  const streamCinemaRef = useRef(false);
  streamCinemaRef.current = streamCinema;
  const [screenQualityOpen, setScreenQualityOpen] = useState(false);
  const [lastScreenQuality, setLastScreenQuality] = useState<ScreenShareQuality>('1080');
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
      setSpotlightKey(null);
      if (spotlightHoldRef.current) {
        clearTimeout(spotlightHoldRef.current);
        spotlightHoldRef.current = null;
      }
      pendingSpotlightRef.current = null;
      setFullscreen(false);
      setStreamCinema(false);
      setScreenQualityOpen(false);
      void exitOsFullscreen();
      savedMiniOffset = { x: 0, y: 0 };
      miniOffsetRef.current = savedMiniOffset;
      setMiniOffset(savedMiniOffset);
    }
  }, [visible]);

  const toggleFullscreen = useCallback(() => {
    setFullscreen((prev) => !prev);
  }, []);

  const enterStreamCinema = useCallback(() => {
    setStreamCinema(true);
    setFullscreen(true);
    setVolumeOpenId(null);
    void requestOsFullscreen(getWebHostNode(cinemaHostRef.current));
  }, []);

  const exitStreamCinema = useCallback(() => {
    setStreamCinema(false);
    void exitOsFullscreen();
  }, []);

  // Esc / browser exit → drop cinema mode together with OS fullscreen.
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') {
      return;
    }
    const onFsChange = () => {
      if (!getOsFullscreenElement() && streamCinemaRef.current) {
        setStreamCinema(false);
      }
    };
    document.addEventListener('fullscreenchange', onFsChange);
    document.addEventListener('webkitfullscreenchange', onFsChange as EventListener);
    return () => {
      document.removeEventListener('fullscreenchange', onFsChange);
      document.removeEventListener('webkitfullscreenchange', onFsChange as EventListener);
    };
  }, []);

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

  const needsScreenPick =
    screenStreams.length >= 2 && !selectedScreenIdentity && Boolean(onSelectScreenShare);

  /** Selected remote/local screen track — separate from person tiles (they stay in the rail). */
  const watchedScreen = useMemo(() => {
    if (!selectedScreenIdentity) {
      return null;
    }
    const p = participants.find((x) => x.identity === selectedScreenIdentity);
    if (!p?.screenShareOn || !p.screenShareTrack) {
      return null;
    }
    return {
      identity: p.identity,
      name: p.name,
      track: p.screenShareTrack,
      isLocal: p.isLocal,
    };
  }, [participants, selectedScreenIdentity]);

  const tiles = useMemo<OverlayTile[]>(() => {
    const live: OverlayTile[] = [];
    for (const p of participants) {
      const avatarUrl = p.isLocal && profileAvatarUrl ? profileAvatarUrl : p.avatarUrl;
      const volume = p.isLocal ? undefined : clamp01(volumeById[p.identity] ?? 1);
      const urgent = Boolean(urgentById[p.identity]);
      // Person tile always stays a person (speaking/camera). Stream is `watchedScreen`.
      live.push({
        key: p.identity,
        identity: p.identity,
        name: p.name,
        avatarUrl,
        speaking: p.speaking,
        muted: p.muted,
        cameraOn: p.cameraOn,
        videoTrack: p.videoTrack,
        screenShareOn: false,
        screenShareTrack: null,
        isLocal: p.isLocal,
        badges: p.badges,
        frameId: p.avatarFrameId,
        urgent,
        volume,
      });
    }
    const liveIds = new Set(live.map((p) => tileIdentity(p)));
    for (const peer of waitingPeers) {
      if (!peer.id || liveIds.has(peer.id)) {
        continue;
      }
      live.push({
        key: peer.id,
        identity: peer.id,
        name: peer.name,
        avatarUrl: peer.avatarUrl,
        speaking: false,
        muted: false,
        cameraOn: false,
        videoTrack: null,
        screenShareOn: false,
        screenShareTrack: null,
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
        identity: BARD_TILE_KEY,
        name: 'Бард',
        avatarUrl: null,
        speaking: Boolean(bardPlaying),
        muted: false,
        cameraOn: false,
        videoTrack: null,
        screenShareOn: false,
        screenShareTrack: null,
        isLocal: false,
        isBard: true,
        bardPlaque: bardTrackTitle,
        bardPlaying,
        bardLoading,
        volume: clamp01(bardLocalVolume),
      });
    }
    // Screens first among a peer, local first, bard near end, waiting last.
    return live.sort((a, b) => {
      if (Boolean(a.screenShareOn) !== Boolean(b.screenShareOn)) {
        return a.screenShareOn ? -1 : 1;
      }
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

  // Speaker moves between stage/rail. Watching a stream uses a separate stage (not a person tile).
  useEffect(() => {
    const clearHold = () => {
      if (spotlightHoldRef.current) {
        clearTimeout(spotlightHoldRef.current);
        spotlightHoldRef.current = null;
      }
      pendingSpotlightRef.current = null;
    };

    if (!tiles.length) {
      clearHold();
      setSpotlightKey(null);
      return;
    }

    // Stream on stage — don't promote the sharer out of the people rail.
    if (watchedScreen || needsScreenPick) {
      clearHold();
      if (spotlightKeyRef.current != null) {
        setSpotlightKey(null);
      }
      return;
    }

    const people = tiles.filter((t) => !t.waiting && !t.isBard);
    const speakers = people.filter((t) => t.speaking);
    const fallback =
      people.find((t) => t.key === spotlightKeyRef.current) ??
      people.find((t) => !t.isLocal) ??
      people[0] ??
      tiles[0] ??
      null;
    const prev = spotlightKeyRef.current;

    if (!speakers.length) {
      // Keep current stage occupant while silence; only repair missing key.
      if (!prev || !tiles.some((t) => t.key === prev)) {
        clearHold();
        setSpotlightKey(fallback?.key ?? null);
      }
      return;
    }

    // Prefer remote speaker when several talk; else first speaking.
    const preferred = speakers.find((t) => !t.isLocal) ?? speakers[0]!;

    if (!prev || !tiles.some((t) => t.key === prev)) {
      clearHold();
      setSpotlightKey(preferred.key);
      return;
    }
    if (prev === preferred.key) {
      clearHold();
      return;
    }
    // Already counting down toward this speaker — don't reset the hold.
    if (pendingSpotlightRef.current === preferred.key && spotlightHoldRef.current) {
      return;
    }

    const current = tiles.find((t) => t.key === prev);
    // Stage person silent → swap fast; both talking → short hold to avoid flicker.
    const delay = current?.speaking ? SPEAKER_HOLD_MS : SPEAKER_SWITCH_SILENT_MS;
    if (spotlightHoldRef.current) {
      clearTimeout(spotlightHoldRef.current);
    }
    pendingSpotlightRef.current = preferred.key;
    spotlightHoldRef.current = setTimeout(() => {
      spotlightHoldRef.current = null;
      pendingSpotlightRef.current = null;
      setSpotlightKey(preferred.key);
    }, delay);
  }, [needsScreenPick, tiles, watchedScreen]);

  useEffect(
    () => () => {
      if (spotlightHoldRef.current) {
        clearTimeout(spotlightHoldRef.current);
        spotlightHoldRef.current = null;
      }
      pendingSpotlightRef.current = null;
    },
    [],
  );

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

  /**
   * Watching a stream: everyone stays in the rail (including the sharer).
   * Otherwise: speaker moves to stage, unique in the rail.
   */
  const { spotlightTile, filmstripTiles, useSpotlight } = useMemo(() => {
    if (watchedScreen || needsScreenPick) {
      return {
        spotlightTile: null as OverlayTile | null,
        filmstripTiles: tiles,
        useSpotlight: true,
      };
    }
    const spotlight =
      tiles.length >= 2
        ? (spotlightKey ? tiles.find((t) => t.key === spotlightKey) : null) ??
          tiles.find((t) => !t.waiting && !t.isBard) ??
          tiles[0] ??
          null
        : null;
    if (!spotlight) {
      return {
        spotlightTile: null as OverlayTile | null,
        filmstripTiles: tiles,
        useSpotlight: false,
      };
    }
    const stageId = tileIdentity(spotlight);
    return {
      spotlightTile: spotlight,
      filmstripTiles: tiles.filter((t) => tileIdentity(t) !== stageId),
      useSpotlight: true,
    };
  }, [needsScreenPick, spotlightKey, tiles, watchedScreen]);

  const streamCinemaTrack = watchedScreen?.track ?? null;

  /** Live speaker only — HUD must not keep a stale "speaking" snapshot. */
  const liveSpeaker = useMemo(() => {
    const people = tiles.filter((t) => !t.waiting && !t.isBard && t.speaking);
    return people.find((t) => !t.isLocal) ?? people[0] ?? null;
  }, [tiles]);

  useEffect(() => {
    if (!watchedScreen) {
      setStreamCinema(false);
      void exitOsFullscreen();
    }
  }, [watchedScreen]);

  const showConnectionBanner =
    linking || failed || connection.tone === 'warn';

  const layout = useMemo(() => {
    const count = Math.max(tiles.length, 1);
    const stagePad = fullscreen ? Spacing.md * 2 : Spacing.md * 4;
    const stageWidth = Math.min(
      width - stagePad,
      fullscreen ? width - stagePad : isDesktop ? 920 : width - 48,
    );
    const hasScreenShare = Boolean(watchedScreen);
    const videoMode =
      hasScreenShare || tiles.some((tile) => tile.cameraOn);

    // Fit stage into the shell without vertical scroll.
    const rootPadY = fullscreen
      ? 0
      : Math.max(insets.top, Spacing.md) + Math.max(insets.bottom, Spacing.md);
    const shellCap = fullscreen
      ? Math.max(280, height - rootPadY)
      : Math.max(280, Math.min(height * 0.86, height - rootPadY));
    const headerH = 72;
    const controlsH = 96;
    const bannerH = showConnectionBanner ? 58 : 0;
    const pickerH = screenStreams.length >= 2 ? 52 : 0;
    const stageBudget = Math.max(160, shellCap - headerH - controlsH - bannerH - pickerH);

    if (watchedScreen || needsScreenPick || (useSpotlight && spotlightTile)) {
      const filmGap = 8;
      const hasFilm = filmstripTiles.length > 0;
      const volumeOpenInFilm = Boolean(
        volumeOpenId && filmstripTiles.some((t) => t.key === volumeOpenId),
      );
      // Same card chrome for film + spot (padding + gap + name) — square around the user.
      const cardPad = 20; // tileCompact vertical padding * 2-ish
      const cardGap = 8;
      const nameH = 18;
      const cardChrome = cardPad + cardGap + nameH;
      const filmAvatar = videoMode ? 40 : 44;
      // avatarWrap ≈ ringBox+8 (compact); ringBox ≈ avatar+~20
      const filmMediaH = filmAvatar + 28;
      const filmTileWidth = Math.min(
        fullscreen ? 140 : 120,
        Math.max(filmMediaH + 12, Math.floor(stageWidth / (fullscreen ? 7 : 5.5))),
      );
      // Watching a stream: filmstrip tiles are people (avatar), not camera previews.
      const filmVideoHeight =
        watchedScreen || needsScreenPick
          ? null
          : videoMode
            ? Math.max(48, Math.min(72, Math.round(filmTileWidth * 0.55)))
            : null;
      const filmBodyH = (filmVideoHeight ?? filmMediaH) + cardChrome;
      const filmRowBudget = hasFilm
        ? filmBodyH + (volumeOpenInFilm ? 24 : 0)
        : 0;
      const spotRowBudget = Math.max(120, stageBudget - filmRowBudget - (hasFilm ? 10 : 0));

      if (watchedScreen || needsScreenPick) {
        return {
          mode: 'stream' as const,
          stageWidth,
          stageBudget,
          spotlightWidth: stageWidth,
          spotlightAvatar: filmAvatar,
          spotlightVideoHeight: Math.max(160, spotRowBudget),
          filmGap,
          filmTileWidth,
          filmAvatar,
          filmVideoHeight,
          filmRowBudget,
          gap: filmGap,
          tileWidth: filmTileWidth,
          avatarSize: filmAvatar,
          videoHeight: filmVideoHeight,
          columns: 1,
        };
      }

      // Spotlight = larger copy of the same square card (not full-bleed stage width).
      const spotlightAvatar = Math.min(
        isDesktop ? 112 : 96,
        Math.max(64, Math.min(filmAvatar * 2.2, spotRowBudget - cardChrome - 36)),
      );
      const spotMediaH = spotlightAvatar + 36;
      const spotlightWidth = videoMode
        ? Math.min(stageWidth, Math.max(280, Math.round(spotRowBudget * 1.35)))
        : Math.min(stageWidth, Math.max(filmTileWidth, spotMediaH + 16));
      const spotlightVideoHeight = videoMode
        ? Math.max(
            120,
            Math.min(spotRowBudget - cardChrome, Math.round(spotlightWidth * 0.5)),
          )
        : null;
      return {
        mode: 'spotlight' as const,
        stageWidth,
        stageBudget,
        spotlightWidth,
        spotlightAvatar,
        spotlightVideoHeight,
        filmGap,
        filmTileWidth,
        filmAvatar,
        filmVideoHeight,
        filmRowBudget,
        gap: filmGap,
        tileWidth: filmTileWidth,
        avatarSize: filmAvatar,
        videoHeight: filmVideoHeight,
        columns: 1,
      };
    }

    let columns = 1;
    if (count === 2) {
      columns = 2;
    } else if (count === 3) {
      columns = width < 420 ? 2 : 3;
    } else if (count >= 4) {
      columns = width < 420 ? 2 : 3;
    }
    const gap = count >= 5 ? 10 : 12;
    const rows = Math.ceil(count / columns);
    const tileWidth = Math.floor((stageWidth - gap * (columns - 1)) / columns);
    const cellH = Math.floor((stageBudget - gap * Math.max(0, rows - 1)) / rows);
    const tileChrome = 44;
    let avatarSize = Math.min(isDesktop ? 112 : 96, Math.max(44, cellH - tileChrome));
    avatarSize = Math.min(avatarSize, Math.max(44, tileWidth - 48));
    const videoHeight = videoMode
      ? Math.max(96, Math.min(cellH - tileChrome, Math.round(tileWidth * (hasScreenShare ? 0.55 : 0.62))))
      : null;
    return {
      mode: 'grid' as const,
      columns,
      gap,
      tileWidth,
      avatarSize,
      stageWidth,
      stageBudget,
      videoHeight,
      spotlightWidth: tileWidth,
      spotlightAvatar: avatarSize,
      spotlightVideoHeight: videoHeight,
      filmGap: gap,
      filmTileWidth: tileWidth,
      filmAvatar: avatarSize,
      filmVideoHeight: videoHeight,
      filmRowBudget: 0,
    };
  }, [
    filmstripTiles,
    fullscreen,
    height,
    insets.bottom,
    insets.top,
    isDesktop,
    screenStreams.length,
    showConnectionBanner,
    spotlightTile,
    tiles,
    useSpotlight,
    volumeOpenId,
    watchedScreen,
    width,
  ]);

  if (!visible) {
    return null;
  }

  const statusColor = connection.color;
  const timerLabel = formatCallDuration(elapsedSec);

  // Cinema only + currently speaking (small stream window uses the people rail).
  const streamSpeakerHud =
    streamCinema && watchedScreen && liveSpeaker ? (
      <View style={[styles.streamSpeakerHud, styles.streamSpeakerHudLive]} pointerEvents="none">
        <UserAvatar
          nickname={liveSpeaker.name}
          avatarUrl={
            liveSpeaker.isLocal && profileAvatarUrl
              ? profileAvatarUrl
              : liveSpeaker.avatarUrl
          }
          size={36}
          badges={liveSpeaker.badges}
          frameId={liveSpeaker.frameId}
        />
        <View style={styles.streamSpeakerHudCopy}>
          <Text style={styles.streamSpeakerHudEyebrow} numberOfLines={1}>
            Сейчас говорит
          </Text>
          <Text style={styles.streamSpeakerHudName} numberOfLines={1}>
            {liveSpeaker.isLocal ? `${liveSpeaker.name} (вы)` : liveSpeaker.name}
          </Text>
        </View>
        {liveSpeaker.muted ? (
          <Ionicons name="mic-off" size={14} color="#FFB4B4" />
        ) : (
          <View style={styles.streamSpeakerHudDot} />
        )}
      </View>
    ) : null;

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
          {onSwitchCameraFacing && cameraOn && !pinToTop ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Переключить камеру"
              onPress={onSwitchCameraFacing}
              style={({ pressed }) => [styles.miniCtrl, pressed && styles.pressed]}>
              <Ionicons name="camera-reverse-outline" size={18} color="#FFFFFF" />
            </Pressable>
          ) : null}
          {onToggleScreenShare && !pinToTop ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={
                screenShareOn
                  ? 'Остановить демонстрацию (Ctrl+Shift+S)'
                  : 'Демонстрация экрана (Ctrl+Shift+S)'
              }
              onPress={() => {
                if (screenShareOn) {
                  onToggleScreenShare();
                  return;
                }
                onToggleScreenShare(lastScreenQuality);
              }}
              style={({ pressed }) => [
                styles.miniCtrl,
                !screenShareOn && styles.miniCtrlOff,
                screenShareOn && styles.miniCtrlScreenOn,
                pressed && styles.pressed,
              ]}>
              <Ionicons
                name={screenShareOn ? 'desktop' : 'desktop-outline'}
                size={18}
                color="#FFFFFF"
              />
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
      <View ref={cinemaHostRef} style={styles.modalRoot}>
        <View
          style={[
            styles.root,
            fullscreen && styles.rootFullscreen,
            streamCinema && styles.rootStreamCinema,
            {
              paddingTop: fullscreen || streamCinema ? 0 : Math.max(insets.top, Spacing.md),
              paddingBottom: fullscreen || streamCinema ? 0 : Math.max(insets.bottom, Spacing.md),
            },
          ]}>
          {onMinimize && !fullscreen ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Свернуть звонок"
              onPress={onMinimize}
              style={styles.backdropHit}
            />
          ) : null}
        <View
          style={[
            styles.shell,
            isDesktop && styles.shellDesktop,
            (fullscreen || streamCinema) && styles.shellFullscreen,
            streamCinema && styles.shellStreamCinema,
          ]}>
          {!streamCinema ? (
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
              {watchedScreen ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Развернуть стрим на весь монитор"
                  onPress={enterStreamCinema}
                  style={({ pressed }) => [styles.headerAction, pressed && styles.pressed]}>
                  <Ionicons name="scan-outline" size={20} color="#F2F3F5" />
                </Pressable>
              ) : null}
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={
                  fullscreen ? 'Свернуть звонок в окно' : 'Развернуть звонок на окно сайта'
                }
                onPress={toggleFullscreen}
                style={({ pressed }) => [styles.headerAction, pressed && styles.pressed]}>
                <Ionicons
                  name={fullscreen ? 'contract' : 'expand'}
                  size={20}
                  color="#F2F3F5"
                />
              </Pressable>
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
          ) : null}

          {!streamCinema && showConnectionBanner ? (
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
                  ]}
                  numberOfLines={1}>
                  {connection.label}
                </Text>
                {connection.detail ? (
                  <Text style={styles.connectionBannerDetail} numberOfLines={2}>
                    {connection.detail}
                  </Text>
                ) : null}
              </View>
            </View>
          ) : null}

          <View style={styles.stage}>
            {streamCinema && streamCinemaTrack ? (
              <View style={styles.streamCinemaStage}>
                <CallVideoView
                  track={streamCinemaTrack}
                  mirror={false}
                  objectFit="contain"
                />
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Свернуть стрим"
                  onPress={exitStreamCinema}
                  style={({ pressed }) => [
                    styles.streamCinemaExit,
                    pressed && styles.pressed,
                  ]}>
                  <Ionicons name="contract" size={18} color="#FFFFFF" />
                  <Text style={styles.streamCinemaExitLabel}>Свернуть</Text>
                </Pressable>
                {streamSpeakerHud}
              </View>
            ) : (
            <View style={[styles.stageInner, { width: layout.stageWidth }]}>
              {screenStreams.length >= 2 && onSelectScreenShare ? (
                <View style={[styles.screenPicker, { width: layout.stageWidth }]}>
                  <Text style={styles.screenPickerLabel}>
                    {needsScreenPick ? 'Выбери трансляцию' : 'Трансляции'}
                  </Text>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.screenPickerRow}>
                    {screenStreams.map((stream) => {
                      const active = selectedScreenIdentity === stream.identity;
                      return (
                        <Pressable
                          key={stream.identity}
                          accessibilityRole="button"
                          accessibilityLabel={
                            active
                              ? `Стоп просмотра: ${stream.name}`
                              : `Смотреть экран: ${stream.name}`
                          }
                          onPress={() =>
                            onSelectScreenShare(active ? null : stream.identity)
                          }
                          style={({ pressed }) => [
                            styles.screenPickerChip,
                            active && styles.screenPickerChipActive,
                            pressed && styles.pressed,
                          ]}>
                          <Ionicons
                            name="desktop-outline"
                            size={14}
                            color={active ? '#FFFFFF' : '#B5BAC1'}
                          />
                          <Text
                            style={[
                              styles.screenPickerChipText,
                              active && styles.screenPickerChipTextActive,
                            ]}
                            numberOfLines={1}>
                            {stream.isLocal ? 'Мой экран' : stream.name}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </ScrollView>
                </View>
              ) : null}

              {needsScreenPick ? (
                <View
                  style={[
                    styles.screenPickPrompt,
                    { width: layout.stageWidth, maxHeight: layout.stageBudget },
                  ]}>
                  <Ionicons name="tv-outline" size={36} color="#B5BAC1" />
                  <Text style={styles.screenPickPromptTitle}>Несколько трансляций</Text>
                  <Text style={styles.screenPickPromptDetail}>
                    Выбери, чей экран смотреть — поток пойдёт только после выбора
                  </Text>
                </View>
              ) : watchedScreen ? (
                <View style={[styles.spotlightStage, { width: layout.stageWidth }]}>
                  <View
                    style={[
                      styles.streamWatchMain,
                      { height: layout.spotlightVideoHeight ?? 220 },
                    ]}>
                    <CallVideoView
                      track={watchedScreen.track}
                      mirror={false}
                      objectFit="contain"
                    />
                    <View style={styles.streamWatchChrome} pointerEvents="box-none">
                      <View style={styles.streamWatchLabel} pointerEvents="none">
                        <Ionicons name="desktop-outline" size={12} color="#FFFFFF" />
                        <Text style={styles.streamWatchLabelText} numberOfLines={1}>
                          {watchedScreen.isLocal
                            ? 'Твой экран'
                            : `${watchedScreen.name} · экран`}
                        </Text>
                      </View>
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel="Развернуть стрим на весь монитор"
                        hitSlop={8}
                        onPress={enterStreamCinema}
                        style={({ pressed }) => [
                          styles.streamWatchExpandBtn,
                          pressed && styles.pressed,
                        ]}>
                        <Ionicons name="expand" size={16} color="#FFFFFF" />
                      </Pressable>
                    </View>
                  </View>
                  {filmstripTiles.length > 0 ? (
                    <ScrollView
                      horizontal
                      showsHorizontalScrollIndicator={false}
                      style={[
                        styles.filmstripScroll,
                        layout.filmRowBudget
                          ? { maxHeight: layout.filmRowBudget }
                          : null,
                      ]}
                      contentContainerStyle={[
                        styles.filmstrip,
                        { gap: layout.filmGap },
                      ]}>
                      {filmstripTiles.map((tile) => (
                        <ParticipantTile
                          key={tile.key}
                          tile={tile}
                          avatarSize={layout.filmAvatar}
                          tileWidth={layout.filmTileWidth}
                          videoHeight={layout.filmVideoHeight}
                          compact
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
                                ? (volume) =>
                                    onSetParticipantVolume(tileIdentity(tile), volume)
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
                    </ScrollView>
                  ) : null}
                </View>
              ) : layout.mode === 'spotlight' && spotlightTile ? (
                <View style={[styles.spotlightStage, { width: layout.stageWidth }]}>
                  <View style={styles.spotlightMain}>
                    <ParticipantTile
                      tile={spotlightTile}
                      avatarSize={layout.spotlightAvatar}
                      tileWidth={layout.spotlightWidth}
                      videoHeight={layout.spotlightVideoHeight}
                      spotlight
                      volumeOpen={volumeOpenId === spotlightTile.key}
                      onToggleVolume={
                        spotlightTile.isBard
                          ? onSetBardLocalVolume
                            ? () =>
                                setVolumeOpenId((current) =>
                                  current === spotlightTile.key ? null : spotlightTile.key,
                                )
                            : undefined
                          : onSetParticipantVolume &&
                              !spotlightTile.isLocal &&
                              !spotlightTile.waiting
                            ? () =>
                                setVolumeOpenId((current) =>
                                  current === spotlightTile.key ? null : spotlightTile.key,
                                )
                            : undefined
                      }
                      onVolumeChange={
                        spotlightTile.isBard
                          ? onSetBardLocalVolume
                          : onSetParticipantVolume &&
                              !spotlightTile.isLocal &&
                              !spotlightTile.waiting
                            ? (volume) =>
                                onSetParticipantVolume(tileIdentity(spotlightTile), volume)
                            : undefined
                      }
                      onPress={
                        spotlightTile.isBard
                          ? () => {
                              onResumeBardAudio?.();
                              setBardSheetOpen(true);
                            }
                          : undefined
                      }
                    />
                  </View>
                  {filmstripTiles.length > 0 ? (
                    <ScrollView
                      horizontal
                      showsHorizontalScrollIndicator={false}
                      style={[
                        styles.filmstripScroll,
                        layout.filmRowBudget
                          ? { maxHeight: layout.filmRowBudget }
                          : null,
                      ]}
                      contentContainerStyle={[
                        styles.filmstrip,
                        { gap: layout.filmGap },
                      ]}>
                      {filmstripTiles.map((tile) => (
                        <ParticipantTile
                          key={tile.key}
                          tile={tile}
                          avatarSize={layout.filmAvatar}
                          tileWidth={layout.filmTileWidth}
                          videoHeight={layout.filmVideoHeight}
                          compact
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
                                ? (volume) =>
                                    onSetParticipantVolume(tileIdentity(tile), volume)
                                : undefined
                          }
                          onPress={
                            tile.isBard
                              ? () => {
                                  onResumeBardAudio?.();
                                  setBardSheetOpen(true);
                                }
                              : () => {
                                  if (spotlightHoldRef.current) {
                                    clearTimeout(spotlightHoldRef.current);
                                    spotlightHoldRef.current = null;
                                  }
                                  pendingSpotlightRef.current = null;
                                  setSpotlightKey(tile.key);
                                }
                          }
                        />
                      ))}
                    </ScrollView>
                  ) : null}
                </View>
              ) : (
                <View
                  style={[
                    styles.grid,
                    {
                      width: layout.stageWidth,
                      gap: layout.gap,
                      maxHeight: layout.stageBudget,
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
                            ? (volume) =>
                                onSetParticipantVolume(tileIdentity(tile), volume)
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
              )}
            </View>
            )}
          </View>

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

            {onSwitchCameraFacing && cameraOn ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Переключить камеру"
                disabled={!mediaReady}
                onPress={onSwitchCameraFacing}
                style={({ pressed }) => [
                  styles.controlBtn,
                  styles.controlBtnSecondary,
                  pressed && styles.pressed,
                  !mediaReady && styles.controlDisabled,
                ]}>
                <Ionicons name="camera-reverse-outline" size={22} color="#FFFFFF" />
              </Pressable>
            ) : null}

            {onToggleScreenShare ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={
                  screenShareOn
                    ? 'Остановить демонстрацию (Ctrl+Shift+S)'
                    : 'Демонстрация экрана — выбрать качество'
                }
                accessibilityState={{ selected: screenShareOn, expanded: screenQualityOpen }}
                disabled={!mediaReady}
                onPress={() => {
                  if (screenShareOn) {
                    setScreenQualityOpen(false);
                    onToggleScreenShare();
                    return;
                  }
                  setScreenQualityOpen((open) => !open);
                }}
                style={({ pressed }) => [
                  styles.controlBtn,
                  screenShareOn ? styles.controlBtnScreenOn : styles.controlBtnSecondary,
                  screenQualityOpen && styles.controlBtnScreenOn,
                  pressed && styles.pressed,
                  !mediaReady && styles.controlDisabled,
                ]}>
                <Ionicons
                  name={screenShareOn ? 'desktop' : 'desktop-outline'}
                  size={22}
                  color="#FFFFFF"
                />
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
                    ? 'Треки и библиотека Барда'
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

    <Modal
      visible={Boolean(visible && !minimized && screenQualityOpen && !screenShareOn)}
      transparent
      animationType="fade"
      onRequestClose={() => setScreenQualityOpen(false)}>
      <Pressable
        style={styles.screenQualityBackdrop}
        onPress={() => setScreenQualityOpen(false)}>
        <View style={styles.screenQualityCard} pointerEvents="box-none">
          <Text style={styles.screenQualityTitle}>Качество трансляции</Text>
          <Text style={styles.screenQualityHint}>Всегда 30 кадров/с · затем выбор окна</Text>
          <View style={styles.screenQualityRow}>
            {SCREEN_SHARE_QUALITY_OPTIONS.map((option) => {
              const active = lastScreenQuality === option.id;
              return (
                <Pressable
                  key={option.id}
                  accessibilityRole="button"
                  accessibilityLabel={`${option.label}, ${option.hint}`}
                  accessibilityState={{ selected: active }}
                  onPress={() => {
                    setLastScreenQuality(option.id);
                    setScreenQualityOpen(false);
                    onToggleScreenShare?.(option.id);
                  }}
                  style={({ pressed }) => [
                    styles.screenQualityChip,
                    active && styles.screenQualityChipActive,
                    pressed && styles.pressed,
                  ]}>
                  <Text
                    style={[
                      styles.screenQualityChipLabel,
                      active && styles.screenQualityChipLabelActive,
                    ]}>
                    {option.label}
                  </Text>
                  <Text
                    style={[
                      styles.screenQualityChipHint,
                      active && styles.screenQualityChipHintActive,
                    ]}>
                    {option.hint}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Отмена"
            onPress={() => setScreenQualityOpen(false)}
            style={({ pressed }) => [styles.screenQualityCancel, pressed && styles.pressed]}>
            <Text style={styles.screenQualityCancelText}>Отмена</Text>
          </Pressable>
        </View>
      </Pressable>
    </Modal>
    {diceLayer}
    <CallBardSheet
      visible={bardSheetOpen && bardPresent}
      canControl={canControlMusic}
      localDisplayName={bardLocalDisplayName}
      trackTitle={bardTrackTitle}
      globalVolume={bardGlobalVolume}
      queue={bardQueue}
      layerLive={bardLayerLive}
      onClose={() => setBardSheetOpen(false)}
      onEnqueueTrack={(trackId, title, durationSec, playUrl) =>
        onEnqueueBardTrack?.(trackId, title, durationSec, playUrl)
      }
      onRemoveQueueEntry={(entryId) => onRemoveBardQueueEntry?.(entryId)}
      onToggleLayerPlay={(entryId) => onToggleBardLayerPlay?.(entryId)}
      onSeekLayer={(entryId, positionSec) => onSeekBardLayer?.(entryId, positionSec)}
      onLayerVolumeChange={(entryId, volume) => onSetBardLayerVolume?.(entryId, volume)}
      onToggleLayerLoop={(entryId) => onToggleBardLayerLoop?.(entryId)}
      onPauseAll={() => onToggleBardPlay?.()}
      anyPlaying={bardPlaying}
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
  rootFullscreen: {
    paddingHorizontal: 0,
    backgroundColor: '#111214',
  },
  rootStreamCinema: {
    paddingHorizontal: 0,
    backgroundColor: '#0B0C0E',
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
  miniCtrlScreenOn: {
    backgroundColor: '#5865F2',
  },
  miniCtrlHangup: {
    backgroundColor: '#ED4245',
  },
  shell: {
    flex: 1,
    width: '100%',
    maxWidth: 720,
    maxHeight: '86%',
    borderRadius: 20,
    backgroundColor: '#1E1F22',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    zIndex: 1,
  },
  shellDesktop: {
    maxWidth: 980,
  },
  shellFullscreen: {
    flex: 1,
    flexGrow: 1,
    width: '100%',
    maxWidth: '100%',
    minHeight: '100%',
    maxHeight: '100%',
    borderRadius: 0,
    borderWidth: 0,
  },
  shellStreamCinema: {
    backgroundColor: '#0B0C0E',
  },
  streamCinemaStage: {
    flex: 1,
    minHeight: 0,
    width: '100%',
    position: 'relative',
    backgroundColor: '#0B0C0E',
  },
  streamWatchMain: {
    width: '100%',
    position: 'relative',
    overflow: 'hidden',
    borderRadius: 14,
    backgroundColor: '#0B0C0E',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  streamWatchChrome: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 2,
  },
  streamWatchLabel: {
    position: 'absolute',
    left: 10,
    bottom: 10,
    maxWidth: '70%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: 'rgba(15, 16, 18, 0.78)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  streamWatchLabelText: {
    color: '#F2F3F5',
    fontSize: 12,
    fontWeight: '700',
  },
  streamWatchExpandBtn: {
    position: 'absolute',
    right: 10,
    bottom: 10,
    zIndex: 3,
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(15, 16, 18, 0.78)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
  },
  streamCinemaExit: {
    position: 'absolute',
    top: Spacing.md,
    left: Spacing.md,
    zIndex: 4,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: 'rgba(15, 16, 18, 0.78)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
  },
  streamCinemaExitLabel: {
    color: '#F2F3F5',
    fontSize: 13,
    fontWeight: '700',
  },
  streamSpeakerHud: {
    position: 'absolute',
    top: Spacing.md,
    right: Spacing.md,
    zIndex: 4,
    maxWidth: 220,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 14,
    backgroundColor: 'rgba(15, 16, 18, 0.82)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  streamSpeakerHudLive: {
    borderColor: 'rgba(35, 165, 89, 0.85)',
  },
  streamSpeakerHudCopy: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  streamSpeakerHudEyebrow: {
    color: '#B5BAC1',
    fontSize: 10,
    fontWeight: '600',
  },
  streamSpeakerHudName: {
    color: '#F2F3F5',
    fontSize: 13,
    fontWeight: '700',
  },
  streamSpeakerHudDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#23A559',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    flexShrink: 0,
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
    flexShrink: 0,
    gap: 10,
    marginHorizontal: Spacing.md,
    marginBottom: Spacing.sm,
    paddingHorizontal: 14,
    paddingVertical: 10,
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
  stage: {
    flex: 1,
    minHeight: 0,
    width: '100%',
  },
  stageInner: {
    flex: 1,
    minHeight: 0,
    alignSelf: 'center',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.sm,
    gap: 8,
  },
  screenPicker: {
    flexGrow: 0,
    flexShrink: 0,
    gap: 6,
    paddingHorizontal: 4,
  },
  screenPickerLabel: {
    color: '#B5BAC1',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  screenPickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 2,
  },
  screenPickerChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    maxWidth: 180,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  screenPickerChipActive: {
    backgroundColor: 'rgba(88, 101, 242, 0.45)',
    borderColor: 'rgba(88, 101, 242, 0.8)',
  },
  screenPickerChipText: {
    color: '#B5BAC1',
    fontSize: 13,
    fontWeight: '600',
    flexShrink: 1,
  },
  screenPickerChipTextActive: {
    color: '#FFFFFF',
  },
  screenPickPrompt: {
    flex: 1,
    minHeight: 120,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingHorizontal: Spacing.lg,
  },
  screenPickPromptTitle: {
    color: '#F2F3F5',
    fontSize: FontSize.button,
    fontWeight: '700',
    textAlign: 'center',
  },
  screenPickPromptDetail: {
    color: '#B5BAC1',
    fontSize: 13,
    lineHeight: 18,
    textAlign: 'center',
    maxWidth: 320,
  },
  spotlightStage: {
    flex: 1,
    minHeight: 0,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  spotlightMain: {
    flex: 1,
    minHeight: 0,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  filmstripScroll: {
    width: '100%',
    flexGrow: 0,
    flexShrink: 0,
    overflow: 'visible',
  },
  filmstrip: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'center',
    paddingHorizontal: 4,
    paddingBottom: 2,
    overflow: 'visible',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    alignContent: 'center',
    overflow: 'hidden',
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
  tileCompact: {
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 8,
  },
  tileSpotlight: {
    // Same card chrome as filmstrip — only scale, don't stretch to stage width.
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 10,
    backgroundColor: '#1E1F22',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  tileVideo: {
    paddingHorizontal: 6,
    paddingTop: 6,
    paddingBottom: 6,
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
  videoFrameScreen: {
    backgroundColor: '#0B0C0E',
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
  videoScreenBadge: {
    position: 'absolute',
    left: 8,
    top: 8,
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(88, 101, 242, 0.95)',
    borderWidth: 2,
    borderColor: '#2B2D31',
  },
  videoExpandBtn: {
    position: 'absolute',
    top: 8,
    right: 8,
    zIndex: 3,
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(15, 16, 18, 0.78)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
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
    flexShrink: 0,
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
    overflow: 'visible',
    zIndex: 1,
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
    left: 6,
    right: 6,
    bottom: 6,
    zIndex: 5,
    minWidth: 0,
  },
  volumeDock: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 14,
    backgroundColor: 'rgba(15, 16, 18, 0.88)',
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
    minWidth: 0,
  },
  volumeDockControlsHorizontal: {
    flexDirection: 'row',
    width: '100%',
    minWidth: 0,
  },
  volumeDockControlsVertical: {
    flexDirection: 'column',
  },
  volumeDockHorizontal: {
    width: '100%',
    minWidth: 0,
    alignSelf: 'stretch',
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
    flexShrink: 0,
  },
  volumeMuteBtnActive: {
    backgroundColor: '#ED4245',
  },
  volumeTrackHit: {
    flexGrow: 1,
    flexShrink: 1,
    flexBasis: 0,
    justifyContent: 'center',
    position: 'relative',
    minWidth: 0,
  },
  volumeTrackHitHorizontal: {
    height: 28,
    minWidth: 72,
    alignItems: 'stretch',
  },
  volumeTrackHitVertical: {
    width: 28,
    height: 96,
    flexGrow: 0,
    flexShrink: 0,
    flexBasis: 96,
    alignItems: 'center',
  },
  volumeTrackRail: {
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.16)',
    overflow: 'hidden',
  },
  volumeTrackRailHorizontal: {
    alignSelf: 'stretch',
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
    flexShrink: 0,
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
    flexShrink: 0,
    flexWrap: 'wrap',
    gap: 10,
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.md,
    paddingTop: Spacing.xs,
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
  controlBtnScreenOn: {
    backgroundColor: '#5865F2',
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
  screenQualityBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.lg,
  },
  screenQualityCard: {
    width: '100%',
    maxWidth: 360,
    borderRadius: 16,
    padding: Spacing.md,
    gap: 10,
    backgroundColor: '#2B2D31',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  screenQualityTitle: {
    color: '#F2F3F5',
    fontSize: FontSize.body,
    fontWeight: '700',
    textAlign: 'center',
  },
  screenQualityHint: {
    color: '#B5BAC1',
    fontSize: 12,
    fontWeight: '500',
    textAlign: 'center',
    marginBottom: 4,
  },
  screenQualityRow: {
    flexDirection: 'row',
    gap: 8,
  },
  screenQualityChip: {
    flex: 1,
    minWidth: 0,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 8,
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  screenQualityChipActive: {
    backgroundColor: 'rgba(88, 101, 242, 0.35)',
    borderColor: 'rgba(132, 185, 255, 0.65)',
  },
  screenQualityChipLabel: {
    color: '#F2F3F5',
    fontSize: 15,
    fontWeight: '800',
  },
  screenQualityChipLabelActive: {
    color: '#FFFFFF',
  },
  screenQualityChipHint: {
    color: '#949BA4',
    fontSize: 11,
    fontWeight: '500',
    textAlign: 'center',
  },
  screenQualityChipHintActive: {
    color: '#DCDDDE',
  },
  screenQualityCancel: {
    alignSelf: 'center',
    paddingVertical: 8,
    paddingHorizontal: 16,
    marginTop: 2,
  },
  screenQualityCancelText: {
    color: '#B5BAC1',
    fontSize: 13,
    fontWeight: '600',
  },
  pressed: {
    opacity: 0.82,
    transform: [{ scale: 0.97 }],
  },
});
