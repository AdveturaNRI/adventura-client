import { useState } from 'react';
import { Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import { Link, useLocalSearchParams, useRouter } from 'expo-router';

import { AuthScreenLayout } from '@/components/auth/AuthScreenLayout';
import {
  AUTH_COMPACT_HEIGHT,
  createAuthScreenLayoutStyles,
} from '@/components/auth/auth-screen-layout.styles';
import { OauthButtons } from '@/components/auth/OauthButtons';
import { useIsDesktopWeb } from '@/components/navigation/DesktopThemeToggle';
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

function createStyles(colors: ThemeColors, compact: boolean) {
  return StyleSheet.create({
    header: {
      gap: compact ? 10 : 14,
      alignItems: 'center',
    },
    title: {
      fontSize: compact ? 20 : 22,
      lineHeight: compact ? 26 : 28,
      fontWeight: '600',
      letterSpacing: -0.3,
      paddingHorizontal: Spacing.sm,
    },
    subtitle: {
      textAlign: 'center',
      color: colors.textMuted,
      paddingHorizontal: Spacing.md,
      marginBottom: Spacing.xs,
    },
    form: {
      gap: compact ? 12 : Spacing.md,
      width: '100%',
    },
    forgotRow: {
      alignItems: 'flex-end',
      paddingHorizontal: Spacing.xs,
      marginTop: Spacing.xs,
    },
    actions: {
      gap: 12,
      width: '100%',
      marginTop: Spacing.xs,
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
  const isDesktop = useIsDesktopWeb();
  const { height } = useWindowDimensions();
  const compact = height < AUTH_COMPACT_HEIGHT;
  const styles = useThemedStyles((colors) => createStyles(colors, compact));
  const layoutStyles = useThemedStyles((colors) =>
    createAuthScreenLayoutStyles(colors, isDesktop, compact),
  );

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
        <H1 style={styles.title}>Начните приключение прямо сейчас</H1>
        <Caption style={styles.subtitle}>Войдите в аккаунт или зайдите как гость</Caption>

        <Switcher
          size="compact"
          stretch
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
          style={layoutStyles.softField}
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
          style={layoutStyles.softField}
        />

        <View style={styles.forgotRow}>
          <Link href="/auth/forgot-password" asChild>
            <Pressable hitSlop={8}>
              <LinkLabel>Забыли пароль?</LinkLabel>
            </Pressable>
          </Link>
        </View>
      </View>

      <View style={styles.actions}>
        <Button
          label={isSubmitting ? 'Входим...' : 'Войти'}
          onPress={handleSubmit}
          style={layoutStyles.authButton}
        />

        <OauthButtons
          disabled={isSubmitting || isGuestSubmitting}
          onSuccess={() => router.replace(resolvePostLoginHref(nextParam))}
          buttonStyle={layoutStyles.authButtonGhost}
        />

        <Button
          variant="outline"
          label={isGuestSubmitting ? 'Создаём гостя...' : 'Войти как гость'}
          onPress={handleGuestLogin}
          style={layoutStyles.authButtonGhost}
        />
      </View>
    </AuthScreenLayout>
  );
}
