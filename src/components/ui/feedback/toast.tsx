import Toast from 'react-native-toast-message';

import {
  type ToastAlignment,
  type ToastEmphasis,
  type ToastPosition,
  type ToastVariant,
} from '@/components/ui/feedback/toast.config';

export type { ToastEmphasis };

type ShowToastOptions = {
  title?: string;
  message?: string;
  position?: ToastPosition;
  alignment?: ToastAlignment;
  duration?: number;
  actionLabel?: string;
  onAction?: () => void;
  emphasis?: ToastEmphasis;
  avatarUrl?: string | null;
  avatarName?: string | null;
};

const DEFAULT_TITLES: Record<ToastVariant, string> = {
  success: 'Готово',
  error: 'Ошибка',
  info: 'Информация',
  warning: 'Внимание',
};

function showToast(variant: ToastVariant, options: ShowToastOptions) {
  const hasCustomTitle = Boolean(options.title?.trim());
  const title = hasCustomTitle
    ? options.title
    : options.message?.trim()
      ? options.message
      : DEFAULT_TITLES[variant];
  const message = hasCustomTitle ? options.message : undefined;

  Toast.show({
    type: variant,
    text1: title,
    text2: message,
    position: options.position ?? 'top',
    visibilityTime: options.duration ?? 3500,
    props: {
      alignment: options.alignment ?? 'center',
      actionLabel: options.actionLabel,
      onAction: options.onAction,
      emphasis: options.emphasis ?? 'default',
      avatarUrl: options.avatarUrl ?? null,
      avatarName: options.avatarName ?? null,
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
  hide() {
    Toast.hide();
  },
};
