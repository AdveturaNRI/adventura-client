import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Link, useLocalSearchParams, useRouter } from 'expo-router';

import { AuthScreenLayout } from '@/components/auth/AuthScreenLayout';
import {
  Button,
  Caption,
  H1,
  LinkLabel,
  PasswordInput,
} from '@/components/ui';
import { toast } from '@/components/ui/feedback/toast';
import { Spacing, type ThemeColors } from '@/constants/theme';
import { useThemedStyles } from '@/hooks/use-themed-styles';
import { resetPassword } from '@/services/auth/authApi';
import { localizeErrorMessage } from '@/utils/localizeError';
import { getPasswordConfirmError } from '@/utils/validateAuth';

function createStyles(_colors: ThemeColors) {
  return StyleSheet.create({
    header: {
      gap: Spacing.md,
    },
    form: {
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

export default function ResetPasswordScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ token?: string | string[] }>();
  const token = useMemo(() => firstParam(params.token).trim(), [params.token]);
  const styles = useThemedStyles(createStyles);
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [error, setError] = useState<string | undefined>();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    const passwordError = getPasswordConfirmError(password, passwordConfirm);
    setError(passwordError);
    if (passwordError || isSubmitting) return;

    if (!token) {
      toast.error('Ссылка недействительна');
      return;
    }

    setIsSubmitting(true);
    try {
      await resetPassword(token, password);
      toast.success('Пароль обновлён — можно войти');
      router.replace('/auth/login');
    } catch (err) {
      toast.error(localizeErrorMessage(err, 'Не удалось сбросить пароль'));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AuthScreenLayout>
      <View style={styles.header}>
        <H1>{'Новый пароль'}</H1>
        <Caption>
          {token
            ? 'Придумайте новый пароль (минимум 8 символов).'
            : 'В ссылке нет токена — запросите восстановление заново.'}
        </Caption>
      </View>

      {token ? (
        <View style={styles.form}>
          <PasswordInput
            label="Новый пароль"
            value={password}
            onChangeText={(value) => {
              setPassword(value);
              if (error) setError(undefined);
            }}
            placeholder="••••••••"
          />
          <PasswordInput
            label="Повторите пароль"
            value={passwordConfirm}
            onChangeText={(value) => {
              setPasswordConfirm(value);
              if (error) setError(undefined);
            }}
            placeholder="••••••••"
            error={error}
          />
        </View>
      ) : null}

      {token ? (
        <Button
          label={isSubmitting ? 'Сохраняем...' : 'Сохранить пароль'}
          onPress={handleSubmit}
        />
      ) : (
        <Button
          label="Запросить ссылку"
          onPress={() => router.replace('/auth/forgot-password')}
        />
      )}

      <View style={styles.footer}>
        <Caption>Готовы войти?</Caption>
        <Link href="/auth/login" asChild>
          <Pressable hitSlop={8}>
            <LinkLabel>Войти</LinkLabel>
          </Pressable>
        </Link>
      </View>
    </AuthScreenLayout>
  );
}
