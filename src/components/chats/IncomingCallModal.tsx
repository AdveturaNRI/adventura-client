import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { FontSize, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type Props = {
  visible: boolean;
  callerName: string;
  callerAvatarUrl: string | null;
  subtitle?: string;
  onAccept: () => void;
  /** Start getUserMedia while the finger is still down (iOS / RN-web). */
  onAcceptPressIn?: () => void;
  onDecline: () => void;
};

export function IncomingCallModal({
  visible,
  callerName,
  callerAvatarUrl,
  subtitle,
  onAccept,
  onAcceptPressIn,
  onDecline,
}: Props) {
  const colors = useTheme();
  const initial = (callerName.trim()[0] || '?').toUpperCase();

  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent>
      <View style={styles.backdrop}>
        <View style={[styles.card, { backgroundColor: colors.surface }]}>
          <Text style={[styles.eyebrow, { color: colors.primary }]}>Входящий звонок</Text>

          <View style={[styles.avatar, { backgroundColor: colors.primary }]}>
            {callerAvatarUrl ? (
              <Image source={{ uri: callerAvatarUrl }} style={styles.avatarImage} />
            ) : (
              <Text style={styles.avatarInitial}>{initial}</Text>
            )}
          </View>

          <Text style={[styles.name, { color: colors.text }]} numberOfLines={1}>
            {callerName}
          </Text>
          <Text style={[styles.hint, { color: colors.textMuted }]}>
            {subtitle?.trim() || 'Голосовой чат'}
          </Text>

          <View style={styles.actions}>
            <View style={styles.actionCol}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Отклонить"
                onPress={onDecline}
                style={({ pressed }) => [
                  styles.circleBtn,
                  styles.decline,
                  pressed && styles.pressed,
                ]}>
                <Ionicons name="call" size={26} color="#FFFFFF" style={styles.declineIcon} />
              </Pressable>
              <Text
                style={[styles.actionLabel, { color: colors.textMuted }]}
                numberOfLines={1}>
                Отклонить
              </Text>
            </View>

            <View style={styles.actionCol}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Принять"
                onPressIn={onAcceptPressIn}
                onPress={onAccept}
                style={({ pressed }) => [
                  styles.circleBtn,
                  styles.accept,
                  pressed && styles.pressed,
                ]}>
                <Ionicons name="call" size={26} color="#FFFFFF" />
              </Pressable>
              <Text
                style={[styles.actionLabel, { color: colors.textMuted }]}
                numberOfLines={1}>
                Принять
              </Text>
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.lg,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  card: {
    width: '100%',
    maxWidth: 340,
    borderRadius: 24,
    paddingVertical: 28,
    paddingHorizontal: 24,
    alignItems: 'center',
  },
  eyebrow: {
    fontSize: FontSize.caption,
    fontWeight: '700',
    letterSpacing: 0.4,
    marginBottom: 18,
  },
  avatar: {
    width: 88,
    height: 88,
    borderRadius: 44,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    marginBottom: 14,
  },
  avatarImage: {
    width: '100%',
    height: '100%',
  },
  avatarInitial: {
    color: '#FFFFFF',
    fontSize: 34,
    fontWeight: '700',
  },
  name: {
    fontSize: 22,
    fontWeight: '700',
    textAlign: 'center',
  },
  hint: {
    marginTop: 4,
    fontSize: FontSize.caption,
  },
  actions: {
    marginTop: 28,
    width: '100%',
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'center',
    gap: 28,
  },
  actionCol: {
    flex: 1,
    maxWidth: 140,
    alignItems: 'center',
    gap: 10,
  },
  circleBtn: {
    width: 64,
    height: 64,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  decline: {
    backgroundColor: '#FF3B30',
  },
  accept: {
    backgroundColor: '#34C759',
  },
  declineIcon: {
    transform: [{ rotate: '135deg' }],
  },
  actionLabel: {
    textAlign: 'center',
    fontSize: 13,
    fontWeight: '600',
  },
  pressed: {
    opacity: 0.78,
    transform: [{ scale: 0.96 }],
  },
});
