import type { ComponentProps } from 'react';
import type { Ionicons } from '@expo/vector-icons';

import type { ThemeColors } from '@/constants/theme';

export type ToastVariant = 'success' | 'error' | 'info' | 'warning';

export type ToastPosition = 'top' | 'bottom';

export type ToastAlignment = 'left' | 'center' | 'right';

export type ToastEmphasis = 'default' | 'alert' | 'chat';

export type ToastVariantSpec = {
  variant: ToastVariant;
  label: string;
  description: string;
  icon: ComponentProps<typeof Ionicons>['name'];
  accentColor: string;
};

export function getToastSpecs(colors: ThemeColors): ToastVariantSpec[] {
  return [
    {
      variant: 'success',
      label: 'Успех',
      description: 'Подтверждение действия или успешный результат',
      icon: 'checkmark-circle',
      accentColor: colors.success,
    },
    {
      variant: 'error',
      label: 'Ошибка',
      description: 'Сбой операции или валидации',
      icon: 'close-circle',
      accentColor: colors.destructive,
    },
    {
      variant: 'info',
      label: 'Информация',
      description: 'Нейтральное уведомление',
      icon: 'information-circle',
      accentColor: colors.primary,
    },
    {
      variant: 'warning',
      label: 'Внимание',
      description: 'Предупреждение, требующее внимания',
      icon: 'warning',
      accentColor: '#FF9F0A',
    },
  ];
}
