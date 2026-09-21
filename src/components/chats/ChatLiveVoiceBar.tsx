import { Ionicons } from '@expo/vector-icons';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import type { ChatLiveVoiceParticipant, ChatLiveVoiceStatus } from '@/hooks/use-chat-live-voice';
import { useTheme } from '@/hooks/use-theme';
import { FontSize, Radius, Spacing } from '@/constants/theme';

type Props = {
  status: ChatLiveVoiceStatus;
  ringing?: boolean;
  error: string | null;
  muted: boolean;
  participants: ChatLiveVoiceParticipant[];
  onToggleMute: () => void;
  onLeave: () => void;
  onRetry?: () => void;
};

function statusLabel(
  status: ChatLiveVoiceStatus,
  participants: ChatLiveVoiceParticipant[],
  error: string | null,
  ringing?: boolean,
): string {
  if (ringing) {
    return 'Вызов…';
  }
  if (status === 'connecting') {
    return 'Подключаемся…';
  }
  if (status === 'error') {
    return error || 'Не удалось подключиться';
  }
  const others = participants.filter((p) => !p.isLocal).length;
  if (others === 0) {
    return 'Ждём ответа';
  }
  if (others === 1) {
    const peer = participants.find((p) => !p.isLocal);
    return peer ? `С ${peer.name}` : 'В эфире';
  }
  return `В эфире · ${others + 1}`;
}

/** Compact in-thread LiveKit voice controls (mute / hang up). */
export function ChatLiveVoiceBar({
  status,
  ringing,
  error,
  muted,
  participants,
  onToggleMute,
  onLeave,
  onRetry,
}: Props) {
  const colors = useTheme();
  const busy = status === 'connecting' || Boolean(ringing);
  const connected = status === 'connected' && !ringing;
  const failed = status === 'error';

  if (status === 'idle') {
    return null;
  }

  return (
    <View
      style={[
        styles.bar,
        {
          backgroundColor: 'rgba(21, 122, 254, 0.1)',
          borderColor: 'rgba(21, 122, 254, 0.22)',
        },
      ]}>
      <View style={styles.left}>
        {busy ? (
          <ActivityIndicator size="small" color={colors.primary} />
        ) : (
          <View
            style={[
              styles.dot,
              {
                backgroundColor: failed
                  ? colors.destructive
                  : participants.some((p) => p.speaking)
                    ? colors.success
                    : colors.primary,
              },
            ]}
          />
        )}
        <Text
          style={[styles.label, { color: failed ? colors.destructive : colors.primary }]}
          numberOfLines={1}>
          {statusLabel(status, participants, error, ringing)}
        </Text>
      </View>

      <View style={styles.actions}>
        {failed && onRetry ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Повторить"
            hitSlop={8}
            onPress={onRetry}
            style={({ pressed }) => [styles.iconBtn, pressed && styles.pressed]}>
            <Ionicons name="refresh" size={18} color={colors.primary} />
          </Pressable>
        ) : null}

        {connected ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={muted ? 'Включить микрофон' : 'Выключить микрофон'}
            hitSlop={8}
            onPress={onToggleMute}
            style={({ pressed }) => [
              styles.iconBtn,
              muted && styles.muteOn,
              pressed && styles.pressed,
            ]}>
            <Ionicons
              name={muted ? 'mic-off' : 'mic'}
              size={18}
              color={muted ? colors.destructive : colors.primary}
            />
          </Pressable>
        ) : null}

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Выйти из голосового"
          hitSlop={8}
          onPress={onLeave}
          style={({ pressed }) => [styles.hangup, pressed && styles.pressed]}>
          <Ionicons name="call" size={16} color="#FFFFFF" style={styles.hangupIcon} />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    marginHorizontal: Spacing.md,
    marginTop: Spacing.sm,
    marginBottom: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 14,
    borderWidth: 1,
  },
  left: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    minWidth: 0,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  label: {
    flex: 1,
    fontSize: FontSize.caption,
    fontWeight: '600',
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  iconBtn: {
    width: 34,
    height: 34,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  muteOn: {
    backgroundColor: 'rgba(255, 59, 48, 0.12)',
  },
  hangup: {
    width: 34,
    height: 34,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FF3B30',
  },
  hangupIcon: {
    transform: [{ rotate: '135deg' }],
  },
  pressed: {
    opacity: 0.72,
  },
});
