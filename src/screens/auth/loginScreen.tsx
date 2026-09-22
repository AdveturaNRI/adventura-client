import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Link, useLocalSearchParams, useRouter } from 'expo-router';

import { AuthScreenLayout } from '@/components/auth/AuthScreenLayout';
import { OauthButtons } from '@/components/auth/OauthButtons';
import {
  Button,
  Caption,
  H1,
  Input,
  LinkLabel,
  PasswordInput,
  Switcher,
} from '@/components/ui';
import { Spacing, type ThemeColors } from '@/constants/theme';
import { resolvePostLoginHref } from '@/constants/auth-routes';
import { useAuth } from '@/context/AuthContext';
import { useThemedStyles } from '@/hooks/use-themed-styles';
import { getEmailError } from '@/utils/validateAuth';

type LoginErrors = {
  email?: string;
  password?: string;
};

function createStyles(_colors: ThemeColors) {
  return StyleSheet.create({
    header: {
      gap: Spacing.lg,
    },
    form: {
      gap: Spacing.md,
    },
    forgotRow: {
      alignItems: 'flex-end',
      paddingHorizontal: Spacing.xs,
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

export default function LoginScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ next?: string | string[] }>();
  const nextParam = Array.isArray(params.next) ? params.next[0] : params.next;
  const { signIn, signInAsGuest } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<LoginErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGuestSubmitting, setIsGuestSubmitting] = useState(false);
  const styles = useThemedStyles(createStyles);

  const handleSubmit = async () => {
    const nextErrors: LoginErrors = {
      email: getEmailError(email),
      password: password.trim() ? undefined : 'Введите пароль',
    };

    setErrors(nextErrors);

    if (nextErrors.email || nextErrors.password || isSubmitting) {
      return;
    }

    setIsSubmitting(true);

    const isSuccess = await signIn(email.trim(), password);

    setIsSubmitting(false);

    if (isSuccess) {
      setEmail('');
      setPassword('');
      setErrors({});
      router.replace(resolvePostLoginHref(nextParam));
    }
  };

  const handleGuestLogin = async () => {
    if (isSubmitting || isGuestSubmitting) {
      return;
    }

    setIsGuestSubmitting(true);

    const ok = await signInAsGuest();

    setIsGuestSubmitting(false);

    if (ok) {
      router.replace(resolvePostLoginHref(nextParam));
    }
  };

  return (
    <AuthScreenLayout>
      <View style={styles.header}>
        <H1>{'Начните приключение\nпрямо сейчас'}</H1>

        <Switcher
          options={[
            { key: 'login', label: 'Вход' },
            { key: 'register', label: 'Регистрация' },
          ]}
          value="login"
          onChange={(value) => {
            if (value === 'register') {
              router.replace('/auth/register');
            }
          }}
        />
      </View>

      <View style={styles.form}>
        <Input
          label="Email"
          value={email}
          onChangeText={(value) => {
            setEmail(value);
            if (errors.email) {
              setErrors((current) => ({ ...current, email: undefined }));
            }
          }}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="email-address"
          textContentType="emailAddress"
          placeholder="example@mail.com"
          error={errors.email}
        />

        <PasswordInput
          label="Пароль"
          value={password}
          onChangeText={(value) => {
            setPassword(value);
            if (errors.password) {
              setErrors((current) => ({ ...current, password: undefined }));
            }
          }}
          placeholder="••••••••"
          error={errors.password}
        />

        <View style={styles.forgotRow}>
          <Link href="/auth/forgot-password" asChild>
            <Pressable hitSlop={8}>
              <LinkLabel>Забыли пароль?</LinkLabel>
            </Pressable>
          </Link>
        </View>
      </View>

      <Button
        label={isSubmitting ? 'Входим...' : 'Войти'}
        onPress={handleSubmit}
      />

      <OauthButtons
        disabled={isSubmitting || isGuestSubmitting}
        onSuccess={() => router.replace(resolvePostLoginHref(nextParam))}
      />

      <Button
        variant="outline"
        label={isGuestSubmitting ? 'Создаём гостя...' : 'Войти как гость'}
        onPress={handleGuestLogin}
      />

      <View style={styles.footer}>
        <Caption>Нет аккаунта?</Caption>
        <Link href="/auth/register" asChild>
          <Pressable hitSlop={8}>
            <LinkLabel>Регистрация</LinkLabel>
          </Pressable>
        </Link>
      </View>
    </AuthScreenLayout>
  );
}
