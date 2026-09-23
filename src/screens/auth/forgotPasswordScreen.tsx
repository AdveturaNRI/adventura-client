import { useState } from 'react';
import { Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import { Link, useRouter } from 'expo-router';

import { AuthScreenLayout } from '@/components/auth/AuthScreenLayout';
import {
  AUTH_COMPACT_HEIGHT,
  createAuthScreenLayoutStyles,
} from '@/components/auth/auth-screen-layout.styles';
import { useIsDesktopWeb } from '@/components/navigation/DesktopThemeToggle';
import {
  Button,
  Caption,
  H1,
  Input,
  LinkLabel,
} from '@/components/ui';
import { toast } from '@/components/ui/feedback/toast';
import { Spacing, type ThemeColors } from '@/constants/theme';
import { useThemedStyles } from '@/hooks/use-themed-styles';
import { forgotPassword } from '@/services/auth/authApi';
import { localizeErrorMessage } from '@/utils/localizeError';
import { getEmailError } from '@/utils/validateAuth';

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
      paddingHorizontal: Spacing.sm,
      marginBottom: Spacing.xs,
    },
    form: {
      gap: compact ? 12 : Spacing.md,
      width: '100%',
    },
    footer: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: Spacing.sm,
      marginTop: Spacing.xs,
    },
  });
}

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const isDesktop = useIsDesktopWeb();
  const { height } = useWindowDimensions();
  const compact = height < AUTH_COMPACT_HEIGHT;
  const styles = useThemedStyles((colors) => createStyles(colors, compact));
  const layoutStyles = useThemedStyles((colors) =>
    createAuthScreenLayoutStyles(colors, isDesktop, compact),
  );
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | undefined>();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async () => {
    const emailError = getEmailError(email);
    setError(emailError);
    if (emailError || isSubmitting) return;

    setIsSubmitting(true);
    try {
      await forgotPassword(email.trim().toLowerCase());
      setSent(true);
      toast.success('Если такой аккаунт есть — письмо уже в пути');
    } catch (err) {
      toast.error(localizeErrorMessage(err, 'Не удалось отправить письмо'));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AuthScreenLayout>
      <View style={styles.header}>
        <H1 style={styles.title}>Восстановление пароля</H1>
        <Caption style={styles.subtitle}>
          {sent
            ? 'Проверьте почту — если аккаунт есть, там будет ссылка на сброс (1 час).'
            : 'Укажите email — пришлём ссылку для сброса пароля.'}
        </Caption>
      </View>

      {!sent ? (
        <View style={styles.form}>
          <Input
            label="Email"
            value={email}
            onChangeText={(value) => {
              setEmail(value);
              if (error) setError(undefined);
            }}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            textContentType="emailAddress"
            placeholder="example@mail.com"
            error={error}
            style={layoutStyles.softField}
          />
        </View>
      ) : null}

      {!sent ? (
        <Button
          label={isSubmitting ? 'Отправляем...' : 'Отправить ссылку'}
          onPress={handleSubmit}
          style={layoutStyles.authButton}
        />
      ) : (
        <Button
          label="Назад ко входу"
          onPress={() => router.replace('/auth/login')}
          style={layoutStyles.authButton}
        />
      )}

      <View style={styles.footer}>
        <Caption>Вспомнили пароль?</Caption>
        <Link href="/auth/login" asChild>
          <Pressable hitSlop={8}>
            <LinkLabel>Войти</LinkLabel>
          </Pressable>
        </Link>
      </View>
    </AuthScreenLayout>
  );
}
