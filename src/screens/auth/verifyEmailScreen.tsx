import { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Link, useLocalSearchParams, useRouter } from 'expo-router';

import { AuthScreenLayout } from '@/components/auth/AuthScreenLayout';
import { Button, Caption, H1, LinkLabel } from '@/components/ui';
import { Spacing, type ThemeColors } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';
import { useThemedStyles } from '@/hooks/use-themed-styles';
import { fetchCurrentUser, verifyEmail } from '@/services/auth/authApi';
import { getStoredToken } from '@/utils/auth-storage';
import { localizeErrorMessage } from '@/utils/localizeError';

function createStyles(_colors: ThemeColors) {
  return StyleSheet.create({
    header: {
      gap: Spacing.md,
    },
    footer: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: Spacing.sm,
      paddingTop: Spacing.sm,
    },
  });
}

function firstParam(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0] ?? '';
  return value ?? '';
}

function tokenFromWindow(): string {
  if (typeof window === 'undefined') return '';
  try {
    return new URLSearchParams(window.location.search).get('token')?.trim() ?? '';
  } catch {
    return '';
  }
}

type Status = 'loading' | 'ok' | 'error';

export default function VerifyEmailScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ token?: string | string[] }>();
  const paramToken = useMemo(() => firstParam(params.token).trim(), [params.token]);
  const token = paramToken || tokenFromWindow();
  const { isAuthenticated, updateUser } = useAuth();
  const styles = useThemedStyles(createStyles);
  const [status, setStatus] = useState<Status>(token ? 'loading' : 'error');
  const [message, setMessage] = useState(
    token ? 'Подтверждаем почту...' : 'В ссылке нет токена',
  );
  const didVerify = useRef(false);

  useEffect(() => {
    if (!token || didVerify.current) return;
    didVerify.current = true;

    let cancelled = false;

    (async () => {
      try {
        await verifyEmail(token);
        if (cancelled) return;

        try {
          const accessToken = await getStoredToken();
          if (accessToken) {
            const me = await fetchCurrentUser(accessToken, { skipLoading: true });
            await updateUser(me);
          } else {
            await updateUser({ emailVerified: true });
          }
        } catch {
          await updateUser({ emailVerified: true });
        }

        setStatus('ok');
        setMessage('Почта подтверждена. Можно продолжать.');
      } catch (error) {
        if (cancelled) return;
        setStatus('error');
        setMessage(localizeErrorMessage(error, 'Не удалось подтвердить почту'));
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [token, updateUser]);

  return (
    <AuthScreenLayout>
      <View style={styles.header}>
        <H1>
          {status === 'ok'
            ? 'Готово'
            : status === 'loading'
              ? 'Подтверждение'
              : 'Не вышло'}
        </H1>
        <Caption>{message}</Caption>
      </View>

      <Button
        label={isAuthenticated ? 'В профиль' : 'Войти'}
        onPress={() =>
          router.replace(isAuthenticated ? '/profile' : '/auth/login')
        }
      />

      {!isAuthenticated ? (
        <View style={styles.footer}>
          <Caption>Нет аккаунта?</Caption>
          <Link href="/auth/register" asChild>
            <Pressable hitSlop={8}>
              <LinkLabel>Регистрация</LinkLabel>
            </Pressable>
          </Link>
        </View>
      ) : null}
    </AuthScreenLayout>
  );
}
