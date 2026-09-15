import { useMemo } from 'react';
import Toast, { type ToastConfig } from 'react-native-toast-message';

import { ToastBanner } from '@/components/ui/feedback/ToastBanner';
import { NotificationToastListener } from '@/components/navigation/NotificationToastListener';

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

  return (
    <>
      <NotificationToastListener />
      <Toast config={config} topOffset={72} bottomOffset={40} />
    </>
  );
}
