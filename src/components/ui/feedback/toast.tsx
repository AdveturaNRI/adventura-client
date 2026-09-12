import Toast from 'react-native-toast-message';

import {
  type ToastAlignment,
  type ToastPosition,
  type ToastVariant,
} from '@/components/ui/feedback/toast.config';

type ShowToastOptions = {
  title?: string;
  message: string;
  position?: ToastPosition;
  alignment?: ToastAlignment;
  duration?: number;
};

const DEFAULT_TITLES: Record<ToastVariant, string> = {
  success: 'Готово',
  error: 'Ошибка',
  info: 'Информация',
  warning: 'Внимание',
};

function showToast(variant: ToastVariant, options: ShowToastOptions) {
  Toast.show({
    type: variant,
    text1: options.title ?? DEFAULT_TITLES[variant],
    text2: options.message,
    position: options.position ?? 'top',
    visibilityTime: options.duration ?? 3500,
    props: {
      alignment: options.alignment ?? 'center',
    },
  });
}

export const toast = {
  success(message: string, options?: Omit<ShowToastOptions, 'message'>) {
    showToast('success', { message, ...options });
  },
  error(message: string, options?: Omit<ShowToastOptions, 'message'>) {
    showToast('error', { message, ...options });
  },
  info(message: string, options?: Omit<ShowToastOptions, 'message'>) {
    showToast('info', { message, ...options });
  },
  warning(message: string, options?: Omit<ShowToastOptions, 'message'>) {
    showToast('warning', { message, ...options });
  },
};
