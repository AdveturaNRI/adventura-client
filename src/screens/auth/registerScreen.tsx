import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Link, useRouter } from 'expo-router';

import { AuthScreenLayout } from '@/components/auth/AuthScreenLayout';
import { OauthButtons } from '@/components/auth/OauthButtons';
import {
  Button,
  Caption,
  H1,
  Input,
  LinkLabel,
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

function createStyles(_colors: ThemeColors) {
  return StyleSheet.create({
    header: {
      gap: Spacing.lg,
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

export default function RegisterScreen() {
  const router = useRouter();
  const { signUp } = useAuth();
  const [nickname, setNickname] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [errors, setErrors] = useState<RegisterErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const styles = useThemedStyles(createStyles);

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
        <H1>{'Создайте аккаунт\nи начните играть'}</H1>

        <Switcher
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
        />
      </View>

      <Button
        label={isSubmitting ? 'Создаём...' : 'Зарегистрироваться'}
        onPress={handleSubmit}
      />

      <OauthButtons
        disabled={isSubmitting}
        onSuccess={() => router.replace('/')}
      />

      <View style={styles.footer}>
        <Caption>Уже есть аккаунт?</Caption>
        <Link href="/auth/login" asChild>
          <Pressable hitSlop={8}>
            <LinkLabel>Войти</LinkLabel>
          </Pressable>
        </Link>
      </View>
    </AuthScreenLayout>
  );
}
