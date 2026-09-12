import { useMemo } from 'react';
import Toast, { type ToastConfig } from 'react-native-toast-message';

import { ToastBanner } from '@/components/ui/feedback/ToastBanner';

export function AppToast() {
  const config = useMemo<ToastConfig>(
    () => ({
      success: (props) => <ToastBanner {...props} variant="success" />,
      error: (props) => <ToastBanner {...props} variant="error" />,
      info: (props) => <ToastBanner {...props} variant="info" />,
      warning: (props) => <ToastBanner {...props} variant="warning" />,
    }),
    [],
  );

  return <Toast config={config} topOffset={56} bottomOffset={40} />;
}
