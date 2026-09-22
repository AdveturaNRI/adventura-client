import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useIsDesktopWeb } from '@/components/navigation/DesktopThemeToggle';
import { avatarFrameOuterSize } from '@/components/rewards/AvatarFrame';
import { NameWithBadges } from '@/components/rewards/RewardBadge';
import { UserAvatar } from '@/components/navigation/UserAvatar';
import type { RewardBadgeType } from '@/data/rewards/catalog';
import { VoiceCallDiceLayer } from '@/components/chats/VoiceCallDiceLayer';
import { CallVideoView } from '@/components/chats/CallVideoView';
import { FontSize, Radius, Spacing } from '@/constants/theme';
import { useProfile } from '@/context/ProfileContext';
import type { ChatLiveVoiceParticipant, ChatLiveVoiceStatus } from '@/hooks/use-chat-live-voice';
import type { VideoTrack } from 'livekit-client';

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

function ParticipantTile({
  tile,
  avatarSize,
  tileWidth,
  videoHeight,
}: {
  tile: OverlayTile;
  avatarSize: number;
  tileWidth: number;
  videoHeight: number | null;
}) {
  const avatarOuter = avatarFrameOuterSize(avatarSize);
  const ringBox = avatarOuter + 8;
  const showVideo = Boolean(tile.cameraOn && tile.videoTrack && videoHeight);

  return (
    <View
      style={[
        styles.tile,
        { width: tileWidth },
        showVideo ? styles.tileVideo : null,
        tile.waiting && styles.tileWaiting,
        tile.urgent && styles.tileUrgent,
      ]}>
      {showVideo ? (
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
        </View>
      ) : (
        <View style={[styles.avatarWrap, { width: ringBox + 28, height: ringBox + 28 }]}>
          {tile.urgent ? <UrgentPulseRings size={ringBox} /> : null}
          {!tile.urgent && tile.waiting && !tile.connecting ? (
            <WaitingPulseRings size={ringBox} />
          ) : null}
          <View
            style={[
              styles.avatarRing,
              {
                width: ringBox,
                height: ringBox,
                borderRadius: ringBox / 2,
                borderColor: tile.urgent
                  ? '#ED4245'
                  : tile.speaking
                    ? '#23A559'
                    : tile.waiting
                      ? 'rgba(21, 122, 254, 0.85)'
                      : 'transparent',
              },
            ]}>
            <View style={[styles.avatarSlot, { width: avatarOuter, height: avatarOuter }]}>
              <UserAvatar
                nickname={tile.name}
                avatarUrl={tile.avatarUrl}
                size={avatarSize}
                badges={tile.badges}
                frameId={tile.frameId}
              />
            </View>
            {tile.connecting ? (
              <View style={styles.connectingOverlay} pointerEvents="none">
                <ActivityIndicator size="small" color="#FFFFFF" />
              </View>
            ) : null}
            {tile.muted && !tile.waiting ? (
              <View style={styles.muteBadge}>
                <Ionicons name="mic-off" size={12} color="#FFFFFF" />
              </View>
            ) : null}
          </View>
          {tile.urgent ? (
            <View style={styles.urgentBubble} pointerEvents="none">
              <Text style={styles.urgentBubbleText}>срочная заявка</Text>
            </View>
          ) : null}
        </View>
      )}
      <NameWithBadges
        name={tile.isLocal ? `${tile.name} (вы)` : tile.name}
        badges={tile.badges}
        textStyle={styles.tileName}
        badgeSize={12}
        layout="stack"
        align="center"
      />
      {tile.connecting ? (
        <Text style={styles.tileHint}>подключение…</Text>
      ) : tile.waiting && !tile.urgent ? (
        <Text style={styles.tileHint}>ожидание</Text>
      ) : null}
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
}: Props) {
  const insets = useSafeAreaInsets();
  const isDesktop = useIsDesktopWeb();
  const { avatarUrl: profileAvatarUrl } = useProfile();
  const { width, height } = useWindowDimensions();
  const [miniOffset, setMiniOffset] = useState(savedMiniOffset);
  const miniOffsetRef = useRef(savedMiniOffset);
  const miniSizeRef = useRef({ width: 280, height: 56 });
  const suppressExpandRef = useRef(false);
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
      savedMiniOffset = { x: 0, y: 0 };
      miniOffsetRef.current = savedMiniOffset;
      setMiniOffset(savedMiniOffset);
    }
  }, [visible]);

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
    // Local first, then live remotes, waiting last.
    return live.sort((a, b) => {
      if (a.isLocal !== b.isLocal) {
        return a.isLocal ? -1 : 1;
      }
      if (Boolean(a.waiting) !== Boolean(b.waiting)) {
        return a.waiting ? 1 : -1;
      }
      return a.name.localeCompare(b.name, 'ru');
    });
  }, [participants, profileAvatarUrl, urgentById, waitingPeers]);

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
