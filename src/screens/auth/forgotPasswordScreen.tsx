import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Link, useRouter } from 'expo-router';

import { AuthScreenLayout } from '@/components/auth/AuthScreenLayout';
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

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const styles = useThemedStyles(createStyles);
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
        <H1>{'Восстановление\nпароля'}</H1>
        <Caption>
          {sent
            ? 'Проверьте почту — если аккаунт существует, там будет ссылка на сброс (1 час).'
            : 'Укажите email аккаунта. Мы отправим ссылку для сброса пароля.'}
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
          />
        </View>
      ) : null}

      {!sent ? (
        <Button
          label={isSubmitting ? 'Отправляем...' : 'Отправить ссылку'}
          onPress={handleSubmit}
        />
      ) : (
        <Button label="Назад ко входу" onPress={() => router.replace('/auth/login')} />
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
