import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Badge } from '@/components/ui';
import { toast } from '@/components/ui/feedback/toast';
import { FontSize, Spacing, type ThemeColors } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/hooks/use-theme';
import { useThemedStyles } from '@/hooks/use-themed-styles';
import { requestEmailVerification } from '@/services/auth/authApi';
import { getStoredToken } from '@/utils/auth-storage';
import { localizeErrorMessage } from '@/utils/localizeError';

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    card: {
      gap: Spacing.sm,
      padding: Spacing.md,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: colors.borderLight,
      backgroundColor: colors.surface,
    },
    topRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: Spacing.sm,
    },
    iconWrap: {
      width: 36,
      height: 36,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.surfaceMuted,
      borderWidth: 1,
      borderColor: colors.borderLight,
    },
    textBlock: {
      flex: 1,
      gap: 2,
      minWidth: 0,
    },
    title: {
      fontSize: FontSize.label,
      fontWeight: '600',
      color: colors.text,
      lineHeight: FontSize.label * 1.35,
    },
    subtitle: {
      fontSize: FontSize.caption,
      color: colors.textMuted,
      lineHeight: FontSize.caption * 1.4,
    },
    actions: {
      flexDirection: 'row',
      justifyContent: 'flex-end',
    },
  });
}

export function EmailVerificationBanner() {
  const { user, updateUser } = useAuth();
  const colors = useTheme();
  const styles = useThemedStyles(createStyles);
  const [isSending, setIsSending] = useState(false);

  if (!user || user.isGuest || user.emailVerified) {
    return null;
  }

  const handleResend = async () => {
    if (isSending) return;
    setIsSending(true);
    try {
      const token = await getStoredToken();
      if (!token) {
        toast.error('Сессия истекла, войдите снова');
        return;
      }
      const result = await requestEmailVerification(token);
      if (result.alreadyVerified) {
        await updateUser({ emailVerified: true });
        toast.success('Почта уже подтверждена');
        return;
      }
      toast.success('Письмо отправлено — проверьте почту');
    } catch (error) {
      toast.error(localizeErrorMessage(error, 'Не удалось отправить письмо'));
    } finally {
      setIsSending(false);
    }
  };

  return (
    <View style={styles.card}>
      <View style={styles.topRow}>
        <View style={styles.iconWrap}>
          <Ionicons name="mail-unread-outline" size={18} color={colors.primary} />
        </View>
        <View style={styles.textBlock}>
          <Text style={styles.title}>Подтвердите почту</Text>
          <Text style={styles.subtitle}>
            Отправили ссылку на {user.email}. Пока это не обязательно — можно
            пользоваться приложением как обычно. Ссылка действует 1 час.
          </Text>
        </View>
      </View>
      <View style={styles.actions}>
        <Badge
          label={isSending ? 'Отправляем...' : 'Отправить ещё раз'}
          variant="outline"
          onPress={handleResend}
        />
      </View>
    </View>
  );
}
