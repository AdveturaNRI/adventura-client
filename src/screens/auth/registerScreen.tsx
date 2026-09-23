import { useEffect, useState } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import { useRouter } from 'expo-router';

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
  NicknameInput,
  PasswordInput,
  Switcher,
} from '@/components/ui';
import { Spacing, type ThemeColors } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';
import { useThemedStyles } from '@/hooks/use-themed-styles';
import { getEmailError, getNicknameError, getPasswordConfirmError } from '@/utils/validateAuth';
import {
  getMarketingAnonymousId,
  recordMarketingConversion,
} from '@/services/marketing/attribution';
import { reachYandexMetrikaGoal } from '@/services/analytics/yandex-metrika';

type RegisterErrors = {
  nickname?: string;
  email?: string;
  passwordConfirm?: string;
};

let registrationStartedSent = false;

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
    actions: {
      gap: 12,
      width: '100%',
      marginTop: Spacing.xs,
    },
  });
}

export default function RegisterScreen() {
  const router = useRouter();
  const { signUp } = useAuth();
  const [nickname, setNickname] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [errors, setErrors] = useState<RegisterErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const isDesktop = useIsDesktopWeb();
  const { height } = useWindowDimensions();
  const compact = height < AUTH_COMPACT_HEIGHT;
  const styles = useThemedStyles((colors) => createStyles(colors, compact));
  const layoutStyles = useThemedStyles((colors) =>
    createAuthScreenLayoutStyles(colors, isDesktop, compact),
  );

  useEffect(() => {
    if (registrationStartedSent) {
      return;
    }
    registrationStartedSent = true;

    void (async () => {
      const anonymousId = await getMarketingAnonymousId().catch(() => null);
      if (!anonymousId) return;
      const day = new Date().toISOString().slice(0, 10);
      void recordMarketingConversion({
        type: 'REGISTRATION_STARTED',
        anonymousId,
        idempotencyKey: `registration_started:${anonymousId}:${day}`,
      });
      reachYandexMetrikaGoal('registration_started');
    })();
  }, []);

  const handleSubmit = async () => {
    const nextErrors: RegisterErrors = {
      nickname: getNicknameError(nickname),
      email: getEmailError(email),
      passwordConfirm: getPasswordConfirmError(password, passwordConfirm),
    };

    setErrors(nextErrors);

    if (nextErrors.nickname || nextErrors.email || nextErrors.passwordConfirm || isSubmitting) {
      return;
    }

    setIsSubmitting(true);

    const isSuccess = await signUp(email.trim(), nickname.trim(), password);

    setIsSubmitting(false);

    if (isSuccess) {
      setNickname('');
      setEmail('');
      setPassword('');
      setPasswordConfirm('');
      setErrors({});
    }
  };

  return (
    <AuthScreenLayout>
      <View style={styles.header}>
        <H1 style={styles.title}>Создайте аккаунт и начните играть</H1>
        <Caption style={styles.subtitle}>Пара полей — и можно открывать приключения</Caption>

        <Switcher
          size="compact"
          stretch
          options={[
            { key: 'login', label: 'Вход' },
            { key: 'register', label: 'Регистрация' },
          ]}
          value="register"
          onChange={(value) => {
            if (value === 'login') {
              router.replace('/auth/login');
            }
          }}
        />
      </View>

      <View style={styles.form}>
        <NicknameInput
          label="Никнейм"
          value={nickname}
          onChangeText={(value) => {
            setNickname(value);
            if (errors.nickname) {
              setErrors((current) => ({ ...current, nickname: undefined }));
            }
          }}
          autoCapitalize="none"
          autoCorrect={false}
          placeholder="ваш_никнейм"
          error={errors.nickname}
          style={layoutStyles.softField}
        />

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
            if (errors.passwordConfirm) {
              setErrors((current) => ({ ...current, passwordConfirm: undefined }));
            }
          }}
          placeholder="••••••••"
          style={layoutStyles.softField}
        />

        <PasswordInput
          label="Повторите пароль"
          value={passwordConfirm}
          onChangeText={(value) => {
            setPasswordConfirm(value);
            if (errors.passwordConfirm) {
              setErrors((current) => ({ ...current, passwordConfirm: undefined }));
            }
          }}
          placeholder="••••••••"
          error={errors.passwordConfirm}
          style={layoutStyles.softField}
        />
      </View>

      <View style={styles.actions}>
        <Button
          label={isSubmitting ? 'Создаём...' : 'Зарегистрироваться'}
          onPress={handleSubmit}
          style={layoutStyles.authButton}
        />

        <OauthButtons
          disabled={isSubmitting}
          onSuccess={() => router.replace('/')}
          buttonStyle={layoutStyles.authButtonGhost}
        />
      </View>
    </AuthScreenLayout>
  );
}
